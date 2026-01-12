import sql from "mssql";
import { getPool } from "../config/sql-config.js";

class SubBranchAssignmentDefinitionService {

  async listSubBranches() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        sb.Sub_Branch_ID          AS SubBranchID,
        sb.Sub_Branch_ID          AS ID,
        sb.Sub_Branch_Name        AS SubBranchName,
        sb.Sub_Branch_Description AS SubBranchDesc,
        sb.BranchID               AS BranchID,
        br.BranchName             AS BranchName
      FROM GoGreen.OPS.Sub_Branch_Definition sb
      LEFT JOIN HRM.HR.Branches br
        ON br.BranchID = sb.BranchID
      ORDER BY sb.Sub_Branch_ID
    `);

    return result.recordset;
  }

  async getSubBranchById(subBranchId) {
    const pool = await getPool();
    const request = pool.request();
    request.input("subBranchId", sql.Int, Number(subBranchId));

    const result = await request.query(`
      SELECT TOP 1
        sb.Sub_Branch_ID          AS SubBranchID,
        sb.Sub_Branch_ID          AS ID,
        sb.Sub_Branch_Name        AS SubBranchName,
        sb.Sub_Branch_Description AS SubBranchDesc,
        sb.BranchID               AS BranchID,
        br.BranchName             AS BranchName
      FROM GoGreen.OPS.Sub_Branch_Definition sb
      LEFT JOIN HRM.HR.Branches br
        ON br.BranchID = sb.BranchID
      WHERE sb.Sub_Branch_ID = @subBranchId
    `);

    return result.recordset?.[0] || null;
  }

  async listActiveEmployeesByBranch(branchId) {
    const pool = await getPool();
    const request = pool.request();
    request.input("branchId", sql.Int, Number(branchId));

    const result = await request.query(`
    SELECT 
      E.EMP_ID,
      E.APP_Name            AS EmployeeName,
      E.APP_Name            AS AppName,
      E.APP_ACTIVE,
      E.BRANCHID            AS BranchID,

      E.DEP_ID,
      D.DEP_DESC            AS DepartmentName,

      E.DES_ID,
      G.DES_DESC            AS DesignationName

    FROM HRM.HR.Employees E
    LEFT JOIN HRM.HR.Department D ON E.DEP_ID = D.DEP_ID
    LEFT JOIN HRM.HR.Designation G ON E.DES_ID = G.DES_ID
    WHERE E.APP_ACTIVE = 1
      AND E.BRANCHID = @branchId
    ORDER BY E.APP_Name
  `);

    return result.recordset;
  }

  // ===========================
  // TABLE LIST
  // ===========================

  async listAssignments() {
    const pool = await getPool();

    const result = await pool.request().query(`
    WITH A AS (
      SELECT
        a.ID,
        a.Sub_Branch_ID,
        a.Sub_Branch_Emp_ID,
        a.Sub_Branch_Email,
        a.EffectiveDate,

        ROW_NUMBER() OVER (
          PARTITION BY a.Sub_Branch_ID
          ORDER BY 
            CASE WHEN a.EffectiveDate <= GETDATE() THEN 0 ELSE 1 END,
            a.EffectiveDate DESC,
            a.ID DESC
        ) AS rn_latest_prefer_past
      FROM GoGreen.OPS.Sub_Branch_Assignment_Definition a
    )
    SELECT
      A.ID                      AS ID,
      A.Sub_Branch_ID           AS SubBranchID,
      sb.Sub_Branch_Name        AS SubBranchName,
      sb.BranchID               AS BranchID,
      br.BranchName             AS BranchName,
      A.Sub_Branch_Emp_ID       AS EmployeeId,
      e.APP_Name                AS EmployeeName,
      e.APP_ACTIVE              AS EmployeeActive,
      A.Sub_Branch_Email        AS Email,
      A.EffectiveDate           AS EffectiveDate,

      CASE
        WHEN A.EffectiveDate > GETDATE() THEN 'FUTURE'
        WHEN A.rn_latest_prefer_past = 1 AND A.EffectiveDate <= GETDATE() THEN 'ACTIVE'
        ELSE 'INACTIVE'
      END AS Status

