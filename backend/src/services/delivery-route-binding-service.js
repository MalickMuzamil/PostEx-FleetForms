// ✅ services/delivery-route-binding-service.js  (UPDATED - FULL)
// ✅ Fixes:
// 1) Bulk dedupe now keeps SAME key but DIFFERENT EffectiveDate (no silent overwrite)
// 2) Confirmation rule updated:
//    - If ANY ACTIVE (Required_for_Reports=1) exists for same (Branch+SubBranch+Route)
//      AND new EffectiveDate is DIFFERENT => CONFIRM required (single + update + bulk)
//    - (Future date validation remains future-only, as per your current rule)

import sql from "mssql";
import { getPool } from "../config/sql-config.js";

class DeliveryRouteBindingService {
  // ----------------- HELPERS -----------------
  // Lock key (DO NOT include date) => serialize per Branch+SubBranch+Route
  _key(branchId, subBranchId, deliveryRouteId) {
    return `DRB|${Number(branchId)}|${Number(subBranchId)}|${Number(
      deliveryRouteId
    )}`;
  }

  // Payload dedupe key (INCLUDE date) => allow multiple rows per same key with different EffectiveDate
  _payloadKey(branchId, subBranchId, deliveryRouteId, effectiveDate) {
    return `DRB|${Number(branchId)}|${Number(subBranchId)}|${Number(
      deliveryRouteId
    )}|${String(effectiveDate)}`;
  }

  _httpError(message, { code, httpStatus, conflict, conflicts } = {}) {
    const err = new Error(message);
    if (code) err.code = code;
    if (httpStatus) err.httpStatus = httpStatus;
    if (conflict) err.conflict = conflict;
    if (conflicts) err.conflicts = conflicts;
    return err;
  }

  _isFutureDateOnly(dateStr) {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return false;

    const input = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    );

