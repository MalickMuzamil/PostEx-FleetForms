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

        if (isArchivedRaw === "" || isArchivedRaw == null) reasons.push("IsArchived is required");
        else {
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

        // ✅ duplicate check inside the file (EMP_ID + DATE)
        const keyMap = new Map();
        validRows.forEach((r) => {
            const k = `${r.empId}|${r.date}`;
            const arr = keyMap.get(k) ?? [];
            arr.push(r);
            keyMap.set(k, arr);
        });

        keyMap.forEach((arr) => {
            if (arr.length > 1) {
                arr.forEach((r) => {
                    invalidRows.push({
                        rowNo: r.rowNo,
                        empId: r.empId,
                        date: r.date,
                        reasons: ["Duplicate in file: EMP_ID + DATE must be unique"],
                        isValid: false,
                    });
                });
            }
        });

        return { invalidRows };
    }

    /* =========================
       BULK IMPORT (OVERRIDE)
       - if exists (EMP_ID + DATE) => UPDATE
       - else INSERT
       - no unique index required
    ========================== */
    async bulkImport({ payloads = [] } = {}) {
        if (!Array.isArray(payloads) || payloads.length === 0) {
            const err = new Error("payloads array is required.");
            err.code = "VALIDATION_ERROR";
            throw err;
        }

        // ✅ 1) validate first
        const { invalidRows } = await this.validateBulk(payloads);
        if (invalidRows.length) {
            const err = new Error("Validation failed for one or more rows.");
            err.code = "BULK_VALIDATION_FAILED";
            err.invalidRows = invalidRows;
            throw err;
        }

        // ✅ 2) normalize payloads for DB (handles lower+UPPER keys)
        const normalized = payloads.map((p) => ({
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

        // extra safety: SR_NO null na ho
        for (const r of normalized) {
            if (!r.SR_NO) {
                const err = new Error("SR_NO is required (srNo missing in payload).");
                err.code = "VALIDATION_ERROR";
                throw err;
            }
        }

        const pool = await getPool();
        const tx = new sql.Transaction(pool);

        try {
            await tx.begin();

            // ✅ temp table (SR_NO NOT NULL because DB also NOT NULL)
            await new sql.Request(tx).batch(`
      IF OBJECT_ID('tempdb..#AttendanceBulk') IS NOT NULL DROP TABLE #AttendanceBulk;

      CREATE TABLE #AttendanceBulk (
        SR_NO int NOT NULL,
        EMP_ID int NOT NULL,
        EMP_NAME varchar(200) NULL,
        DESIGNATION varchar(200) NULL,
        DIVISION varchar(200) NULL,
        ZONE varchar(200) NULL,
        BRANCH varchar(200) NULL,
        DEPARTMENT varchar(200) NULL,
        [FUNCTION] varchar(200) NULL,
        AREA varchar(200) NULL,
        SHIFT varchar(100) NULL,
        SHIFT_TIME varchar(100) NULL,
        [DATE] date NOT NULL,
        IN_DATE date NULL,
        OUT_DATE date NULL,
        IN_TIME varchar(10) NOT NULL,
        OUT_TIME varchar(10) NOT NULL,
        TOTAL_TIME varchar(50) NULL,
        TIMETRAX_REMARKS varchar(500) NULL,
        IsArchived bit NOT NULL
      );
    `);

            // ✅ bulk into temp
            const table = new sql.Table("#AttendanceBulk");
            table.create = false;

            table.columns.add("SR_NO", sql.Int, { nullable: false });
            table.columns.add("EMP_ID", sql.Int, { nullable: false });
            table.columns.add("EMP_NAME", sql.VarChar(200), { nullable: true });
            table.columns.add("DESIGNATION", sql.VarChar(200), { nullable: true });
            table.columns.add("DIVISION", sql.VarChar(200), { nullable: true });
            table.columns.add("ZONE", sql.VarChar(200), { nullable: true });
            table.columns.add("BRANCH", sql.VarChar(200), { nullable: true });
            table.columns.add("DEPARTMENT", sql.VarChar(200), { nullable: true });
            table.columns.add("FUNCTION", sql.VarChar(200), { nullable: true });
            table.columns.add("AREA", sql.VarChar(200), { nullable: true });
            table.columns.add("SHIFT", sql.VarChar(100), { nullable: true });
            table.columns.add("SHIFT_TIME", sql.VarChar(100), { nullable: true });
            table.columns.add("DATE", sql.Date, { nullable: false });
            table.columns.add("IN_DATE", sql.Date, { nullable: true });
            table.columns.add("OUT_DATE", sql.Date, { nullable: true });
            table.columns.add("IN_TIME", sql.VarChar(10), { nullable: false });
            table.columns.add("OUT_TIME", sql.VarChar(10), { nullable: false });
            table.columns.add("TOTAL_TIME", sql.VarChar(50), { nullable: true });
            table.columns.add("TIMETRAX_REMARKS", sql.VarChar(500), { nullable: true });
            table.columns.add("IsArchived", sql.Bit, { nullable: false });

            for (const r of normalized) {
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
                    r.IsArchived ? 1 : 0
                );
            }

            await new sql.Request(tx).bulk(table);

            // ✅ 1) UPDATE existing rows (override)  (SR_NO null se overwrite nahi hoga)
            const upd = await new sql.Request(tx).query(`
      UPDATE T
        SET
          T.SR_NO = COALESCE(S.SR_NO, T.SR_NO),
          T.EMP_NAME = S.EMP_NAME,
          T.DESIGNATION = S.DESIGNATION,
          T.DIVISION = S.DIVISION,
          T.ZONE = S.ZONE,
          T.BRANCH = S.BRANCH,
          T.DEPARTMENT = S.DEPARTMENT,
          T.[FUNCTION] = S.[FUNCTION],
          T.AREA = S.AREA,
          T.SHIFT = S.SHIFT,
          T.SHIFT_TIME = S.SHIFT_TIME,
          T.IN_DATE = S.IN_DATE,
          T.OUT_DATE = S.OUT_DATE,
          T.IN_TIME = S.IN_TIME,
          T.OUT_TIME = S.OUT_TIME,
          T.TOTAL_TIME = S.TOTAL_TIME,
          T.TIMETRAX_REMARKS = S.TIMETRAX_REMARKS,
          T.IsArchived = S.IsArchived
      FROM dbo.DAILY_ATTENDANCE_REPORT T
      INNER JOIN #AttendanceBulk S
        ON T.EMP_ID = S.EMP_ID
       AND CAST(T.[DATE] AS date) = CAST(S.[DATE] AS date);

      SELECT @@ROWCOUNT AS UpdatedCount;
    `);

            const updated = Number(upd?.recordset?.[0]?.UpdatedCount ?? 0);

            // ✅ 2) INSERT only missing keys (EMP_ID + DATE)
            const ins = await new sql.Request(tx).query(`
      INSERT INTO dbo.DAILY_ATTENDANCE_REPORT (
        SR_NO, EMP_ID, EMP_NAME, DESIGNATION, DIVISION, ZONE, BRANCH, DEPARTMENT,
        [FUNCTION], AREA, SHIFT, SHIFT_TIME, [DATE], IN_DATE, OUT_DATE,
        IN_TIME, OUT_TIME, TOTAL_TIME, TIMETRAX_REMARKS, IsArchived
      )
      SELECT
        S.SR_NO, S.EMP_ID, S.EMP_NAME, S.DESIGNATION, S.DIVISION, S.ZONE, S.BRANCH, S.DEPARTMENT,
        S.[FUNCTION], S.AREA, S.SHIFT, S.SHIFT_TIME, S.[DATE], S.IN_DATE, S.OUT_DATE,
        S.IN_TIME, S.OUT_TIME, S.TOTAL_TIME, S.TIMETRAX_REMARKS, S.IsArchived
      FROM #AttendanceBulk S
      WHERE NOT EXISTS (
        SELECT 1
        FROM dbo.DAILY_ATTENDANCE_REPORT T
        WHERE T.EMP_ID = S.EMP_ID
          AND CAST(T.[DATE] AS date) = CAST(S.[DATE] AS date)
      );

      SELECT @@ROWCOUNT AS InsertedCount;
    `);

            const inserted = Number(ins?.recordset?.[0]?.InsertedCount ?? 0);

            await tx.commit();
            return { inserted, updated };
        } catch (err) {
            try { await tx.rollback(); } catch { }
            throw err;
        }
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