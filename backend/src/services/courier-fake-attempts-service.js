import sql from "mssql";
import { getPool } from "../config/sql-config.js";

class CourierFakeAttemptsService {
    /* =========================
       LIST
    ========================== */
    async list({ top = 500 } = {}) {
        const pool = await getPool();
        const request = pool.request();
        request.input("top", sql.Int, Number(top) || 500);

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
      ORDER BY CAST([Date] AS date) DESC, CNNo ASC;
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
        const isArchivedRaw = row?.IsArchived ?? row?.isArchived;

        const createdByRaw = row?.CreatedBy ?? row?.createdBy;

        // ---- required strings (frontend: max 20 chars)
        if (!cnNo) reasons.push("CNNo is required");
        else if (cnNo.length > 20) reasons.push("CNNo max 20 characters");

        if (!branchName) reasons.push("BranchName is required");
        else if (branchName.length > 20) reasons.push("BranchName max 20 characters");

        if (!rider) reasons.push("Rider is required");
        else if (rider.length > 20) reasons.push("Rider max 20 characters");

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

        // ---- IsArchived (bit) 0/1
        if (isArchivedRaw === "" || isArchivedRaw == null) reasons.push("IsArchived is required");
        else {
            const n = Number(isArchivedRaw);
            if (!(n === 0 || n === 1)) reasons.push("IsArchived must be 0 or 1");
        }

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

        // ✅ duplicate inside file: CNNo + Date
        const keyMap = new Map();
        validRows.forEach((r) => {
            const k = `${r.cnNo}|${r.courierId}|${r.date}`;
            const arr = keyMap.get(k) ?? [];
            arr.push(r);
            keyMap.set(k, arr);
        });

        keyMap.forEach((arr) => {
            if (arr.length > 1) {
                arr.forEach((r) => {
                    invalidRows.push({
                        rowNo: r.rowNo,
                        cnNo: r.cnNo,
                        courierId: r.courierId,
                        date: r.date,
                        reasons: ["Duplicate in file: CNNo + CourierID + Date must be unique"],
                        isValid: false,
                    });
                });
            }
        });

        return { invalidRows };
    }

    /* =========================
       BULK IMPORT (UPSERT)
       - if exists (CNNo + Date) => UPDATE
       - else INSERT
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

        // ✅ 2) normalize payloads for DB schema
        const normalized = payloads.map((p) => ({
            CNNo: this.cleanStr(p.CNNo ?? p.cnNo),
            BranchName: this.cleanStr(p.BranchName ?? p.branchName),

            Attempts: this.toTinyIntOrNull(p.Attempts ?? p.attempts),
            CourierID: this.normalizeCourierId(p.CourierID ?? p.courierId),

            Rider: this.cleanStr(p.Rider ?? p.rider),

            // DB: nvarchar
            Fake_Attempts: String(p.Fake_Attempts ?? p.fakeAttempts ?? p.FAKE_ATTEMPTS ?? "").trim(),

            Date: this.parseDateOnly(p.Date ?? p.date ?? p.DATE),

            IsArchived: Number(p.IsArchived ?? p.isArchived) === 1 ? 1 : 0,

            CreatedBy: this.normalizeCreatedBy(p.CreatedBy ?? p.createdBy) || "User",
        }));

        const pool = await getPool();
        const tx = new sql.Transaction(pool);

        try {
            await tx.begin();

            // ✅ temp table matches your DB schema types
            await new sql.Request(tx).batch(`
        IF OBJECT_ID('tempdb..#CourierFakeBulk') IS NOT NULL DROP TABLE #CourierFakeBulk;

        CREATE TABLE #CourierFakeBulk (
          CNNo varchar(20) NOT NULL,
          BranchName nvarchar(100) NOT NULL,
          Attempts tinyint NOT NULL,
          CourierID int NOT NULL,
          Rider nvarchar(100) NOT NULL,
          Fake_Attempts nvarchar(50) NOT NULL,
          [Date] date NOT NULL,
          IsArchived bit NOT NULL,
          CreatedBy varchar(10) NOT NULL
        );
      `);

            // ✅ bulk into temp
            const table = new sql.Table("#CourierFakeBulk");
            table.create = false;

            table.columns.add("CNNo", sql.VarChar(20), { nullable: false });
            table.columns.add("BranchName", sql.NVarChar(100), { nullable: false });
            table.columns.add("Attempts", sql.TinyInt, { nullable: false });
            table.columns.add("CourierID", sql.Int, { nullable: false });
            table.columns.add("Rider", sql.NVarChar(100), { nullable: false });
            table.columns.add("Fake_Attempts", sql.NVarChar(50), { nullable: false });
            table.columns.add("Date", sql.Date, { nullable: false });
            table.columns.add("IsArchived", sql.Bit, { nullable: false });
            table.columns.add("CreatedBy", sql.VarChar(10), { nullable: false });

            for (const r of normalized) {
                // safety guards (avoid "Invalid string.")
                if (!r.CNNo || !r.BranchName || !r.Rider || !r.Fake_Attempts || !r.Date) {
                    const err = new Error("One or more required fields are missing/invalid.");
                    err.code = "VALIDATION_ERROR";
                    throw err;
                }
                if (r.Attempts == null) {
                    const err = new Error("Attempts invalid (expected 0-255).");
                    err.code = "VALIDATION_ERROR";
                    throw err;
                }
                if (r.CourierID == null) {
                    const err = new Error("CourierID invalid (expected 4 or C004).");
                    err.code = "VALIDATION_ERROR";
                    throw err;
                }

                table.rows.add(
                    r.CNNo,
                    r.BranchName,
                    r.Attempts,
                    r.CourierID,
                    r.Rider,
                    r.Fake_Attempts,
                    r.Date,
                    r.IsArchived ? 1 : 0,
                    r.CreatedBy
                );
            }

            await new sql.Request(tx).bulk(table);

            // ✅ UPDATE existing (CNNo + Date)
            const upd = await new sql.Request(tx).query(`
        UPDATE T
          SET
            T.BranchName = S.BranchName,
            T.Attempts = S.Attempts,
            T.CourierID = S.CourierID,
            T.Rider = S.Rider,
            T.Fake_Attempts = S.Fake_Attempts,
            T.IsArchived = S.IsArchived,
            T.CreatedBy = S.CreatedBy,
            T.CreatedOn = GETDATE()
        FROM dbo.CourierFakeAttempts T
        INNER JOIN #CourierFakeBulk S
          ON T.CNNo = S.CNNo
            AND T.CourierID = S.CourierID
            AND CAST(T.[Date] AS date) = CAST(S.[Date] AS date);

        SELECT @@ROWCOUNT AS UpdatedCount;
      `);

            const updated = Number(upd?.recordset?.[0]?.UpdatedCount ?? 0);

            // ✅ INSERT missing
            const ins = await new sql.Request(tx).query(`
        INSERT INTO dbo.CourierFakeAttempts (
          CNNo, BranchName, Attempts, CourierID, Rider, Fake_Attempts,
          [Date], IsArchived, CreatedBy, CreatedOn
        )
        SELECT
          S.CNNo, S.BranchName, S.Attempts, S.CourierID, S.Rider, S.Fake_Attempts,
          S.[Date], S.IsArchived, S.CreatedBy, GETDATE()
        FROM #CourierFakeBulk S
        WHERE NOT EXISTS (
          SELECT 1
          FROM dbo.CourierFakeAttempts T
          WHERE T.CNNo = S.CNNo
            AND T.CourierID = S.CourierID
            AND CAST(T.[Date] AS date) = CAST(S.[Date] AS date)
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