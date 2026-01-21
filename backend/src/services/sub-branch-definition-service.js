import sql from "mssql";
import { getPool } from "../config/sql-config.js";

// Normalize for comparisons:
// - trim
// - collapse multiple spaces
// - uppercase
const normalize = (v) =>
  (v || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

class SubBranchDefinitionService {
  // ---------- LIST BY BRANCH (active by default) ----------
  async listSubBranchesByBranchId(branchId, includeInactive = false) {
    const pool = await getPool();
    const request = pool.request();
    request.input("branchId", sql.Int, Number(branchId));

    const activeFilter = includeInactive ? "" : "AND ISNULL(s.IsActive, 1) = 1";

    const result = await request.query(`
        SELECT
          s.Sub_Branch_ID          AS ID,
          s.Sub_Branch_ID          AS SubBranchID,
          s.BranchID               AS BranchID,
          s.Sub_Branch_Name        AS SubBranchName,
          s.Sub_Branch_Description AS SubBranchDesc,
          ISNULL(s.IsActive,1)     AS IsActive,

          s.EnteredOn              AS EnteredOn,
          s.EnteredBy              AS EnteredBy,
          s.EditedOn               AS EditedOn,
          s.EditedBy               AS EditedBy,

          br.BranchName            AS BranchName,
          br.BranchDesc            AS BranchDesc
        FROM GoGreen.OPS.Sub_Branch_Definition s
        LEFT JOIN HRM.HR.Branches br
          ON br.BranchID = s.BranchID
        WHERE s.BranchID = @branchId
          ${activeFilter}
        ORDER BY s.Sub_Branch_ID ASC
      `);

    return result.recordset;
  }

  // ---------- BRANCHES (Dropdown) ----------
  async listBranches() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT BranchID, BranchName, BranchDesc
        FROM HRM.HR.Branches
        ORDER BY BranchID
      `);
    return result.recordset;
  }

  // ---------- LIST ALL SUB-BRANCHES (ONLY ACTIVE) ----------
  async listSubBranches() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT
          s.Sub_Branch_ID          AS ID,
          s.Sub_Branch_ID          AS SubBranchID,
          s.BranchID               AS BranchID,
          s.Sub_Branch_Name        AS SubBranchName,
          s.Sub_Branch_Description AS SubBranchDesc,
          ISNULL(s.IsActive,1)     AS IsActive,

          s.EnteredOn              AS EnteredOn,
          s.EnteredBy              AS EnteredBy,
          s.EditedOn               AS EditedOn,
          s.EditedBy               AS EditedBy,

          br.BranchName            AS BranchName,
          br.BranchDesc            AS BranchDesc
        FROM GoGreen.OPS.Sub_Branch_Definition s
        LEFT JOIN HRM.HR.Branches br
          ON br.BranchID = s.BranchID
        WHERE ISNULL(s.IsActive, 1) = 1
        ORDER BY s.Sub_Branch_ID ASC
      `);
    return result.recordset;
  }

  // ---------- GET BY ID (ONLY ACTIVE) ----------
  async getSubBranchById(id) {
    const pool = await getPool();
    const request = pool.request();
    request.input("id", sql.Int, Number(id));

    const result = await request.query(`
        SELECT TOP 1
          s.Sub_Branch_ID          AS ID,
          s.Sub_Branch_ID          AS SubBranchID,
          s.BranchID               AS BranchID,
          s.Sub_Branch_Name        AS SubBranchName,
          s.Sub_Branch_Description AS SubBranchDesc,
          ISNULL(s.IsActive,1)     AS IsActive,

          s.EnteredOn              AS EnteredOn,
          s.EnteredBy              AS EnteredBy,
          s.EditedOn               AS EditedOn,
          s.EditedBy               AS EditedBy,

          br.BranchName            AS BranchName,
          br.BranchDesc            AS BranchDesc
        FROM GoGreen.OPS.Sub_Branch_Definition s
        LEFT JOIN HRM.HR.Branches br
          ON br.BranchID = s.BranchID
        WHERE s.Sub_Branch_ID = @id
          AND ISNULL(s.IsActive, 1) = 1
      `);

    return result.recordset?.[0] || null;
  }

  async createSubBranch({ branchId, subBranchName, subBranchDesc, enteredBy }) {
    this.validateNameFormat(subBranchName);

    const pool = await getPool();
    const request = pool.request();

    const bId = Number(branchId);
    const normName = normalize(subBranchName);

    request.input("branchId", sql.Int, bId);
    request.input("subBranchName", sql.NVarChar(100), normName);
    request.input(
      "subBranchDesc",
      sql.NVarChar(200),
      (subBranchDesc || "").trim(),
    );
    request.input("enteredBy", sql.NVarChar(100), (enteredBy || "Admin").trim());

    // 0) If already ACTIVE exists => duplicate
    const activeExists = await request.query(`
    SELECT TOP 1 Sub_Branch_ID
    FROM GoGreen.OPS.Sub_Branch_Definition WITH (UPDLOCK, HOLDLOCK)
    WHERE BranchID = @branchId
      AND ISNULL(IsActive,1) = 1
      AND UPPER(LTRIM(RTRIM(Sub_Branch_Name))) = @subBranchName
  `);

    if (activeExists.recordset?.length) {
      const err = new Error("Sub-Branch Name already exists for this branch.");
      err.code = "DUPLICATE_SUB_BRANCH";
      err.existingId = activeExists.recordset[0].Sub_Branch_ID;
      throw err;
    }

    // 1) Revive ONLY ONE inactive row (latest)
    const revive = await request.query(`
    ;WITH x AS (
      SELECT TOP (1) *
      FROM GoGreen.OPS.Sub_Branch_Definition WITH (UPDLOCK, HOLDLOCK)
      WHERE BranchID = @branchId
        AND UPPER(LTRIM(RTRIM(Sub_Branch_Name))) = @subBranchName
        AND ISNULL(IsActive, 1) = 0
      ORDER BY Sub_Branch_ID DESC
    )
    UPDATE x
    SET
      IsActive = 1,
      DeletedOn = NULL,
      DeletedBy = NULL,
      EditedOn = NULL,
      EditedBy = NULL
    OUTPUT INSERTED.*;
  `);

    if (revive.recordset?.length) {
      const revivedId = revive.recordset[0].Sub_Branch_ID;

      // keep other duplicates inactive
      await request.query(`
      UPDATE GoGreen.OPS.Sub_Branch_Definition
      SET IsActive = 0
      WHERE BranchID = @branchId
        AND UPPER(LTRIM(RTRIM(Sub_Branch_Name))) = @subBranchName
        AND Sub_Branch_ID <> ${Number(revivedId)}
    `);

      return revive.recordset[0];
    }

    // 2) Insert new (atomic)
    const inserted = await request.query(`
    INSERT INTO GoGreen.OPS.Sub_Branch_Definition
      (BranchID, Sub_Branch_Name, Sub_Branch_Description, EnteredOn, EnteredBy, IsActive)
    OUTPUT INSERTED.*
    SELECT
      @branchId, @subBranchName, @subBranchDesc, GETDATE(), @enteredBy, 1
    WHERE NOT EXISTS (
      SELECT 1
      FROM GoGreen.OPS.Sub_Branch_Definition WITH (UPDLOCK, HOLDLOCK)
      WHERE BranchID = @branchId
        AND ISNULL(IsActive,1) = 1
        AND UPPER(LTRIM(RTRIM(Sub_Branch_Name))) = @subBranchName
    );
  `);

    if (!inserted.recordset?.length) {
      const err = new Error("Sub-Branch Name already exists for this branch.");
      err.code = "DUPLICATE_SUB_BRANCH";
      throw err;
    }

    return inserted.recordset[0];
  }

  // ---------- UPDATE ----------
  async updateSubBranch(id, { branchId, subBranchName, subBranchDesc, editedBy }) {
    const current = await this.getSubBranchById(id);
    if (!current) return null;

    const finalBranchId = Number(branchId ?? current.BranchID);

    const finalName =
      typeof subBranchName === "string" ? subBranchName : current.SubBranchName;

    // ✅ ALWAYS take description from payload (fallback "")
    const finalDesc = (subBranchDesc ?? "").toString().trim();

    const nameChanged = normalize(finalName) !== normalize(current.SubBranchName);
    const branchChanged = Number(finalBranchId) !== Number(current.BranchID);

    // only validate/duplicate check when branch or name changes
    if (nameChanged || branchChanged) {
      this.validateNameFormat(finalName);

      await this.ensureNoDuplicate({
        id: Number(id),
        branchId: finalBranchId,
        subBranchName: finalName,
      });
    }

    const pool = await getPool();
    const request = pool.request();

    request.input("id", sql.Int, Number(id));
    request.input("editedBy", sql.NVarChar(100), (editedBy || "Admin").trim());

    // ✅ ALWAYS send description param
    request.input("subBranchDesc", sql.NVarChar(200), finalDesc);

    if (branchChanged) request.input("branchId", sql.Int, finalBranchId);

    if (nameChanged) {
      request.input("subBranchName", sql.NVarChar(100), normalize(finalName));
    }

    const result = await request.query(`
    UPDATE GoGreen.OPS.Sub_Branch_Definition WITH (UPDLOCK, HOLDLOCK)
    SET
      ${branchChanged ? "BranchID = @branchId," : ""}
      ${nameChanged ? "Sub_Branch_Name = @subBranchName," : ""}
      Sub_Branch_Description = @subBranchDesc,
      EditedOn = GETDATE(),
      EditedBy = @editedBy
    OUTPUT INSERTED.*
    WHERE Sub_Branch_ID = @id
      AND ISNULL(IsActive, 1) = 1
  `);

    return result.recordset?.[0] || null;
  }

  // ---------- DELETE (SOFT) ----------
  async deleteSubBranch(id, deletedBy = "Admin") {
    const pool = await getPool();
    const request = pool.request();

    request.input("id", sql.Int, Number(id));
    request.input("deletedBy", sql.NVarChar(100), (deletedBy || "Admin").trim());

    const result = await request.query(`
        UPDATE GoGreen.OPS.Sub_Branch_Definition WITH (UPDLOCK, HOLDLOCK)
        SET
          IsActive = 0,
          DeletedOn = GETDATE(),
          DeletedBy = @deletedBy
        OUTPUT INSERTED.*
        WHERE Sub_Branch_ID = @id
          AND ISNULL(IsActive, 1) = 1
      `);

    return result.recordset?.[0] || null;
  }

  // ---------- DUPLICATE CHECK (ACTIVE ONLY) ----------
  async ensureNoDuplicate({ id = null, branchId, subBranchName }) {
    const pool = await getPool();
    const request = pool.request();

    request.input("branchId", sql.Int, Number(branchId));
    request.input("subBranchName", sql.NVarChar(100), normalize(subBranchName));

    let query = `
        SELECT TOP 1 Sub_Branch_ID
        FROM GoGreen.OPS.Sub_Branch_Definition WITH (UPDLOCK, HOLDLOCK)
        WHERE BranchID = @branchId
          AND ISNULL(IsActive, 1) = 1
          AND UPPER(LTRIM(RTRIM(Sub_Branch_Name))) = @subBranchName
      `;

    if (id) {
      request.input("id", sql.Int, Number(id));
      query += ` AND Sub_Branch_ID <> @id`;
    }

    const result = await request.query(query);

    if (result.recordset.length) {
      const err = new Error("Sub-Branch Name already exists for this branch.");
      err.code = "DUPLICATE_SUB_BRANCH";
      err.existingId = result.recordset[0].Sub_Branch_ID;
      throw err;
    }
  }

  // ---------- FORMAT VALIDATION ----------
  validateNameFormat(name) {
    const cleaned = (name || "").trim();
    const ok = /^[A-Za-z0-9\- ()]{1,100}$/.test(cleaned);

    if (!ok) {
      const err = new Error("Sub-Branch Name format is invalid.");
      err.code = "INVALID_FORMAT";
      throw err;
    }
  }
}

export const subBranchDefinitionService = new SubBranchDefinitionService();