    FROM A
    LEFT JOIN GoGreen.OPS.Sub_Branch_Definition sb
      ON sb.Sub_Branch_ID = A.Sub_Branch_ID
    LEFT JOIN HRM.HR.Branches br
      ON br.BranchID = sb.BranchID
    LEFT JOIN HRM.HR.Employees e
      ON e.EMP_ID = A.Sub_Branch_Emp_ID
    ORDER BY A.ID DESC
  `);

    return result.recordset;
  }


  async getAssignmentById(id) {
    const pool = await getPool();
    const request = pool.request();
    request.input("id", sql.Int, Number(id));

    const result = await request.query(`
      SELECT TOP 1
        a.ID               AS ID,
        a.Sub_Branch_ID     AS SubBranchID,
        a.Sub_Branch_Emp_ID AS EmployeeId,
        a.Sub_Branch_Email  AS Email,
        a.EffectiveDate     AS EffectiveDate
      FROM GoGreen.OPS.Sub_Branch_Assignment_Definition a
      WHERE a.ID = @id
    `);

    return result.recordset?.[0] || null;
  }

  // ===========================
  // CREATE (UPDATED: transaction + locking + duplicate effective date)
  // ===========================

  async createAssignment({ subBranchId, employeeId, email, effectiveDate }) {
    const sbId = Number(subBranchId) || null;
    const empId = Number(employeeId) || null;

    if (!sbId) { const e = new Error("Sub-Branch is required."); e.code = "SUB_BRANCH_REQUIRED"; e.status = 400; throw e; }
    if (!empId) { const e = new Error("Employee is required."); e.code = "EMP_REQUIRED"; e.status = 400; throw e; }

    const eff = this.ensureFutureDate(effectiveDate);
    const mail = this.validateEmail(email);

    const pool = await getPool();
    const tx = new sql.Transaction(pool);

    try {
      await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

      // 1) Sub-branch exists + BranchID
      let branchId = null;
      {
        const req = new sql.Request(tx);
        req.input("subBranchId", sql.Int, sbId);
        const r = await req.query(`
          SELECT TOP 1 sb.Sub_Branch_ID AS SubBranchID, sb.BranchID AS BranchID
          FROM GoGreen.OPS.Sub_Branch_Definition sb
          WHERE sb.Sub_Branch_ID = @subBranchId
        `);
        const sb = r.recordset?.[0];
        if (!sb) { const e = new Error("Selected Sub-Branch does not exist."); e.code = "SUB_BRANCH_NOT_FOUND"; e.status = 404; throw e; }
        branchId = Number(sb.BranchID) || null;
        if (!branchId) { const e = new Error("Branch not found for selected Sub-Branch."); e.code = "BRANCH_NOT_FOUND"; e.status = 404; throw e; }
      }

      // 2) Employee exists + active + branch match
      {
        const req = new sql.Request(tx);
        req.input("employeeId", sql.Int, empId);
        const er = await req.query(`
          SELECT TOP 1 EMP_ID, APP_ACTIVE, BranchID
          FROM HRM.HR.Employees
          WHERE EMP_ID = @employeeId
        `);
        const emp = er.recordset?.[0];
        if (!emp) { const e = new Error("Employee not found."); e.code = "EMP_NOT_FOUND"; e.status = 404; throw e; }
        if (Number(emp.APP_ACTIVE) !== 1) { const e = new Error("Selected user is not active. Please select an active user."); e.code = "EMP_INACTIVE"; e.status = 400; throw e; }
        if (Number(emp.BranchID) !== Number(branchId)) { const e = new Error("Employee does not belong to selected Branch."); e.code = "EMP_BRANCH_MISMATCH"; e.status = 400; throw e; }
      }

      // 3) Same SubBranch + same date not allowed
      {
        const req = new sql.Request(tx);
        req.input("subBranchId", sql.Int, sbId);
        req.input("effectiveDate", sql.DateTime, eff);

        const dup = await req.query(`
          SELECT TOP 1 ID, EffectiveDate
          FROM GoGreen.OPS.Sub_Branch_Assignment_Definition WITH (UPDLOCK, HOLDLOCK)
          WHERE Sub_Branch_ID = @subBranchId
            AND CONVERT(date, EffectiveDate) = CONVERT(date, @effectiveDate)
          ORDER BY ID DESC
        `);

        if (dup.recordset?.[0]) {
          const e = new Error("A binding already exists for this Sub-Branch with the same effective date.");
          e.code = "DUPLICATE_EFFECTIVE_DATE";
          e.status = 409;
          e.conflict = { ID: dup.recordset[0].ID, ExistingEffectiveDate: dup.recordset[0].EffectiveDate };
          throw e;
        }
      }

      // 4) If already a FUTURE definition exists for this SubBranch, deactivate it (delete)
      {
        const req = new sql.Request(tx);
        req.input("subBranchId", sql.Int, sbId);
        await req.query(`
          DELETE FROM GoGreen.OPS.Sub_Branch_Assignment_Definition
          WHERE Sub_Branch_ID = @subBranchId
            AND EffectiveDate > GETDATE()
        `);
      }

      // 5) Insert new future definition
      {
        const insertReq = new sql.Request(tx);
        insertReq.input("subBranchId", sql.Int, sbId);
        insertReq.input("employeeId", sql.Int, empId);
        insertReq.input("email", sql.VarChar(100), mail);
        insertReq.input("effectiveDate", sql.DateTime, eff);

        const ins = await insertReq.query(`
          INSERT INTO GoGreen.OPS.Sub_Branch_Assignment_Definition
            (Sub_Branch_ID, Sub_Branch_Emp_ID, Sub_Branch_Email, EffectiveDate)
          OUTPUT INSERTED.*
          VALUES
            (@subBranchId, @employeeId, @email, @effectiveDate)
        `);

        await tx.commit();
        return ins.recordset?.[0] || null;
      }

    } catch (e) {
      try { await tx.rollback(); } catch (_) { }
      throw e;
    }
  }


  // ===========================
  // UPDATE (safe validations)
  // ===========================

  async updateAssignment(id, payload) {
    const current = await this.getAssignmentById(id);
    if (!current) return null;

    const finalSubBranchId = Number(payload?.subBranchId ?? current.SubBranchID) || null;
    const finalEmployeeId = Number(payload?.employeeId ?? current.EmployeeId) || null;

    if (!finalSubBranchId) { const e = new Error("Sub-Branch is required."); e.code = "SUB_BRANCH_REQUIRED"; e.status = 400; throw e; }
    if (!finalEmployeeId) { const e = new Error("Employee is required."); e.code = "EMP_REQUIRED"; e.status = 400; throw e; }

    const finalEmail =
      typeof payload?.email === "string"
        ? this.validateEmail(payload.email)
        : this.validateEmail(current.Email);

    const finalEffective =
      payload?.effectiveDate
        ? this.ensureFutureDate(payload.effectiveDate)
        : this.ensureFutureDate(current.EffectiveDate);

    const pool = await getPool();
    const tx = new sql.Transaction(pool);

    try {
      await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

      // 1) Sub-branch exists + BranchID
      let branchId = null;
      {
        const req = new sql.Request(tx);
        req.input("subBranchId", sql.Int, finalSubBranchId);
        const r = await req.query(`
          SELECT TOP 1 sb.Sub_Branch_ID AS SubBranchID, sb.BranchID AS BranchID
          FROM GoGreen.OPS.Sub_Branch_Definition sb
          WHERE sb.Sub_Branch_ID = @subBranchId
        `);
        const sb = r.recordset?.[0];
        if (!sb) { const e = new Error("Selected Sub-Branch does not exist."); e.code = "SUB_BRANCH_NOT_FOUND"; e.status = 404; throw e; }
        branchId = Number(sb.BranchID) || null;
        if (!branchId) { const e = new Error("Branch not found for selected Sub-Branch."); e.code = "BRANCH_NOT_FOUND"; e.status = 404; throw e; }
      }

      // 2) Employee exists + active + branch match
      {
        const req = new sql.Request(tx);
        req.input("employeeId", sql.Int, finalEmployeeId);
        const er = await req.query(`
          SELECT TOP 1 EMP_ID, APP_ACTIVE, BranchID
          FROM HRM.HR.Employees
          WHERE EMP_ID = @employeeId
        `);
        const emp = er.recordset?.[0];
        if (!emp) { const e = new Error("Employee not found."); e.code = "EMP_NOT_FOUND"; e.status = 404; throw e; }
        if (Number(emp.APP_ACTIVE) !== 1) { const e = new Error("Selected user is not active. Please select an active user."); e.code = "EMP_INACTIVE"; e.status = 400; throw e; }
        if (Number(emp.BranchID) !== Number(branchId)) { const e = new Error("Employee does not belong to selected Branch."); e.code = "EMP_BRANCH_MISMATCH"; e.status = 400; throw e; }
      }

      // 3) same SubBranch + same date not allowed (exclude current row)
      {
        const req = new sql.Request(tx);
        req.input("id", sql.Int, Number(id));
        req.input("subBranchId", sql.Int, finalSubBranchId);
        req.input("effectiveDate", sql.DateTime, finalEffective);

        const dup = await req.query(`
          SELECT TOP 1 ID, EffectiveDate
          FROM GoGreen.OPS.Sub_Branch_Assignment_Definition WITH (UPDLOCK, HOLDLOCK)
          WHERE Sub_Branch_ID = @subBranchId
            AND CONVERT(date, EffectiveDate) = CONVERT(date, @effectiveDate)
            AND ID <> @id
          ORDER BY ID DESC
        `);

        if (dup.recordset?.[0]) {
          const e = new Error("A binding already exists for this Sub-Branch with the same effective date.");
          e.code = "DUPLICATE_EFFECTIVE_DATE";
          e.status = 409;
          e.conflict = { ID: dup.recordset[0].ID, ExistingEffectiveDate: dup.recordset[0].EffectiveDate };
          throw e;
        }
      }

      // 4) Deactivate any other FUTURE definition for this subbranch (delete), except current row
      {
        const req = new sql.Request(tx);
        req.input("id", sql.Int, Number(id));
        req.input("subBranchId", sql.Int, finalSubBranchId);
        await req.query(`
          DELETE FROM GoGreen.OPS.Sub_Branch_Assignment_Definition
          WHERE Sub_Branch_ID = @subBranchId
            AND EffectiveDate > GETDATE()
            AND ID <> @id
        `);
      }

      // 5) Update
      {
        const req = new sql.Request(tx);
        req.input("id", sql.Int, Number(id));
        req.input("subBranchId", sql.Int, finalSubBranchId);
        req.input("employeeId", sql.Int, finalEmployeeId);
        req.input("email", sql.VarChar(100), finalEmail);
        req.input("effectiveDate", sql.DateTime, finalEffective);

        const result = await req.query(`
          UPDATE GoGreen.OPS.Sub_Branch_Assignment_Definition
          SET
            Sub_Branch_ID = @subBranchId,
            Sub_Branch_Emp_ID = @employeeId,
            Sub_Branch_Email = @email,
            EffectiveDate = @effectiveDate
          OUTPUT INSERTED.*
          WHERE ID = @id
        `);

        await tx.commit();
        return result.recordset?.[0] || null;
      }

    } catch (e) {
      try { await tx.rollback(); } catch (_) { }
      throw e;
    }
  }



  // ===========================
  // DELETE
  // ===========================

  async deleteAssignment(id) {
    const pool = await getPool();
    const request = pool.request();
    request.input("id", sql.Int, Number(id));

    const result = await request.query(`
      DELETE FROM GoGreen.OPS.Sub_Branch_Assignment_Definition
      OUTPUT DELETED.*
      WHERE ID = @id
    `);

    return result.recordset?.[0] || null;
  }

  parseEffectiveDate(value) {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) {
      const err = new Error("Invalid effective date.");
      err.code = "INVALID_EFFECTIVE_DATE";
      err.status = 400;
      throw err;
    }
    return d;
  }

  validateEmail(value) {
    const v = String(value ?? "").trim();
    // simple & safe email check
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    if (!ok) {
      const err = new Error("Please enter a valid email address.");
      err.code = "INVALID_EMAIL";
      err.status = 400;
      throw err;
    }
    return v;
  }

  ensureFutureDate(eff) {
    // requirement: must always be in the future (not today)
    const d = this.parseEffectiveDate(eff);
    const now = new Date();
    const d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const n0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (d0 <= n0) {
      const err = new Error("Effective date cannot be a past date. Please select a future date.");
      err.code = "EFFECTIVE_DATE_NOT_FUTURE";
      err.status = 400;
      throw err;
    }
    return d;
  }
}

export const subBranchAssignmentDefinitionService =
  new SubBranchAssignmentDefinitionService();