    const now = new Date();
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );

    return input.getTime() > today.getTime();
  }

  // ✅ Dedupe only exact duplicates (same Branch/SubBranch/Route + same EffectiveDate)
  _dedupePayloads(payloads = []) {
    const map = new Map();

    for (const p of payloads) {
      const branchId = Number(p.branchId);
      const subBranchId = Number(p.subBranchId);
      const deliveryRouteId = Number(p.deliveryRouteId);
      if (!branchId || !subBranchId || !deliveryRouteId) continue;

      const requiredReportsFlag =
        p.requiredReportsFlag === 0 || p.requiredReportsFlag === 1
          ? Number(p.requiredReportsFlag)
          : 1;

      const effectiveDate = p.effectiveDate;
      if (!effectiveDate) continue;

      const correctDescriptionForReports = String(
        p.correctDescriptionForReports || ""
      ).trim();

      // ✅ include effectiveDate in dedupe key
      map.set(
        this._payloadKey(branchId, subBranchId, deliveryRouteId, effectiveDate),
        {
          branchId,
          subBranchId,
          deliveryRouteId,
          effectiveDate,
          requiredReportsFlag,
          correctDescriptionForReports,
        }
      );
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.branchId !== b.branchId) return a.branchId - b.branchId;
      if (a.subBranchId !== b.subBranchId)
        return a.subBranchId - b.subBranchId;
      if (a.deliveryRouteId !== b.deliveryRouteId)
        return a.deliveryRouteId - b.deliveryRouteId;
      return new Date(a.effectiveDate) - new Date(b.effectiveDate);
    });
  }

  async _acquireAppLock(transaction, resourceKey, timeoutMs = 10000) {
    const req = new sql.Request(transaction);
    req.input("Resource", sql.NVarChar(200), resourceKey);
    req.input("LockTimeout", sql.Int, timeoutMs);

    const res = await req.query(`
      DECLARE @result INT;
      EXEC @result = sp_getapplock
        @Resource = @Resource,
        @LockMode = 'Exclusive',
        @LockOwner = 'Transaction',
        @LockTimeout = @LockTimeout;
      SELECT @result AS Result;
    `);

    const code = res.recordset?.[0]?.Result;
    if (typeof code !== "number" || code < 0) {
      throw new Error(`Could not acquire lock for resource: ${resourceKey}`);
    }
  }

  async _fetchEnrichedByIds(transaction, ids = []) {
    if (!ids.length) return [];

    const req = new sql.Request(transaction);
    const params = ids
      .map((id, idx) => {
        req.input(`id${idx}`, sql.Int, Number(id));
        return `@id${idx}`;
      })
      .join(",");

    const result = await req.query(`
      SELECT
        b.ID,

        b.BranchID,
        br.BranchName,
        br.BranchDesc,

        b.Sub_Branch_ID AS SubBranchID,
        sb.Sub_Branch_Name        AS SubBranchName,
        sb.Sub_Branch_Description AS SubBranchDesc,

        b.DeliveryRouteID,
        b.DeliveryRouteNo AS DeliveryRouteNo,
        b.Correct_Description_for_Reports AS DeliveryRouteDescription,

        b.Sub_Branch_Effective_Date AS EffectiveDate,
        b.Required_for_Reports AS RequiredReportsFlag
      FROM GoGreen.OPS.DeliveryRoute_SubBranch_Binding b
      LEFT JOIN HRM.HR.Branches br
        ON br.BranchID = b.BranchID
      LEFT JOIN GoGreen.OPS.Sub_Branch_Definition sb
        ON sb.Sub_Branch_ID = b.Sub_Branch_ID
      WHERE b.ID IN (${params})
      ORDER BY b.ID DESC
    `);

    return result.recordset;
  }

  async _validateRefsSingle(tx, { branchId, subBranchId, deliveryRouteId }) {
    const req = new sql.Request(tx);
    req.input("BranchID", sql.Int, Number(branchId));
    req.input("SubBranchID", sql.Int, Number(subBranchId));
    req.input("RouteID", sql.Int, Number(deliveryRouteId));

    const res = await req.query(`
      SELECT
        CASE WHEN EXISTS (SELECT 1 FROM HRM.HR.Branches WHERE BranchID=@BranchID) THEN 1 ELSE 0 END AS BranchOk,
        CASE WHEN EXISTS (
          SELECT 1
          FROM GoGreen.OPS.Sub_Branch_Definition
          WHERE Sub_Branch_ID=@SubBranchID AND BranchID=@BranchID
        ) THEN 1 ELSE 0 END AS SubBranchOk,
        CASE WHEN EXISTS (SELECT 1 FROM GoGreen.dbo.DeliveryRoutes WHERE RouteID=@RouteID) THEN 1 ELSE 0 END AS RouteOk;
    `);

    const row = res.recordset?.[0] || {};
    const errors = [];
    if (!row.BranchOk) errors.push("Invalid BranchID");
    if (!row.SubBranchOk)
      errors.push("Invalid SubBranchID (not found OR not mapped to BranchID)");
    if (!row.RouteOk)
      errors.push("Invalid DeliveryRouteID (not found in DeliveryRoutes)");

    return errors;
  }

  // ----------------- MASTER LISTS -----------------
  async listDeliveryRoutes() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        RouteID          AS DeliveryRouteID,
        RouteNo          AS DeliveryRouteNo,
        RouteDescription AS DeliveryRouteDescription,
        BranchID
      FROM GoGreen.dbo.DeliveryRoutes
      ORDER BY RouteNo
    `);
    return result.recordset;
  }

  async listBranches() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT BranchID, BranchName, BranchDesc
      FROM HRM.HR.Branches
      ORDER BY BranchName
    `);
    return result.recordset;
  }

  async listSubBranchesByBranch(branchId) {
    const pool = await getPool();
    const req = pool.request();
    req.input("BranchID", sql.Int, Number(branchId));

    const result = await req.query(`
      SELECT
        sb.Sub_Branch_ID          AS SubBranchID,
        sb.Sub_Branch_Name        AS SubBranchName,
        sb.Sub_Branch_Description AS SubBranchDesc,
        sb.BranchID
      FROM GoGreen.OPS.Sub_Branch_Definition sb
      WHERE sb.BranchID = @BranchID
      ORDER BY sb.Sub_Branch_Name
    `);

    return result.recordset;
  }

  // ----------------- DEPENDENT DROPDOWNS -----------------
  async getBranchesByRouteId(deliveryRouteId) {
    const pool = await getPool();
    const req = pool.request();
    req.input("RouteID", sql.Int, Number(deliveryRouteId));

    const result = await req.query(`
      SELECT DISTINCT
        br.BranchID,
        br.BranchName,
        br.BranchDesc
      FROM GoGreen.dbo.DeliveryRoutes r
      INNER JOIN HRM.HR.Branches br
        ON br.BranchID = r.BranchID
      WHERE r.RouteID = @RouteID
      ORDER BY br.BranchName
    `);

    return result.recordset;
  }

  async getSubBranchesByRouteAndBranch({ deliveryRouteId, branchId }) {
    const pool = await getPool();
    const req = pool.request();
    req.input("RouteID", sql.Int, Number(deliveryRouteId));
    req.input("BranchID", sql.Int, Number(branchId));

    const routeBranchCheck = await req.query(`
      SELECT TOP 1 RouteID
      FROM GoGreen.dbo.DeliveryRoutes
      WHERE RouteID = @RouteID AND BranchID = @BranchID;
    `);

    if (!routeBranchCheck.recordset?.length) return [];
    return this.listSubBranchesByBranch(branchId);
  }

  // ----------------- LIST BINDINGS -----------------
  async listBindings() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        b.ID,

        b.BranchID,
        br.BranchName,
        br.BranchDesc,

        b.Sub_Branch_ID AS SubBranchID,
        sb.Sub_Branch_Name        AS SubBranchName,
        sb.Sub_Branch_Description AS SubBranchDesc,

        b.DeliveryRouteID,
        b.DeliveryRouteNo AS DeliveryRouteNo,
        b.Correct_Description_for_Reports AS DeliveryRouteDescription,

        b.Sub_Branch_Effective_Date AS EffectiveDate,
        b.Required_for_Reports AS RequiredReportsFlag
      FROM GoGreen.OPS.DeliveryRoute_SubBranch_Binding b
      LEFT JOIN HRM.HR.Branches br
        ON br.BranchID = b.BranchID
      LEFT JOIN GoGreen.OPS.Sub_Branch_Definition sb
        ON sb.Sub_Branch_ID = b.Sub_Branch_ID
      ORDER BY b.ID DESC
    `);

    return result.recordset;
  }

  // ----------------- SINGLE CREATE (UPDATED) -----------------
  async createBinding({
    branchId,
    subBranchId,
    deliveryRouteId,
    effectiveDate,
    requiredReportsFlag,
    correctDescriptionForReports,
    force = false,
  }) {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    try {
      await new sql.Request(tx).query(`SET XACT_ABORT ON;`);

      const bId = Number(branchId);
      const sbId = Number(subBranchId);
      const rId = Number(deliveryRouteId);

      if (!bId || !sbId || !rId) {
        throw this._httpError("BranchID/SubBranchID/DeliveryRouteID required", {
          code: "MISSING_FIELDS",
          httpStatus: 400,
        });
      }

      if (!effectiveDate) {
        throw this._httpError("EffectiveDate is required", {
          code: "MISSING_EFFECTIVE_DATE",
          httpStatus: 400,
        });
      }

      if (!this._isFutureDateOnly(effectiveDate)) {
        throw this._httpError("Effective Date must be a future date.", {
          code: "INVALID_EFFECTIVE_DATE",
          httpStatus: 400,
        });
      }

      const flag =
        requiredReportsFlag === 0 || requiredReportsFlag === 1
          ? Number(requiredReportsFlag)
          : 1;

      const refErrors = await this._validateRefsSingle(tx, {
        branchId: bId,
        subBranchId: sbId,
        deliveryRouteId: rId,
      });

      if (refErrors.length) {
        throw this._httpError("Invalid reference data.", {
          code: "INVALID_REFERENCE",
          httpStatus: 400,
          conflicts: refErrors,
        });
      }

      await this._acquireAppLock(tx, this._key(bId, sbId, rId));

      // ✅ NEW CONFIRM RULE:
      // If ANY ACTIVE exists for same key and its effective date != new effective date => confirm
      const activeConflictRes = await new sql.Request(tx)
        .input("BranchID", sql.Int, bId)
        .input("SubBranchID", sql.Int, sbId)
        .input("DeliveryRouteID", sql.Int, rId)
        .input("NewEffectiveDate", sql.Date, effectiveDate)
        .query(`
          SELECT TOP 1
            ID,
            Sub_Branch_Effective_Date AS ExistingEffectiveDate
          FROM GoGreen.OPS.DeliveryRoute_SubBranch_Binding
          WHERE BranchID = @BranchID
            AND Sub_Branch_ID = @SubBranchID
            AND DeliveryRouteID = @DeliveryRouteID
            AND Required_for_Reports = 1
            AND Sub_Branch_Effective_Date <> @NewEffectiveDate
          ORDER BY Sub_Branch_Effective_Date DESC, ID DESC
        `);

      const activeConflict = activeConflictRes.recordset?.[0];
      if (activeConflict && !force) {
        throw this._httpError(
          "An active binding already exists for this Branch/SubBranch/Route with a different effective date. Confirm overwrite.",
          { code: "CONFIRM_OVERWRITE", httpStatus: 409, conflict: activeConflict }
        );
      }

      // ✅ If inserting Active=1 => make all old inactive for same key
      if (flag === 1) {
        await new sql.Request(tx)
          .input("BranchID", sql.Int, bId)
          .input("SubBranchID", sql.Int, sbId)
          .input("DeliveryRouteID", sql.Int, rId)
          .query(`
            UPDATE GoGreen.OPS.DeliveryRoute_SubBranch_Binding
            SET Required_for_Reports = 0
            WHERE BranchID = @BranchID
              AND Sub_Branch_ID = @SubBranchID
              AND DeliveryRouteID = @DeliveryRouteID
          `);
      }

      const correctDesc = String(correctDescriptionForReports || "").trim();

      // ✅ UPSERT by (key + effectiveDate)
      const upsertRes = await new sql.Request(tx)
        .input("BranchID", sql.Int, bId)
        .input("SubBranchID", sql.Int, sbId)
        .input("DeliveryRouteID", sql.Int, rId)
        .input("EffectiveDate", sql.Date, effectiveDate)
        .input("RequiredReportsFlag", sql.Int, flag)
        .input("Correct_Description_for_Reports", sql.NVarChar(200), correctDesc)
        .query(`
          DECLARE @id INT;

          SELECT TOP 1 @id = ID
          FROM GoGreen.OPS.DeliveryRoute_SubBranch_Binding
          WHERE BranchID = @BranchID
            AND Sub_Branch_ID = @SubBranchID
            AND DeliveryRouteID = @DeliveryRouteID
            AND Sub_Branch_Effective_Date = @EffectiveDate
          ORDER BY ID DESC;

          IF @id IS NOT NULL
          BEGIN
            UPDATE b
            SET
              b.DeliveryRouteNo = r.RouteNo,
              b.Correct_Description_for_Reports = @Correct_Description_for_Reports,
              b.Required_for_Reports = @RequiredReportsFlag
            FROM GoGreen.OPS.DeliveryRoute_SubBranch_Binding b
            INNER JOIN GoGreen.dbo.DeliveryRoutes r
              ON r.RouteID = @DeliveryRouteID
            WHERE b.ID = @id;

            SELECT @id AS ID;
          END
          ELSE
          BEGIN
            INSERT INTO GoGreen.OPS.DeliveryRoute_SubBranch_Binding
              (BranchID, Sub_Branch_ID, DeliveryRouteID,
               DeliveryRouteNo, Correct_Description_for_Reports,
               Sub_Branch_Effective_Date, Required_for_Reports)
            OUTPUT INSERTED.ID
            SELECT
              @BranchID,
              @SubBranchID,
              @DeliveryRouteID,
              r.RouteNo,
              @Correct_Description_for_Reports,
              @EffectiveDate,
              @RequiredReportsFlag
            FROM GoGreen.dbo.DeliveryRoutes r
            WHERE r.RouteID = @DeliveryRouteID;
          END
        `);

      const newId = upsertRes.recordset?.[0]?.ID;
      const enriched = await this._fetchEnrichedByIds(tx, newId ? [newId] : []);

      await tx.commit();
      return enriched?.[0] || null;
    } catch (err) {
      try {
        await tx.rollback();
      } catch (_) { }
      throw err;
    }
  }

  // ----------------- BULK VALIDATION (UNCHANGED EXCEPT DEDUPE BEHAVIOR) -----------------
  async validateBulkBindings(payloads = []) {
    const clean = this._dedupePayloads(payloads);
    if (!clean.length) return { validRows: [], invalidRows: [] };

    const dateInvalid = [];
    const dateValid = [];

    for (const p of clean) {
      if (!p.effectiveDate || !this._isFutureDateOnly(p.effectiveDate)) {
        dateInvalid.push({
          ...p,
          reasons: ["Effective Date must be a future date."],
        });
      } else {
        dateValid.push(p);
      }
    }

    if (!dateValid.length) {
      return { validRows: [], invalidRows: dateInvalid };
    }

    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);

    try {
      await new sql.Request(tx).query(`SET XACT_ABORT ON;`);

      const t = new sql.Table("#PayloadValidate");
      t.create = true;

      t.columns.add("BranchID", sql.Int, { nullable: false });
      t.columns.add("SubBranchID", sql.Int, { nullable: false });
      t.columns.add("DeliveryRouteID", sql.Int, { nullable: false });
      t.columns.add("EffectiveDate", sql.Date, { nullable: false });
      t.columns.add("RequiredReportsFlag", sql.Int, { nullable: false });
      t.columns.add("CorrectDescriptionForReports", sql.NVarChar(200), {
        nullable: false,
      });

      for (const p of dateValid) {
        const desc = String(p.correctDescriptionForReports || "").trim();
        t.rows.add(
          Number(p.branchId),
          Number(p.subBranchId),
          Number(p.deliveryRouteId),
          p.effectiveDate,
          Number(p.requiredReportsFlag),
          desc
        );
      }

      await new sql.Request(tx).bulk(t);

      const checkRes = await new sql.Request(tx).query(`
        SELECT
          p.BranchID,
          p.SubBranchID,
          p.DeliveryRouteID,
          p.EffectiveDate,
          p.RequiredReportsFlag,
          p.CorrectDescriptionForReports,

          CASE WHEN br.BranchID IS NULL THEN 0 ELSE 1 END AS BranchOk,
          CASE WHEN sb.Sub_Branch_ID IS NULL THEN 0 ELSE 1 END AS SubBranchOk,
          CASE WHEN r.RouteID IS NULL THEN 0 ELSE 1 END AS RouteOk
        FROM #PayloadValidate p
        LEFT JOIN HRM.HR.Branches br
          ON br.BranchID = p.BranchID
        LEFT JOIN GoGreen.OPS.Sub_Branch_Definition sb
          ON sb.Sub_Branch_ID = p.SubBranchID
         AND sb.BranchID = p.BranchID
        LEFT JOIN GoGreen.dbo.DeliveryRoutes r
          ON r.RouteID = p.DeliveryRouteID;
      `);

      const rows = checkRes.recordset ?? [];
      const invalidRows = [...dateInvalid];
      const validRows = [];

      for (const row of rows) {
        const reasons = [];
        if (!row.BranchOk) reasons.push("Invalid BranchID");
        if (!row.SubBranchOk)
          reasons.push(
            "Invalid SubBranchID (not found OR not mapped to BranchID)"
          );
        if (!row.RouteOk)
          reasons.push("Invalid DeliveryRouteID (not found in DeliveryRoutes)");

        const normalized = {
          branchId: row.BranchID,
          subBranchId: row.SubBranchID,
          deliveryRouteId: row.DeliveryRouteID,
          effectiveDate: row.EffectiveDate,
          requiredReportsFlag: row.RequiredReportsFlag,
          correctDescriptionForReports: String(
            row.CorrectDescriptionForReports || ""
          ).trim(),
        };

        if (!normalized.correctDescriptionForReports) {
          reasons.push("Correct Description for Reports is required");
        }

        if (reasons.length) invalidRows.push({ ...normalized, reasons });
        else validRows.push(normalized);
      }

      await tx.commit();
      return { validRows, invalidRows };
    } catch (err) {
      try {
        await tx.rollback();
      } catch (_) { }
      throw err;
    }
  }

  // ----------------- BULK CREATE (UPDATED) -----------------
  async createBulkBindings(payloadsOrObj = []) {
    const isObj =
      payloadsOrObj &&
      !Array.isArray(payloadsOrObj) &&
      typeof payloadsOrObj === "object";

    const payloads = isObj ? payloadsOrObj.payloads ?? [] : payloadsOrObj;
    const force = isObj ? Boolean(payloadsOrObj.force) : false;

    if (!Array.isArray(payloads) || payloads.length === 0) return [];

    const { validRows, invalidRows } = await this.validateBulkBindings(payloads);

    if (invalidRows.length) {
      throw this._httpError("Bulk contains invalid rows. Fix them before saving.", {
        code: "INVALID_BULK_ROWS",
        httpStatus: 400,
        conflicts: invalidRows,
      });
    }

    const clean = validRows;
    if (!clean.length) return [];

    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    try {
      await new sql.Request(tx).query(`SET XACT_ABORT ON;`);

      // lock per key (no date)
      for (const p of clean) {
        await this._acquireAppLock(
          tx,
          this._key(p.branchId, p.subBranchId, p.deliveryRouteId)
        );
      }

      const t = new sql.Table("#Payload");
      t.create = true;

      t.columns.add("BranchID", sql.Int, { nullable: false });
      t.columns.add("SubBranchID", sql.Int, { nullable: false });
      t.columns.add("DeliveryRouteID", sql.Int, { nullable: false });
      t.columns.add("EffectiveDate", sql.Date, { nullable: false });
      t.columns.add("RequiredReportsFlag", sql.Int, { nullable: false });
      t.columns.add("CorrectDescriptionForReports", sql.NVarChar(200), {
        nullable: false,
      });

      for (const p of clean) {
        const desc = String(p.correctDescriptionForReports || "").trim();
        t.rows.add(
          Number(p.branchId),
          Number(p.subBranchId),
          Number(p.deliveryRouteId),
          p.effectiveDate,
          Number(p.requiredReportsFlag),
          desc
        );
      }

      await new sql.Request(tx).bulk(t);

      // ✅ NEW CONFIRM RULE (BULK):
      // If ANY ACTIVE exists for same key and its date != payload date => confirm
      const conflictsRes = await new sql.Request(tx).query(`
        SELECT TOP 1000
          b.BranchID,
          b.Sub_Branch_ID AS SubBranchID,
          b.DeliveryRouteID,
          b.Sub_Branch_Effective_Date AS ExistingEffectiveDate,
          p.EffectiveDate AS NewEffectiveDate,
          b.ID AS ExistingID
        FROM GoGreen.OPS.DeliveryRoute_SubBranch_Binding b
        INNER JOIN #Payload p
          ON p.BranchID = b.BranchID
         AND p.SubBranchID = b.Sub_Branch_ID
         AND p.DeliveryRouteID = b.DeliveryRouteID
        WHERE b.Required_for_Reports = 1
          AND b.Sub_Branch_Effective_Date <> p.EffectiveDate
        ORDER BY b.Sub_Branch_Effective_Date DESC, b.ID DESC
      `);

      const conflicts = conflictsRes.recordset ?? [];
      if (conflicts.length && !force) {
        throw this._httpError(
          "Bulk contains rows that conflict with an active binding (different effective date). Confirm overwrite.",
          {
            code: "CONFIRM_OVERWRITE_BULK",
            httpStatus: 409,
            conflicts,
          }
        );
      }

      // ✅ If payload row is Active(1) => make all old rows inactive for that key
      await new sql.Request(tx).query(`
        UPDATE b
        SET b.Required_for_Reports = 0
        FROM GoGreen.OPS.DeliveryRoute_SubBranch_Binding b
        INNER JOIN (
          SELECT DISTINCT BranchID, SubBranchID, DeliveryRouteID
          FROM #Payload
          WHERE RequiredReportsFlag = 1
        ) k
          ON k.BranchID = b.BranchID
         AND k.SubBranchID = b.Sub_Branch_ID
         AND k.DeliveryRouteID = b.DeliveryRouteID;
      `);

      // ✅ UPSERT bulk by (key + effectiveDate)
      const upsertRes = await new sql.Request(tx).query(`
        DECLARE @Affected TABLE (ID INT);

        -- UPDATE existing (same key + same date)
        UPDATE b
        SET
          b.DeliveryRouteNo = r.RouteNo,
          b.Correct_Description_for_Reports = p.CorrectDescriptionForReports,
          b.Required_for_Reports = p.RequiredReportsFlag
        OUTPUT INSERTED.ID INTO @Affected(ID)
        FROM GoGreen.OPS.DeliveryRoute_SubBranch_Binding b
        INNER JOIN #Payload p
          ON p.BranchID = b.BranchID
         AND p.SubBranchID = b.Sub_Branch_ID
         AND p.DeliveryRouteID = b.DeliveryRouteID
         AND p.EffectiveDate = b.Sub_Branch_Effective_Date
        INNER JOIN GoGreen.dbo.DeliveryRoutes r
          ON r.RouteID = p.DeliveryRouteID;

        -- INSERT missing (same key + same date not found)
        INSERT INTO GoGreen.OPS.DeliveryRoute_SubBranch_Binding
          (BranchID, Sub_Branch_ID, DeliveryRouteID,
           DeliveryRouteNo, Correct_Description_for_Reports,
           Sub_Branch_Effective_Date, Required_for_Reports)
        OUTPUT INSERTED.ID INTO @Affected(ID)
        SELECT
          p.BranchID,
          p.SubBranchID,
          p.DeliveryRouteID,
          r.RouteNo,
          p.CorrectDescriptionForReports,
          p.EffectiveDate,
          p.RequiredReportsFlag
        FROM #Payload p
        INNER JOIN GoGreen.dbo.DeliveryRoutes r
          ON r.RouteID = p.DeliveryRouteID
        WHERE NOT EXISTS (
          SELECT 1
          FROM GoGreen.OPS.DeliveryRoute_SubBranch_Binding b
          WHERE b.BranchID = p.BranchID
            AND b.Sub_Branch_ID = p.SubBranchID
            AND b.DeliveryRouteID = p.DeliveryRouteID
            AND b.Sub_Branch_Effective_Date = p.EffectiveDate
        );

        SELECT ID FROM @Affected;
      `);

      const ids = (upsertRes.recordset ?? []).map((r) => r.ID);
      const enriched = await this._fetchEnrichedByIds(tx, ids);

      await tx.commit();
      return enriched;
    } catch (err) {
      try {
        await tx.rollback();
      } catch (_) { }
      throw err;
    }
  }

  // ----------------- UPDATE SINGLE (FIXED CONFIRM RULE) -----------------
  async updateBinding(
    id,
    {
      branchId,
      subBranchId,
      deliveryRouteId,
      effectiveDate,
      requiredReportsFlag,
      correctDescriptionForReports,
      force = false,
    } = {}
  ) {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    try {
      await new sql.Request(tx).query(`SET XACT_ABORT ON;`);

      const rowId = Number(id);
      if (!rowId) {
        throw this._httpError("Invalid ID", { code: "INVALID_ID", httpStatus: 400 });
      }

      if (!effectiveDate) {
        throw this._httpError("EffectiveDate is required", {
          code: "MISSING_EFFECTIVE_DATE",
          httpStatus: 400,
        });
      }

      if (!this._isFutureDateOnly(effectiveDate)) {
        throw this._httpError("Effective Date must be a future date.", {
          code: "INVALID_EFFECTIVE_DATE",
          httpStatus: 400,
        });
      }

      const flag =
        requiredReportsFlag === 0 || requiredReportsFlag === 1
          ? Number(requiredReportsFlag)
          : 1;

      // ✅ fetch current row (include existing effective date + active flag)
      const existingRes = await new sql.Request(tx)
        .input("ID", sql.Int, rowId)
        .query(`
        SELECT TOP 1
          ID,
          BranchID,
          Sub_Branch_ID AS SubBranchID,
          DeliveryRouteID,
          Sub_Branch_Effective_Date AS ExistingEffectiveDate,
          Required_for_Reports AS ExistingActive
        FROM GoGreen.OPS.DeliveryRoute_SubBranch_Binding
        WHERE ID = @ID
      `);

      const cur = existingRes.recordset?.[0];
      if (!cur) {
        throw this._httpError("Record not found", { code: "NOT_FOUND", httpStatus: 404 });
      }

      const nextBranchId = Number(branchId ?? cur.BranchID);
      const nextSubBranchId = Number(subBranchId ?? cur.SubBranchID);
      const nextRouteId = Number(deliveryRouteId ?? cur.DeliveryRouteID);

      if (!nextBranchId || !nextSubBranchId || !nextRouteId) {
        throw this._httpError("BranchID/SubBranchID/DeliveryRouteID required", {
          code: "MISSING_FIELDS",
          httpStatus: 400,
        });
      }

      const refErrors = await this._validateRefsSingle(tx, {
        branchId: nextBranchId,
        subBranchId: nextSubBranchId,
        deliveryRouteId: nextRouteId,
      });

      if (refErrors.length) {
        throw this._httpError("Invalid reference data.", {
          code: "INVALID_REFERENCE",
          httpStatus: 400,
          conflicts: refErrors,
        });
      }

      const oldKey = this._key(cur.BranchID, cur.SubBranchID, cur.DeliveryRouteID);
      const newKey = this._key(nextBranchId, nextSubBranchId, nextRouteId);

      const keysToLock = Array.from(new Set([oldKey, newKey])).sort();
      for (const k of keysToLock) await this._acquireAppLock(tx, k);

      // ✅ normalize dates for compare (YYYY-MM-DD)
      const newYMD = String(effectiveDate).slice(0, 10);
      const curYMD = cur.ExistingEffectiveDate
        ? new Date(cur.ExistingEffectiveDate).toISOString().slice(0, 10)
        : null;

      // ✅ CASE 1: same row is ACTIVE and effective date is changing => confirm
      if (!force && Number(cur.ExistingActive) === 1 && curYMD && curYMD !== newYMD) {
        throw this._httpError(
          "An active binding already exists for this Branch/SubBranch/Route with a different effective date. Confirm overwrite.",
          {
            code: "CONFIRM_OVERWRITE",
            httpStatus: 409,
            conflict: { ID: cur.ID, ExistingEffectiveDate: cur.ExistingEffectiveDate },
          }
        );
      }

      // ✅ CASE 2: any OTHER active exists for same key with different date => confirm
      const activeConflictRes = await new sql.Request(tx)
        .input("BranchID", sql.Int, nextBranchId)
        .input("SubBranchID", sql.Int, nextSubBranchId)
        .input("DeliveryRouteID", sql.Int, nextRouteId)
        .input("NewEffectiveDate", sql.Date, effectiveDate)
        .input("ID", sql.Int, rowId)
        .query(`
        SELECT TOP 1
          ID,
          Sub_Branch_Effective_Date AS ExistingEffectiveDate
        FROM GoGreen.OPS.DeliveryRoute_SubBranch_Binding
        WHERE BranchID = @BranchID
          AND Sub_Branch_ID = @SubBranchID
          AND DeliveryRouteID = @DeliveryRouteID
          AND Required_for_Reports = 1
          AND Sub_Branch_Effective_Date <> @NewEffectiveDate
          AND ID <> @ID
        ORDER BY Sub_Branch_Effective_Date DESC, ID DESC
      `);

      const activeConflict = activeConflictRes.recordset?.[0];
      if (activeConflict && !force) {
        throw this._httpError(
          "An active binding already exists for this Branch/SubBranch/Route with a different effective date. Confirm overwrite.",
          { code: "CONFIRM_OVERWRITE", httpStatus: 409, conflict: activeConflict }
        );
      }

      // ✅ If saving Active(1) => make all other rows inactive for same key
      if (flag === 1) {
        await new sql.Request(tx)
          .input("BranchID", sql.Int, nextBranchId)
          .input("SubBranchID", sql.Int, nextSubBranchId)
          .input("DeliveryRouteID", sql.Int, nextRouteId)
          .input("ID", sql.Int, rowId)
          .query(`
          UPDATE GoGreen.OPS.DeliveryRoute_SubBranch_Binding
          SET Required_for_Reports = 0
          WHERE BranchID = @BranchID
            AND Sub_Branch_ID = @SubBranchID
            AND DeliveryRouteID = @DeliveryRouteID
            AND ID <> @ID
        `);
      }

      const correctDesc = String(correctDescriptionForReports || "").trim();

      await new sql.Request(tx)
        .input("ID", sql.Int, rowId)
        .input("BranchID", sql.Int, nextBranchId)
        .input("SubBranchID", sql.Int, nextSubBranchId)
        .input("DeliveryRouteID", sql.Int, nextRouteId)
        .input("EffectiveDate", sql.Date, effectiveDate)
        .input("RequiredReportsFlag", sql.Int, flag)
        .input("Correct_Description_for_Reports", sql.NVarChar(200), correctDesc)
        .query(`
        UPDATE b
        SET
          b.BranchID = @BranchID,
          b.Sub_Branch_ID = @SubBranchID,
          b.DeliveryRouteID = @DeliveryRouteID,
          b.DeliveryRouteNo = r.RouteNo,
          b.Correct_Description_for_Reports = @Correct_Description_for_Reports,
          b.Sub_Branch_Effective_Date = @EffectiveDate,
          b.Required_for_Reports = @RequiredReportsFlag
        FROM GoGreen.OPS.DeliveryRoute_SubBranch_Binding b
        INNER JOIN GoGreen.dbo.DeliveryRoutes r
          ON r.RouteID = @DeliveryRouteID
        WHERE b.ID = @ID;
      `);

      const enriched = await this._fetchEnrichedByIds(tx, [rowId]);
      await tx.commit();
      return enriched?.[0] || null;
    } catch (err) {
      try { await tx.rollback(); } catch (_) { }
      throw err;
    }
  }


  // ----------------- DELETE -----------------
  async deleteBinding(id) {
    const pool = await getPool();
    const request = pool.request();
    request.input("id", sql.Int, Number(id));

    const result = await request.query(`
      DELETE FROM GoGreen.OPS.DeliveryRoute_SubBranch_Binding
      OUTPUT DELETED.*
      WHERE ID = @id
    `);

    return result.recordset?.[0] || null;
  }


  async getBranchesByRoutes(routeIds = []) {
    const ids = [...new Set((routeIds || []).map(Number).filter((x) => x > 0))];
    if (!ids.length) return [];

    const pool = await getPool();
    const req = pool.request();

    // build VALUES list safely
    const values = ids.map((_, i) => `(@rid${i})`).join(",");
    ids.forEach((id, i) => req.input(`rid${i}`, sql.Int, id));

    const result = await req.query(`
    SET NOCOUNT ON;

    IF OBJECT_ID('tempdb..#RouteIds') IS NOT NULL DROP TABLE #RouteIds;
    CREATE TABLE #RouteIds (RouteID INT NOT NULL PRIMARY KEY);

    INSERT INTO #RouteIds(RouteID)
    VALUES ${values};

    SELECT
      r.RouteID AS DeliveryRouteID,
      br.BranchID,
      br.BranchName,
      br.BranchDesc
    FROM #RouteIds ids
    INNER JOIN GoGreen.dbo.DeliveryRoutes r
      ON r.RouteID = ids.RouteID
    INNER JOIN HRM.HR.Branches br
      ON br.BranchID = r.BranchID
    ORDER BY r.RouteID, br.BranchName;
  `);

    return result.recordset || [];
  }


  // ----------------- BULK: (ROUTE, BRANCH) -> SUBBRANCHES -----------------
  async getSubBranchesByRouteBranchPairs(pairs = []) {
    const clean = (pairs || [])
      .map((p) => ({ routeId: Number(p?.routeId), branchId: Number(p?.branchId) }))
      .filter((p) => p.routeId > 0 && p.branchId > 0);

    // unique pairs
    const seen = new Set();
    const uniq = [];
    for (const p of clean) {
      const k = `${p.routeId}|${p.branchId}`;
      if (!seen.has(k)) { seen.add(k); uniq.push(p); }
    }
    if (!uniq.length) return [];

    const pool = await getPool();
    const req = pool.request();

    const values = uniq.map((_, i) => `(@r${i}, @b${i})`).join(",");
    uniq.forEach((p, i) => {
      req.input(`r${i}`, sql.Int, p.routeId);
      req.input(`b${i}`, sql.Int, p.branchId);
    });

    const result = await req.query(`
    SET NOCOUNT ON;

    IF OBJECT_ID('tempdb..#Pairs') IS NOT NULL DROP TABLE #Pairs;
    CREATE TABLE #Pairs (
      RouteID  INT NOT NULL,
      BranchID INT NOT NULL,
      PRIMARY KEY (RouteID, BranchID)
    );

    INSERT INTO #Pairs(RouteID, BranchID)
    VALUES ${values};

    SELECT
      p.RouteID  AS DeliveryRouteID,
      p.BranchID AS BranchID,
      sb.Sub_Branch_ID          AS SubBranchID,
      sb.Sub_Branch_Name        AS SubBranchName,
      sb.Sub_Branch_Description AS SubBranchDesc
    FROM #Pairs p
    INNER JOIN GoGreen.dbo.DeliveryRoutes r
      ON r.RouteID = p.RouteID
     AND r.BranchID = p.BranchID
    INNER JOIN GoGreen.OPS.Sub_Branch_Definition sb
      ON sb.BranchID = p.BranchID
    ORDER BY p.RouteID, p.BranchID, sb.Sub_Branch_Name;
  `);

    return result.recordset || [];
  }

}

export const deliveryRouteBindingService = new DeliveryRouteBindingService();
