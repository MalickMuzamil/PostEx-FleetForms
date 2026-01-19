import sql from "mssql";
import { getPool } from "../config/sql-config.js";

const normalize = (v) => (v || "").trim().toUpperCase();

class SubBranchDefinitionService {
  // ---------- LIST BY BRAN    CH (ONLY ACTIVE) ----------
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
    request.input("id", sql.Int, id);

    const result = await request.query(`
      SELECT TOP 1
        s.Sub_Branch_ID          AS ID,
        s.Sub_Branch_ID          AS SubBranchID,
        s.BranchID               AS BranchID,
        s.Sub_Branch_Name        AS SubBranchName,
        s.Sub_Branch_Description AS SubBranchDesc,

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

  // ---------- CREATE ----------
  async createSubBranch({ branchId, subBranchName, enteredBy }) {
    this.validateNameFormat(subBranchName);

    const pool = await getPool();
    const request = pool.request();

    request.input("branchId", sql.Int, Number(branchId));
    request.input("subBranchName", sql.NVarChar(100), normalize(subBranchName));
    request.input("enteredBy", sql.NVarChar(100), (enteredBy || "Admin").trim());

    // 1) If exists but inactive -> revive it (no new row)
    const revive = await request.query(`
    UPDATE GoGreen.OPS.Sub_Branch_Definition
    SET
      IsActive = 1,
      EditedOn = NULL,
      EditedBy = NULL
    OUTPUT INSERTED.*
    WHERE BranchID = @branchId
      AND UPPER(LTRIM(RTRIM(Sub_Branch_Name))) = @subBranchName
      AND ISNULL(IsActive, 1) = 0
  `);

    if (revive.recordset?.length) return revive.recordset[0];

    // 2) Otherwise block duplicates among active
    await this.ensureNoDuplicate({ branchId, subBranchName });

    // 3) Insert new
    const inserted = await request.query(`
    INSERT INTO GoGreen.OPS.Sub_Branch_Definition
      (BranchID, Sub_Branch_Name, Sub_Branch_Description, EnteredOn, EnteredBy, IsActive)
    OUTPUT INSERTED.*
    VALUES
      (@branchId, @subBranchName, '', GETDATE(), @enteredBy, 1)
  `);

    return inserted.recordset?.[0] || null;
  }

  // ---------- UPDATE ----------
  async updateSubBranch(id, { branchId, subBranchName, editedBy }) {
    const current = await this.getSubBranchById(id);
    if (!current) return null;

    const finalBranchId = Number(branchId ?? current.BranchID);

    const finalName =
      typeof subBranchName === "string" ? subBranchName : current.SubBranchName;

    const nameChanged = normalize(finalName) !== normalize(current.SubBranchName);
    const branchChanged = Number(finalBranchId) !== Number(current.BranchID);

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

    if (branchChanged) request.input("branchId", sql.Int, finalBranchId);
    if (nameChanged) request.input("subBranchName", sql.NVarChar(100), normalize(finalName));

    const result = await request.query(`
      UPDATE GoGreen.OPS.Sub_Branch_Definition
      SET
        ${branchChanged ? "BranchID = @branchId," : ""}
        ${nameChanged ? "Sub_Branch_Name = @subBranchName," : ""}
        EditedOn = GETDATE(),
        EditedBy = @editedBy
      OUTPUT INSERTED.*
      WHERE Sub_Branch_ID = @id
        AND ISNULL(IsActive, 1) = 1
    `);

    return result.recordset?.[0] || null;
  }

  // ---------- DELETE (SOFT DELETE) ----------
  async deleteSubBranch(id, deletedBy = "Admin") {
    const pool = await getPool();
    const request = pool.request();

    request.input("id", sql.Int, id);
    request.input("deletedBy", sql.NVarChar(100), (deletedBy || "Admin").trim());

    const result = await request.query(`
      UPDATE GoGreen.OPS.Sub_Branch_Definition
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

  // ---------- DUPLICATE CHECK (ONLY ACTIVE) ----------
  async ensureNoDuplicate({ id = null, branchId, subBranchName }) {
    const pool = await getPool();
    const request = pool.request();

    request.input("branchId", sql.Int, Number(branchId));
    request.input("subBranchName", sql.NVarChar(100), normalize(subBranchName));

    let query = `
      SELECT TOP 1 Sub_Branch_ID
      FROM GoGreen.OPS.Sub_Branch_Definition
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
