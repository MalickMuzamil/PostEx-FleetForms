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

            await new sql.Request(tx).batch(`
        IF OBJECT_ID('tempdb..#TempCalender') IS NOT NULL
          DROP TABLE #TempCalender;

        CREATE TABLE #TempCalender (
          BRANCHID INT NOT NULL,
          CALENDER_DATE DATE NOT NULL,
          ISNOTWORKINGDAY BIT NOT NULL,
          NOTWORKINGDAYDESC NVARCHAR(200) NOT NULL,
          IsArchived BIT NOT NULL
        );
      `);

            const table = new sql.Table("#TempCalender");
            table.create = false;

            table.columns.add("BRANCHID", sql.Int, { nullable: false });
            table.columns.add("CALENDER_DATE", sql.Date, { nullable: false });
            table.columns.add("ISNOTWORKINGDAY", sql.Bit, { nullable: false });
            table.columns.add("NOTWORKINGDAYDESC", sql.NVarChar(200), { nullable: false });
            table.columns.add("IsArchived", sql.Bit, { nullable: false });

            for (const p of payloads) {

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

                table.rows.add(
                    branchId,
                    calDate,
                    isNotWorkingDay,
                    desc,
                    isArchived
                );
            }

            await new sql.Request(tx).bulk(table);

            // 🔁 UPDATE only if data changed
            const upd = await new sql.Request(tx).query(`
        UPDATE T
        SET
          T.ISNOTWORKINGDAY = S.ISNOTWORKINGDAY,
          T.NOTWORKINGDAYDESC = S.NOTWORKINGDAYDESC,
          T.IsArchived = S.IsArchived
        FROM dbo.tblBranchWiseCalender T
        INNER JOIN #TempCalender S
          ON T.BRANCHID = S.BRANCHID
          AND T.CALENDER_DATE = S.CALENDER_DATE
        WHERE
          T.ISNOTWORKINGDAY <> S.ISNOTWORKINGDAY
          OR T.NOTWORKINGDAYDESC <> S.NOTWORKINGDAYDESC
          OR T.IsArchived <> S.IsArchived;

        SELECT @@ROWCOUNT AS UpdatedCount;
      `);

            const updated = upd.recordset[0]?.UpdatedCount ?? 0;

            // ➕ INSERT if not exists (TRAN_ID auto generated)
            const ins = await new sql.Request(tx).query(`
        INSERT INTO dbo.tblBranchWiseCalender (
          BRANCHID, CALENDER_DATE, ISNOTWORKINGDAY, NOTWORKINGDAYDESC, IsArchived
        )
        SELECT
          S.BRANCHID, S.CALENDER_DATE, S.ISNOTWORKINGDAY, S.NOTWORKINGDAYDESC, S.IsArchived
        FROM #TempCalender S
        WHERE NOT EXISTS (
          SELECT 1
          FROM dbo.tblBranchWiseCalender T
          WHERE T.BRANCHID = S.BRANCHID
            AND T.CALENDER_DATE = S.CALENDER_DATE
        );

        SELECT @@ROWCOUNT AS InsertedCount;
      `);

            const inserted = ins.recordset[0]?.InsertedCount ?? 0;

            await tx.commit();

            return {
                inserted,
                updated,
                skipped: payloads.length - inserted - updated
            };

        } catch (err) {
            await tx.rollback();
            throw err;
        }
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