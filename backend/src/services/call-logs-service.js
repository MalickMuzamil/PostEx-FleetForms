// services/call-logs-service.js  (UPDATED to mssql + getPool)
// ✅ DUPLICATION CHECK REMOVED (no "Duplicate in request" validation)

import sql from "mssql";
import { getPool } from "../config/sql-config.js";

class CallLogsService {
    /* =========================
       LIST
    ========================== */
    async list({ top } = {}) {
        const limit = Math.min(Number(top || 0) || 0, 20000);
        const topVal = limit || 20000;

        const pool = await getPool();
        const request = pool.request();
        request.input("top", sql.Int, topVal);

        const result = await request.query(`
      SELECT TOP (@top)
        Customer_Number,
        Consignee_Cell_Length,
        Master_No,
        [Agent Duration],
        [Total Duration],
        Extension,
        Call_Response,
        [Time],
        Recording,
        IsArchived
      FROM dbo.CALL_LOGS
      ORDER BY [Time] DESC;
    `);

        return result.recordset;
    }

    /* =========================
       VALIDATE BULK
    ========================== */
    async validateBulk(payloads = []) {
        const { valid, invalidRows } = this._validatePayloads(payloads);
        if (invalidRows.length) {
            const err = new Error("Some rows are invalid.");
            err.code = "VALIDATION_ERROR";
            err.invalidRows = invalidRows;
            throw err;
        }
        return { validCount: valid.length, invalidCount: 0 };
    }

