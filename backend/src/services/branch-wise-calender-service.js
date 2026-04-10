import sql from "mssql";
import { getPool } from "../config/sql-config.js";

class BranchWiseCalenderService {

    /* =========================
       LIST
    ========================== */
    async list({ top = 500 } = {}) {
        const pool = await getPool();
        const request = pool.request();
        request.input("top", sql.Int, Number(top) || 500);

        const result = await request.query(`
      SELECT TOP (@top)
        TRAN_ID,
        BRANCHID,
        CAST(CALENDER_DATE AS date) AS CALENDER_DATE,
        ISNOTWORKINGDAY,
        NOTWORKINGDAYDESC,
        IsArchived
      FROM dbo.tblBranchWiseCalender
      ORDER BY CALENDER_DATE DESC;
    `);

        return result.recordset;
    }

    /* =========================
       VALIDATION
    ========================== */
    validateRow(row, index = 0) {
        const reasons = [];

        const branchRaw = this.cleanStr(
            row?.Branch ?? row?.BRANCH ?? row?.BRANCHID ?? row?.BranchId ?? row?.BranchName
        );

        const dateRaw = row?.Calender_Date ?? row?.CALENDER_DATE ?? row?.Date ?? row?.date;
        const isNotWorkingRaw = row?.IsNotWorkingDay ?? row?.ISNOTWORKINGDAY;
        const descRaw = this.cleanStr(row?.NotWorkingDayDesc ?? row?.NOTWORKINGDAYDESC);
        const isArchivedRaw = row?.IsArchived ?? row?.ISARCHIVED ?? row?.isArchived;

        if (!branchRaw) reasons.push("BRANCH is required");

        const calDate = this.parseDateOnly(dateRaw);
        if (!calDate) reasons.push("CALENDER_DATE invalid (yyyy-mm-dd)");

        if (this.parse01(isNotWorkingRaw) === null)
            reasons.push("ISNOTWORKINGDAY must be 0 or 1");

        if (!descRaw) reasons.push("NOTWORKINGDAYDESC is required");

        if (this.parse01(isArchivedRaw) === null)
            reasons.push("IsArchived must be 0 or 1");

        return {
            rowNo: index + 1,
            branch: branchRaw,
            date: calDate ? this.toYMD(calDate) : null,
            reasons,
            isValid: reasons.length === 0,
        };
    }

    async validateBulk(payloads = []) {
        if (!Array.isArray(payloads) || payloads.length === 0) {
            const err = new Error("payloads array is required.");
            err.code = "VALIDATION_ERROR";
            throw err;
        }

        const invalidRows = [];

        payloads.forEach((p, idx) => {
            const v = this.validateRow(p, idx);
            if (!v.isValid) invalidRows.push(v);
        });

        return { invalidRows };
    }

    /* =========================
       BULK IMPORT (SMART UPSERT)
    ========================== */
    async bulkImport({ payloads = [] } = {}) {
        if (!Array.isArray(payloads) || payloads.length === 0) {
            const err = new Error("payloads array is required and cannot be empty.");
            err.code = "VALIDATION_ERROR";
            throw err;
        }

        if (payloads.length > 200000) {
            const err = new Error("Maximum 200,000 rows allowed per import operation.");
            err.code = "RATE_LIMIT_EXCEEDED";
            throw err;
        }

        const { invalidRows } = await this.validateBulk(payloads);
        if (invalidRows.length) {
            const err = new Error("Validation failed.");
            err.code = "BULK_VALIDATION_FAILED";
            err.invalidRows = invalidRows;
            throw err;
        }

        const pool = await getPool();
        const tx = new sql.Transaction(pool);

        try {
            await tx.begin();

            const CHUNK = 20000;
            let inserted = 0;
            let updated = 0;

            for (let i = 0; i < payloads.length; i += CHUNK) {
                const batch = payloads.slice(i, i + CHUNK);

                console.log(`🚀 Processing chunk ${i / CHUNK + 1}`);
                console.log(`➡️ Rows in chunk: ${batch.length}`);

                const chunkResult = await this._bulkImportBatch(tx, batch);

                inserted += chunkResult.inserted;
                updated += chunkResult.updated;

                console.log(
                    `✅ Chunk ${i / CHUNK + 1} inserted: ${chunkResult.inserted}, updated: ${chunkResult.updated}`
                );
            }

            await tx.commit();

            return {
                inserted,
                updated,
                invalidCount: 0
            };

        } catch (e) {
            try {
                await tx.rollback();
            } catch { }
            throw e;
        }
    }

