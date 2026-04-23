import sql from "mssql";
import { getPool } from "../config/sql-config.js";

class AttendanceService {
    /* =========================
       LIST
    ========================== */
    async listAttendance({ top = 500 } = {}) {
        const pool = await getPool();
        const request = pool.request();
        request.input("top", sql.Int, Number(top) || 500);

        const result = await request.query(`
      SELECT TOP (@top)
        SR_NO,
        EMP_ID,
        EMP_NAME,
        DESIGNATION,
        DIVISION,
        ZONE,
        BRANCH,
        DEPARTMENT,
        [FUNCTION],
        AREA,
        SHIFT,
        SHIFT_TIME,
        CAST([DATE] AS date) AS [DATE],
        CAST(IN_DATE AS date) AS IN_DATE,
        CAST(OUT_DATE AS date) AS OUT_DATE,
        IN_TIME,
        OUT_TIME,
        TOTAL_TIME,
        TIMETRAX_REMARKS,
        IsArchived
      FROM dbo.DAILY_ATTENDANCE_REPORT
      ORDER BY CAST([DATE] AS date) DESC, EMP_ID ASC;
    `);

        return result.recordset;
    }

    /* =========================
       VALIDATION (BULK)
       - returns invalidRows for frontend preview
    ========================== */
    validateRow(row, index = 0) {
        const reasons = [];

        const empId = this.normalizeEmpId(row?.EMP_ID ?? row?.empId);
        if (!empId) reasons.push("EMP_ID must be numeric (1001 or E1001)");
        const dateRaw = row?.DATE ?? row?.date;

        const inTime = String(row?.IN_TIME ?? row?.inTime ?? "").trim();
        const outTime = String(row?.OUT_TIME ?? row?.outTime ?? "").trim();

        const isArchivedRaw = row?.IsArchived ?? row?.isArchived;

        if (!empId) reasons.push("EMP_ID is required");

        const date = this.parseDateOnly(dateRaw);
        if (!date) reasons.push("DATE is invalid (expected yyyy-mm-dd)");

        if (!inTime) reasons.push("IN_TIME is required");
        else if (!this.isValidHHmm(inTime)) reasons.push("IN_TIME must be HH:mm");

        if (!outTime) reasons.push("OUT_TIME is required");
        else if (!this.isValidHHmm(outTime)) reasons.push("OUT_TIME must be HH:mm");

        if (isArchivedRaw != null && String(isArchivedRaw).trim() !== "") {
            const n = Number(isArchivedRaw);
            if (!(n === 0 || n === 1)) reasons.push("IsArchived must be 0 or 1");
        }

        return {
            rowNo: index + 1,
            empId,
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
       - override by (EMP_ID + DATE)
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
            SR_NO: Number(p.SR_NO ?? p.srNo ?? 0) || null,
            EMP_ID: this.normalizeEmpId(p.EMP_ID ?? p.empId),
            EMP_NAME: String(p.EMP_NAME ?? p.empName ?? "").trim() || null,
            DESIGNATION: String(p.DESIGNATION ?? p.designation ?? "").trim() || null,
            DIVISION: String(p.DIVISION ?? p.division ?? "").trim() || null,
            ZONE: String(p.ZONE ?? p.zone ?? "").trim() || null,
            BRANCH: String(p.BRANCH ?? p.branch ?? "").trim() || null,
            DEPARTMENT: String(p.DEPARTMENT ?? p.department ?? "").trim() || null,
            FUNCTION: String(p.FUNCTION ?? p["FUNCTION"] ?? p.function ?? "").trim() || null,
            AREA: String(p.AREA ?? p.area ?? "").trim() || null,
            SHIFT: String(p.SHIFT ?? p.shift ?? "").trim() || null,
            SHIFT_TIME: String(p.SHIFT_TIME ?? p.shiftTime ?? p.shift_time ?? "").trim() || null,
            DATE: this.parseDateOnly(p.DATE ?? p.date),
            IN_DATE: this.parseDateOnly(p.IN_DATE ?? p.inDate) || this.parseDateOnly(p.DATE ?? p.date),
            OUT_DATE: this.parseDateOnly(p.OUT_DATE ?? p.outDate) || this.parseDateOnly(p.DATE ?? p.date),
            IN_TIME: String(p.IN_TIME ?? p.inTime ?? "").trim(),
            OUT_TIME: String(p.OUT_TIME ?? p.outTime ?? "").trim(),
            TOTAL_TIME: String(p.TOTAL_TIME ?? p.totalTime ?? "").trim() || null,
            TIMETRAX_REMARKS: String(p.TIMETRAX_REMARKS ?? p.remarks ?? "").trim() || null,
            IsArchived: Number(p.IsArchived ?? p.isArchived ?? 0) === 1 ? 1 : 0,
        }));

        // Deduplicate - ensure unique by primary key (EMP_ID + DATE)
        const deduped = new Map();
        for (const row of normalized) {
            // Normalize key components to ensure consistency
            const empId = String(row.EMP_ID || '').trim().toLowerCase();
            const dateStr = this.toYMD(row.DATE) || '';

            const key = `${empId}|${dateStr}`;
            deduped.set(key, row); // Keep the last occurrence (latest data)
        }

        const uniqueBatch = Array.from(deduped.values());
        console.log(`🧹 After dedupe: ${uniqueBatch.length} (from ${normalized.length})`);

        // Temp table
        const table = new sql.Table('#AttendanceBulk');
        table.create = true;

        table.columns.add('SR_NO', sql.Int, { nullable: false });
        table.columns.add('EMP_ID', sql.Int, { nullable: false });
        table.columns.add('EMP_NAME', sql.VarChar(200), { nullable: true });
        table.columns.add('DESIGNATION', sql.VarChar(200), { nullable: true });
        table.columns.add('DIVISION', sql.VarChar(200), { nullable: true });
        table.columns.add('ZONE', sql.VarChar(200), { nullable: true });
        table.columns.add('BRANCH', sql.VarChar(200), { nullable: true });
        table.columns.add('DEPARTMENT', sql.VarChar(200), { nullable: true });
        table.columns.add('FUNCTION', sql.VarChar(200), { nullable: true });
        table.columns.add('AREA', sql.VarChar(200), { nullable: true });
        table.columns.add('SHIFT', sql.VarChar(100), { nullable: true });
        table.columns.add('SHIFT_TIME', sql.VarChar(100), { nullable: true });
        table.columns.add('DATE', sql.Date, { nullable: false });
        table.columns.add('IN_DATE', sql.Date, { nullable: true });
        table.columns.add('OUT_DATE', sql.Date, { nullable: true });
        table.columns.add('IN_TIME', sql.VarChar(10), { nullable: false });
        table.columns.add('OUT_TIME', sql.VarChar(10), { nullable: false });
        table.columns.add('TOTAL_TIME', sql.VarChar(50), { nullable: true });
        table.columns.add('TIMETRAX_REMARKS', sql.VarChar(500), { nullable: true });
        table.columns.add('IsArchived', sql.Bit, { nullable: false });

        for (const r of uniqueBatch) {
            table.rows.add(
                r.SR_NO,
                r.EMP_ID,
                r.EMP_NAME,
                r.DESIGNATION,
                r.DIVISION,
                r.ZONE,
                r.BRANCH,
                r.DEPARTMENT,
                r.FUNCTION,
                r.AREA,
                r.SHIFT,
                r.SHIFT_TIME,
                r.DATE,
                r.IN_DATE,
                r.OUT_DATE,
                r.IN_TIME,
                r.OUT_TIME,
                r.TOTAL_TIME,
                r.TIMETRAX_REMARKS,
                r.IsArchived
            );
        }

        // Bulk insert temp table
        const bulkRequest = new sql.Request(tx);
        bulkRequest.timeout = 300000; // 5 min timeout for bulk insert
        await bulkRequest.bulk(table);
        console.log("📥 Bulk insert into temp table done");

        // Merge - use CTE to ensure no duplicates in source
        const mergeRequest = new sql.Request(tx);
        mergeRequest.timeout = 300000;
        const mergeResult = await mergeRequest.query(`
        DECLARE @OutputActions TABLE (Action NVARCHAR(10));

        WITH SourceData AS (
            SELECT *,
                   ROW_NUMBER() OVER (
                       PARTITION BY EMP_ID, [DATE]
                       ORDER BY (SELECT NULL)
                   ) AS rn
            FROM #AttendanceBulk
        )
        MERGE dbo.DAILY_ATTENDANCE_REPORT AS target
        USING (SELECT * FROM SourceData WHERE rn = 1) AS src
        ON target.EMP_ID = src.EMP_ID
           AND target.[DATE] = src.[DATE]

        WHEN MATCHED THEN
          UPDATE SET
            target.SR_NO = src.SR_NO,
            target.EMP_NAME = src.EMP_NAME,
            target.DESIGNATION = src.DESIGNATION,
            target.DIVISION = src.DIVISION,
            target.ZONE = src.ZONE,
            target.BRANCH = src.BRANCH,
            target.DEPARTMENT = src.DEPARTMENT,
            target.[FUNCTION] = src.[FUNCTION],
            target.AREA = src.AREA,
            target.SHIFT = src.SHIFT,
            target.SHIFT_TIME = src.SHIFT_TIME,
            target.IN_DATE = src.IN_DATE,
            target.OUT_DATE = src.OUT_DATE,
            target.IN_TIME = src.IN_TIME,
            target.OUT_TIME = src.OUT_TIME,
            target.TOTAL_TIME = src.TOTAL_TIME,
            target.TIMETRAX_REMARKS = src.TIMETRAX_REMARKS,
            target.IsArchived = src.IsArchived

        WHEN NOT MATCHED THEN
          INSERT (
            SR_NO,
            EMP_ID,
            EMP_NAME,
            DESIGNATION,
            DIVISION,
            ZONE,
            BRANCH,
            DEPARTMENT,
            [FUNCTION],
            AREA,
            SHIFT,
            SHIFT_TIME,
            [DATE],
            IN_DATE,
            OUT_DATE,
            IN_TIME,
            OUT_TIME,
            TOTAL_TIME,
            TIMETRAX_REMARKS,
            IsArchived
          )
          VALUES (
            src.SR_NO,
            src.EMP_ID,
            src.EMP_NAME,
            src.DESIGNATION,
            src.DIVISION,
            src.ZONE,
            src.BRANCH,
            src.DEPARTMENT,
            src.[FUNCTION],
            src.AREA,
            src.SHIFT,
            src.SHIFT_TIME,
            src.[DATE],
            src.IN_DATE,
            src.OUT_DATE,
            src.IN_TIME,
            src.OUT_TIME,
            src.TOTAL_TIME,
            src.TIMETRAX_REMARKS,
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
    parseDateOnly(val) {
        if (!val) return null;

        // if Date object
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

        // dd/mm/yyyy or dd-mm-yyyy
        const dmY = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
        if (dmY) {
            const dd = +dmY[1], mm = +dmY[2], yyyy = +dmY[3];
            const dt = new Date(Date.UTC(yyyy, mm - 1, dd));
            return isNaN(dt.getTime()) ? null : dt;
        }

        // fallback
        const dt = new Date(s);
        if (isNaN(dt.getTime())) return null;
        return new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
    }

    toYMD(d) {
        const dt = new Date(d);
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, "0");
        const day = String(dt.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    }

    isValidHHmm(v) {
        const s = String(v ?? "").trim();
        
        // HH:mm:ss format (e.g., 09:30:00, 00:00:00)
        const msec = s.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
        if (msec) {
            const hh = Number(msec[1]), mm = Number(msec[2]), ss = Number(msec[3]);
            return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59 && ss >= 0 && ss <= 59;
        }

        // HH:mm format (e.g., 09:30)
        const m = s.match(/^(\d{1,2}):(\d{2})$/);
        if (!m) return false;
        const hh = Number(m[1]), mm = Number(m[2]);
        return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
    }

    normalizeEmpId(val) {
        const s = String(val ?? "").trim();

        if (!s) return null;

        const m = s.match(/^e?(\d+)$/i);
        if (m) return Number(m[1]) || null;

        if (/^\d+$/.test(s)) return Number(s) || null;

        return null;
    }
}

export const attendanceService = new AttendanceService();