    /* =========================
       BULK IMPORT (UPSERT)
       - override by (Customer_Number + Master_No + Time)
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

        const { valid, invalidRows } = this._validatePayloads(payloads);

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

            const CHUNK = 10000;
            let inserted = 0;
            let updated = 0;

            for (let i = 0; i < valid.length; i += CHUNK) {
                const batch = valid.slice(i, i + CHUNK);

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

        // Deduplicate
        const deduped = new Map();
        for (const row of batch) {
            const key = `${row.Customer_Number}|${row.Master_No}|${row.Time}`;
            deduped.set(key, row);
        }

        const uniqueBatch = Array.from(deduped.values());
        console.log(`🧹 After dedupe: ${uniqueBatch.length}`);

        // Temp table
        const table = new sql.Table('#CallLogsBulk');
        table.create = true;

        table.columns.add('Customer_Number', sql.VarChar(20), { nullable: false });
        table.columns.add('Consignee_Cell_Length', sql.Int, { nullable: false });
        table.columns.add('Master_No', sql.VarChar(20), { nullable: false });
        table.columns.add('Agent Duration', sql.VarChar(20), { nullable: true });
        table.columns.add('Total Duration', sql.VarChar(20), { nullable: true });
        table.columns.add('Extension', sql.VarChar(20), { nullable: true });
        table.columns.add('Call_Response', sql.VarChar(20), { nullable: true });
        table.columns.add('Time', sql.DateTime, { nullable: false });
        table.columns.add('Recording', sql.NVarChar(sql.MAX), { nullable: true });
        table.columns.add('IsArchived', sql.Bit, { nullable: false });

        for (const r of uniqueBatch) {
            table.rows.add(
                r.Customer_Number,
                r.Consignee_Cell_Length,
                r.Master_No,
                r.Agent_Duration,
                r.Total_Duration,
                r.Extension || '',
                r.Call_Response,
                r.Time,
                r.Recording || '',
                r.IsArchived
            );
        }

        // Bulk insert temp table
        await new sql.Request(tx).bulk(table);
        console.log("📥 Bulk insert into temp table done");

        // Merge
        const mergeResult = await new sql.Request(tx).query(`
        DECLARE @OutputActions TABLE (Action NVARCHAR(10));

        MERGE dbo.CALL_LOGS AS target
        USING #CallLogsBulk AS src
        ON target.Customer_Number = src.Customer_Number
           AND target.Master_No = src.Master_No
           AND target.[Time] = src.[Time]

        WHEN MATCHED THEN
          UPDATE SET
            target.Consignee_Cell_Length = src.Consignee_Cell_Length,
            target.[Agent Duration] = src.[Agent Duration],
            target.[Total Duration] = src.[Total Duration],
            target.Extension = src.Extension,
            target.Call_Response = src.Call_Response,
            target.[Time] = src.[Time],
            target.Recording = src.Recording,
            target.IsArchived = src.IsArchived

        WHEN NOT MATCHED THEN
          INSERT (
            Customer_Number,
            Consignee_Cell_Length,
            Master_No,
            [Agent Duration],
            [Total Duration],
            Extension,
            Call_Response,
            [Time],
            Recording,
            IsArchived
          )
          VALUES (
            src.Customer_Number,
            src.Consignee_Cell_Length,
            src.Master_No,
            src.[Agent Duration],
            src.[Total Duration],
            src.Extension,
            src.Call_Response,
            src.[Time],
            src.Recording,
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

    // =============================
    // VALIDATIONS (same logic as frontend)
    // ✅ DUPLICATION VALIDATION REMOVED
    // =============================
    _validatePayloads(payloads) {
        const invalidRows = [];
        const valid = [];

        (payloads || []).forEach((p, idx) => {
            const rowNo = idx + 1;
            const errors = [];

            const Customer_Number = this._s(p.Customer_Number);
            const Consignee_Cell_Length = this._num(p.Consignee_Cell_Length);
            const Master_No = this._s(p.Master_No);

            const Agent_Duration = this._s(p["Agent Duration"] ?? p.Agent_Duration ?? p.agentDuration);
            const Total_Duration = this._s(p["Total Duration"] ?? p.Total_Duration ?? p.totalDuration);

            const Extension = this._s(p.Extension);
            const Call_Response = this._s(p.Call_Response);

            const Time = this._toSqlDateTime(p.Time);
            const Recording = this._s(p.Recording);

            const rawIsArchived = p.IsArchived ?? p.isArchived;
            const IsArchived = this._arch(rawIsArchived);

            if (!Customer_Number) errors.push("Customer_Number is required");
            else if (!/^[0-9]+$/.test(Customer_Number)) errors.push("Customer_Number must contain digits only");

            if (this._rawEmpty(p.Consignee_Cell_Length)) errors.push("Consignee_Cell_Length is required");
            else if (Consignee_Cell_Length === null) errors.push("Consignee_Cell_Length: Invalid number");

            if (!Master_No) errors.push("Master_No is required");

            if (!Agent_Duration) errors.push("Agent Duration is required");
            else if (!this._isDurationValid(Agent_Duration)) errors.push("Agent Duration: Invalid format");

            if (!Total_Duration) errors.push("Total Duration is required");
            else if (!this._isDurationValid(Total_Duration)) errors.push("Total Duration: Invalid format");

            if (!Call_Response) errors.push("Call_Response is required");

            if (this._rawEmpty(p.Time)) errors.push("Time is required");
            else if (!Time) errors.push("Invalid Time");

            if (!this._rawEmpty(rawIsArchived) && IsArchived === null) errors.push("IsArchived must be 0 or 1");

            const MAX = 20;
            if (Customer_Number && Customer_Number.length > MAX) errors.push(`Customer_Number: Max ${MAX} characters allowed`);
            if (Master_No && Master_No.length > MAX) errors.push(`Master_No: Max ${MAX} characters allowed`);
            if (Extension && Extension.length > MAX) errors.push(`Extension: Max ${MAX} characters allowed`);
            if (Call_Response && Call_Response.length > MAX) errors.push(`Call_Response: Max ${MAX} characters allowed`);

            // ❌ Duplicate-in-request check removed

            if (errors.length) {
                invalidRows.push({ rowNo, errors, payload: p });
                return;
            }

            valid.push({
                Customer_Number,
                Consignee_Cell_Length,
                Master_No,
                Agent_Duration,
                Total_Duration,
                Extension: Extension || "",
                Call_Response,
                Time,
                Recording: Recording || "",
                IsArchived: IsArchived === 1 ? 1 : 0,
            });
        });

        return { valid, invalidRows };
    }

    // helpers
    _s(v) {
        const s = String(v ?? "").trim();
        return s ? s : "";
    }

    _rawEmpty(v) {
        return v === undefined || v === null || String(v).trim() === "";
    }

    _num(v) {
        const s = String(v ?? "").trim();
        if (!s) return null;
        const n = Number(s);
        return Number.isFinite(n) ? n : null;
    }

    _arch(v) {
        const s = String(v ?? "").trim();
        if (s === "") return null;
        const n = Number(s);
        return n === 0 || n === 1 ? n : null;
    }

    _isDurationValid(v) {
        const s = String(v ?? "").trim();
        if (!s) return false;
        if (/^\d+(\.\d+)?$/.test(s)) return true; // seconds
        if (/^\d{1,2}:\d{2}$/.test(s)) return true; // mm:ss
        if (/^\d{1,2}:\d{2}:\d{2}$/.test(s)) return true; // HH:mm:ss
        if (/^\d{1,2} h: \d{1,2} m: \d{1,2} s$/.test(s)) return true; // 00 h: 00 m: 23 s
        return false;
    }

    // SQL Server datetime string: "YYYY-MM-DD HH:mm:ss"
    _toSqlDateTime(raw) {
        const s = String(raw ?? "").trim();
        if (!s) return null;

        if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?$/.test(s)) {
            return s.length === 16 ? `${s}:00` : s;
        }

        const d = new Date(s);
        if (isNaN(d.getTime())) return null;

        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const hh = String(d.getHours()).padStart(2, "0");
        const mm = String(d.getMinutes()).padStart(2, "0");
        const ss = String(d.getSeconds()).padStart(2, "0");
        return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
    }
}

export const callLogsService = new CallLogsService();