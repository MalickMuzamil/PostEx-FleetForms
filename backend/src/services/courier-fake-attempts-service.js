import sql from "mssql";
import { getPool } from "../config/sql-config.js";

class CourierFakeAttemptsService {
    /* =========================
       LIST
    ========================== */
    async list({ top = 10000 } = {}) {
        const pool = await getPool();
        const request = pool.request();
        request.input("top", sql.Int, Number(top) || 10000);

        const result = await request.query(`
      SELECT TOP (@top)
        CNNo,
        BranchName,
        Attempts,
        CourierID,
        Rider,
        Fake_Attempts,
        CAST([Date] AS date) AS [Date],
        IsArchived,
        CreatedBy,
        CreatedOn
      FROM dbo.CourierFakeAttempts
      ORDER BY CreatedOn DESC, CNNo ASC;
    `);

        return result.recordset;
    }

    /* =========================
       VALIDATION (BULK)
       - returns invalidRows for frontend preview
    ========================== */
    validateRow(row, index = 0) {
        const reasons = [];

        const cnNo = this.cleanStr(row?.CNNo ?? row?.cnNo);
        const branchName = this.cleanStr(row?.BranchName ?? row?.branchName);
        const rider = this.cleanStr(row?.Rider ?? row?.rider);

        const attemptsRaw = row?.Attempts ?? row?.attempts;
        const courierRaw = row?.CourierID ?? row?.courierId;
        const fakeRaw = row?.Fake_Attempts ?? row?.fakeAttempts ?? row?.FAKE_ATTEMPTS;

        const dateRaw = row?.Date ?? row?.DATE ?? row?.date;
        const createdByRaw = row?.CreatedBy ?? row?.createdBy;

        // ---- required strings (frontend: max 20 chars)
        if (!cnNo) reasons.push("CNNo is required");
        else if (cnNo.length > 20) reasons.push("CNNo max 20 characters");

        if (!branchName) reasons.push("BranchName is required");
        else if (branchName.length > 20) reasons.push("BranchName max 20 characters");

        if (!rider) reasons.push("Rider is required");
        else if (rider.length > 50) reasons.push("Rider max 50 characters");

        // ---- Attempts (tinyint 0-255)
        const attempts = this.toTinyIntOrNull(attemptsRaw);
        if (attemptsRaw === "" || attemptsRaw == null) reasons.push("Attempts is required");
        else if (attempts === null) reasons.push("Attempts must be numeric (0-255)");

        // ---- CourierID (int)  C004 -> 4
        const courierId = this.normalizeCourierId(courierRaw);
        if (courierRaw === "" || courierRaw == null) reasons.push("CourierID is required");
        else if (courierId === null) reasons.push("CourierID must be numeric (e.g. 4 or C004)");

        // ---- Fake_Attempts (nvarchar in DB, but must not be empty; optionally numeric)
        const fakeStr = String(fakeRaw ?? "").trim();
        if (fakeRaw === "" || fakeRaw == null) reasons.push("Fake_Attempts is required");
        else if (!fakeStr) reasons.push("Fake_Attempts is required");
        else {
            // optional: numeric check (tumhare frontend me numeric hai)
            const n = Number(fakeStr);
            if (!Number.isFinite(n)) reasons.push("Fake_Attempts must be numeric");
        }

        // ---- Date (date)
        const date = this.parseDateOnly(dateRaw);
        if (!date) reasons.push("Date is invalid (expected yyyy-mm-dd)");

        // ---- CreatedBy (Admin/User) - optional input; if provided must match
        let createdBy = null;
        if (createdByRaw === "" || createdByRaw == null) {
            createdBy = "CS"; // default
        } else {
            createdBy = this.normalizeCreatedBy(createdByRaw);
            if (!createdBy) reasons.push("CreatedBy must be Admin or CS");
        }

        return {
            rowNo: index + 1,
            cnNo,
            courierId,
            date: date ? this.toYMD(date) : null,
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
        const validRows = [];

        payloads.forEach((p, idx) => {
            const v = this.validateRow(p, idx);
            if (!v.isValid) invalidRows.push(v);
            else validRows.push(v);
        });

        return { invalidRows };
    }

    /* =========================
       BULK IMPORT (UPSERT)
       - override by (CNNo + CourierID + Date)
    ========================== */
    async bulkImport({ payloads } = {}) {
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
            const err = new Error("Bulk validation failed.");
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
        const normalized = batch.map((p) => ({
            CNNo: this.cleanStr(p.CNNo ?? p.cnNo),
            BranchName: this.cleanStr(p.BranchName ?? p.branchName),
            Attempts: this.toTinyIntOrNull(p.Attempts ?? p.attempts),
            CourierID: this.normalizeCourierId(p.CourierID ?? p.courierId),
            Rider: this.cleanStr(p.Rider ?? p.rider),
            Fake_Attempts: String(p.Fake_Attempts ?? p.fakeAttempts ?? p.FAKE_ATTEMPTS ?? "").trim(),
            Date: this.parseDateOnly(p.Date ?? p.date ?? p.DATE),
            IsArchived: 0,
            CreatedBy: this.normalizeCreatedBy(p.CreatedBy ?? p.createdBy) || "User",
        }));

        // Deduplicate - ensure unique by primary key (CNNo + CourierID + Date)
        const deduped = new Map();
        for (const row of normalized) {
            // Normalize key components to ensure consistency
            const cnNo = String(row.CNNo || '').trim().toLowerCase();
            const courierId = String(row.CourierID || '').trim().toLowerCase();
            const dateStr = this.toYMD(row.Date) || '';

            const key = `${cnNo}|${courierId}|${dateStr}`;
            deduped.set(key, row); // Keep the last occurrence (latest data)
        }

        const uniqueBatch = Array.from(deduped.values());
        console.log(`🧹 After dedupe: ${uniqueBatch.length} (from ${normalized.length})`);

        // Temp table
        const table = new sql.Table('#CourierFakeBulk');
        table.create = true;

        table.columns.add('CNNo', sql.VarChar(20), { nullable: false });
        table.columns.add('BranchName', sql.NVarChar(100), { nullable: false });
        table.columns.add('Attempts', sql.TinyInt, { nullable: false });
        table.columns.add('CourierID', sql.Int, { nullable: false });
        table.columns.add('Rider', sql.NVarChar(100), { nullable: false });
        table.columns.add('Fake_Attempts', sql.NVarChar(50), { nullable: false });
        table.columns.add('Date', sql.Date, { nullable: false });
        table.columns.add('IsArchived', sql.Bit, { nullable: false });
        table.columns.add('CreatedBy', sql.VarChar(10), { nullable: false });

        for (const r of uniqueBatch) {
            table.rows.add(
                r.CNNo,
                r.BranchName,
                r.Attempts,
                r.CourierID,
                r.Rider,
                r.Fake_Attempts,
                r.Date,
                r.IsArchived,
                r.CreatedBy
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
                       PARTITION BY CNNo, CourierID, [Date]
                       ORDER BY (SELECT NULL)
                   ) AS rn
            FROM #CourierFakeBulk
        )
        MERGE dbo.CourierFakeAttempts AS target
        USING (SELECT * FROM SourceData WHERE rn = 1) AS src
        ON target.CNNo = src.CNNo
           AND target.CourierID = src.CourierID
           AND target.[Date] = src.[Date]

        WHEN MATCHED THEN
          UPDATE SET
            target.BranchName = src.BranchName,
            target.Attempts = src.Attempts,
            target.Rider = src.Rider,
            target.Fake_Attempts = src.Fake_Attempts,
            target.IsArchived = src.IsArchived,
            target.CreatedBy = src.CreatedBy,
            target.CreatedOn = GETDATE()

        WHEN NOT MATCHED THEN
          INSERT (
            CNNo,
            BranchName,
            Attempts,
            CourierID,
            Rider,
            Fake_Attempts,
            [Date],
            IsArchived,
            CreatedBy,
            CreatedOn
          )
          VALUES (
            src.CNNo,
            src.BranchName,
            src.Attempts,
            src.CourierID,
            src.Rider,
            src.Fake_Attempts,
            src.[Date],
            src.IsArchived,
            src.CreatedBy,
            GETDATE()
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
    cleanStr(v) {
        const s = String(v ?? "").trim();
        return s ? s : null;
    }

    // tinyint: 0..255
    toTinyIntOrNull(v) {
        const s = String(v ?? "").trim();
        if (s === "") return null;
        const n = Number(s);
        if (!Number.isFinite(n)) return null;
        const x = Math.trunc(n);
        if (x < 0 || x > 255) return null;
        return x;
    }

    parseDateOnly(val) {
        if (!val) return null;

        if (val instanceof Date && !isNaN(val.getTime())) {
            return new Date(Date.UTC(val.getFullYear(), val.getMonth(), val.getDate()));
        }

        const s = String(val).trim();
        if (!s) return null;

        // yyyy-mm-dd
        const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (iso) {
            const y = +iso[1], m = +iso[2], d = +iso[3];
            const dt = new Date(Date.UTC(y, m - 1, d));
            return isNaN(dt.getTime()) ? null : dt;
        }

        const dt = new Date(s);
        if (isNaN(dt.getTime())) return null;
        return new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
    }

    toYMD(d) {
        const dt = new Date(d);
        const y = dt.getUTCFullYear();
        const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
        const day = String(dt.getUTCDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    }

    normalizeCreatedBy(v) {
        const s = String(v ?? "").trim().toLowerCase();
        if (s === "admin") return "Admin";
        if (s === "cs") return "CS";
        return null;
    }

    // CourierID int in DB:
    // "C004" -> 4, "4" -> 4
    normalizeCourierId(val) {
        const s = String(val ?? "").trim();
        if (!s) return null;
        const m = s.match(/(\d+)/);
        return m ? Number(m[1]) : null;
    }
}

export const courierFakeAttemptsService = new CourierFakeAttemptsService();