    async _bulkImportBatch(tx, batch) {
        if (!Array.isArray(batch) || batch.length === 0) {
            console.log("⚠️ Empty batch received");
            return { inserted: 0, updated: 0 };
        }

        console.log(`📦 Incoming batch size: ${batch.length}`);

        // Normalize payloads
        const normalized = [];
        for (const p of batch) {
            const branchRaw = this.cleanStr(
                p.Branch ?? p.BRANCH ?? p.BRANCHID ?? p.BranchId ?? p.BranchName
            );

            const branchId = await this.resolveBranchId(tx, branchRaw);
            if (branchId == null) throw new Error(`Invalid BRANCH: ${branchRaw}`);

            const calDate = this.parseDateOnly(
                p.Calender_Date ?? p.CALENDER_DATE ?? p.Date ?? p.date
            );

            const isNotWorkingDay = this.parse01(p.IsNotWorkingDay ?? p.ISNOTWORKINGDAY);
            const desc = String(p.NotWorkingDayDesc ?? p.NOTWORKINGDAYDESC ?? "").trim();
            const isArchived = this.parse01(p.IsArchived ?? p.ISARCHIVED ?? p.isArchived);

            normalized.push({
                BRANCHID: branchId,
                CALENDER_DATE: calDate,
                ISNOTWORKINGDAY: isNotWorkingDay,
                NOTWORKINGDAYDESC: desc,
                IsArchived: isArchived
            });
        }

        // Deduplicate - ensure unique by primary key (BRANCHID + CALENDER_DATE)
        const deduped = new Map();
        for (const row of normalized) {
            // Normalize key components to ensure consistency
            const branchId = String(row.BRANCHID || '').trim().toLowerCase();
            const dateStr = this.toYMD(row.CALENDER_DATE) || '';

            const key = `${branchId}|${dateStr}`;
            deduped.set(key, row); // Keep the last occurrence (latest data)
        }

        const uniqueBatch = Array.from(deduped.values());
        console.log(`🧹 After dedupe: ${uniqueBatch.length} (from ${normalized.length})`);

        // Temp table
        const table = new sql.Table('#TempCalender');
        table.create = true;

        table.columns.add('BRANCHID', sql.Int, { nullable: false });
        table.columns.add('CALENDER_DATE', sql.Date, { nullable: false });
        table.columns.add('ISNOTWORKINGDAY', sql.Bit, { nullable: false });
        table.columns.add('NOTWORKINGDAYDESC', sql.NVarChar(200), { nullable: false });
        table.columns.add('IsArchived', sql.Bit, { nullable: false });

        for (const r of uniqueBatch) {
            table.rows.add(
                r.BRANCHID,
                r.CALENDER_DATE,
                r.ISNOTWORKINGDAY,
                r.NOTWORKINGDAYDESC,
                r.IsArchived
            );
        }

        // Bulk insert temp table
        await new sql.Request(tx).bulk(table);
        console.log("📥 Bulk insert into temp table done");

        // Merge - use CTE to ensure no duplicates in source
        const mergeResult = await new sql.Request(tx).query(`
        DECLARE @OutputActions TABLE (Action NVARCHAR(10));

        WITH SourceData AS (
            SELECT *,
                   ROW_NUMBER() OVER (
                       PARTITION BY BRANCHID, CALENDER_DATE
                       ORDER BY (SELECT NULL)
                   ) AS rn
            FROM #TempCalender
        )
        MERGE dbo.tblBranchWiseCalender AS target
        USING (SELECT * FROM SourceData WHERE rn = 1) AS src
        ON target.BRANCHID = src.BRANCHID
           AND target.CALENDER_DATE = src.CALENDER_DATE

        WHEN MATCHED THEN
          UPDATE SET
            target.ISNOTWORKINGDAY = src.ISNOTWORKINGDAY,
            target.NOTWORKINGDAYDESC = src.NOTWORKINGDAYDESC,
            target.IsArchived = src.IsArchived

        WHEN NOT MATCHED THEN
          INSERT (
            BRANCHID,
            CALENDER_DATE,
            ISNOTWORKINGDAY,
            NOTWORKINGDAYDESC,
            IsArchived
          )
          VALUES (
            src.BRANCHID,
            src.CALENDER_DATE,
            src.ISNOTWORKINGDAY,
            src.NOTWORKINGDAYDESC,
            src.IsArchived
          )

        OUTPUT $action INTO @OutputActions;

        SELECT
          SUM(CASE WHEN Action = 'INSERT' THEN 1 ELSE 0 END) AS InsertedCount,
          SUM(CASE WHEN Action = 'UPDATE' THEN 1 ELSE 0 END) AS UpdatedCount
        FROM @OutputActions;
    `);

        const insertedCount = Number(mergeResult?.recordset?.[0]?.InsertedCount ?? 0);
        const updatedCount = Number(mergeResult?.recordset?.[0]?.UpdatedCount ?? 0);

        console.log(`🧾 Merge completed. Inserted: ${insertedCount}, Updated: ${updatedCount}`);

        return {
            inserted: insertedCount,
            updated: updatedCount
        };
    }

    /* =========================
       HELPERS
    ========================== */

    async resolveBranchId(tx, branchVal) {
        if (/^\d+$/.test(branchVal)) return Number(branchVal);

        const r = await new sql.Request(tx)
            .input("name", sql.NVarChar(100), branchVal)
            .query(`
        SELECT TOP 1 BranchID
        FROM dbo.tblBranch
        WHERE BranchName = @name
      `);

        return r?.recordset?.[0]?.BranchID ?? null;
    }

    cleanStr(v) {
        const s = String(v ?? "").trim();
        return s ? s : null;
    }

    parse01(v) {
        const n = Number(v);
        return n === 0 || n === 1 ? n : null;
    }

    parseDateOnly(val) {
        const dt = new Date(val);
        if (isNaN(dt)) return null;
        return new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
    }

    toYMD(d) {
        const dt = new Date(d);
        return dt.toISOString().split("T")[0];
    }
}

export const branchWiseCalenderService = new BranchWiseCalenderService();