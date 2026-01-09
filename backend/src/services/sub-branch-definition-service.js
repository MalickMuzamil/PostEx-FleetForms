import sql from "mssql";
import { getPool } from "../config/sql-config.js";


const normalize = (v) => (v || "").trim().toUpperCase();

class SubBranchDefinitionService {


  async listSubBranchesByBranchId(branchId) {
    const pool = await getPool();
    const request = pool.request();
    request.input("branchId", sql.Int, Number(branchId));

    const result = await request.query(`
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
    WHERE s.BranchID = @branchId
    ORDER BY s.Sub_Branch_ID DESC
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

  // ---------- LIST ALL SUB-BRANCHES ----------
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
    ORDER BY s.Sub_Branch_ID DESC
  `);
    return result.recordset;
  }

  // ---------- GET BY ID ----------
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
  `);

    return result.recordset?.[0] || null;
  }

  // ---------- CREATE ----------
  async createSubBranch({ branchId, subBranchName, enteredBy }) {
    await this.ensureNoDuplicate({ branchId, subBranchName });
    this.validateNameFormat(subBranchName);

    const pool = await getPool();
    const request = pool.request();

    request.input("branchId", sql.Int, branchId);
    request.input("subBranchName", sql.NVarChar(100), subBranchName.trim());
    request.input("subBranchDesc", sql.NVarChar(200), ""); // 👈 ADD THIS
    request.input("enteredBy", sql.NVarChar(100), (enteredBy || "Admin").trim());

    const result = await request.query(`
    INSERT INTO GoGreen.OPS.Sub_Branch_Definition
      (BranchID, Sub_Branch_Name, Sub_Branch_Description, EnteredOn, EnteredBy)
    OUTPUT INSERTED.*
    VALUES
      (@branchId, @subBranchName, @subBranchDesc, GETDATE(), @enteredBy)
  `);

    return result.recordset?.[0] || null;
  }

  // ---------- UPDATE ----------
  async updateSubBranch(id, { branchId, subBranchName, editedBy }) {
    const current = await this.getSubBranchById(id);
    if (!current) return null;

    const finalBranchId = Number(branchId ?? current.BranchID);

    const finalName =
      typeof subBranchName === "string"
        ? subBranchName
        : current.SubBranchName;

    const nameChanged =
      normalize(finalName) !== normalize(current.SubBranchName);

    const branchChanged =
      Number(finalBranchId) !== Number(current.BranchID);

    // ✅ DUPLICATE CHECK (ONLY WHEN NEEDED)
    if (nameChanged || branchChanged) {
      this.validateNameFormat(finalName);

      await this.ensureNoDuplicate({
        id: Number(id),                 // 👈 ignore current record
        branchId: finalBranchId,        // 👈 same branch check
        subBranchName: finalName,       // 👈 new name
      });
    }

    const pool = await getPool();
    const request = pool.request();

    request.input("id", sql.Int, Number(id));
    request.input(
      "editedBy",
      sql.NVarChar(100),
      (editedBy || "Admin").trim()
    );

    if (branchChanged) {
      request.input("branchId", sql.Int, finalBranchId);
    }

    if (nameChanged) {
      request.input(
        "subBranchName",
        sql.NVarChar(100),
        normalize(finalName)
      );
    }

    const result = await request.query(`
    UPDATE GoGreen.OPS.Sub_Branch_Definition
    SET
      ${branchChanged ? "BranchID = @branchId," : ""}
      ${nameChanged ? "Sub_Branch_Name = @subBranchName," : ""}
      EditedOn = GETDATE(),
      EditedBy = @editedBy
    OUTPUT INSERTED.*
    WHERE Sub_Branch_ID = @id
  `);

    return result.recordset?.[0] || null;
  }


  // ---------- DELETE ----------
  async deleteSubBranch(id) {
    const pool = await getPool();
    const request = pool.request();
    request.input("id", sql.Int, id);

    const result = await request.query(`
      DELETE FROM GoGreen.OPS.Sub_Branch_Definition
      OUTPUT DELETED.*
      WHERE Sub_Branch_ID = @id
    `);

    return result.recordset?.[0] || null;
  }

  // ---------- DUPLICATE CHECK ----------
  async ensureNoDuplicate({ id = null, branchId, subBranchName }) {
    const pool = await getPool();
    const request = pool.request();

    request.input("branchId", sql.Int, Number(branchId));
    request.input(
      "subBranchName",
      sql.NVarChar(100),
      normalize(subBranchName)
    );

    let query = `
    SELECT TOP 1 Sub_Branch_ID
    FROM GoGreen.OPS.Sub_Branch_Definition
    WHERE BranchID = @branchId
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

    // allow: letters/digits/space/hyphen/parentheses, 1..100
    // (aap data me codes like LHE-H01-ICH aur text with ( ) hai)
    const ok = /^[A-Za-z0-9\- ()]{1,100}$/.test(cleaned);

    if (!ok) {
      const err = new Error("Sub-Branch Name format is invalid.");
      err.code = "INVALID_FORMAT";
      throw err;
    }
  }
}

export const subBranchDefinitionService = new SubBranchDefinitionService();
