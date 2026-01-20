import sql from "mssql";
import { getPool } from "../config/sql-config.js";

class BindingService {
  /* =========================
     LISTING APIS
  ========================== */

  async listActiveEmployees() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        E.EMP_ID,
        E.APP_Name,
        E.APP_NIC,
        E.APP_ACTIVE,
        E.DEP_ID,
        D.DEP_DESC AS DepartmentName,
        E.DES_ID,
        G.DES_DESC AS DesignationName
      FROM HRM.HR.Employees E
      LEFT JOIN HRM.HR.Department D ON E.DEP_ID = D.DEP_ID
      LEFT JOIN HRM.HR.Designation G ON E.DES_ID = G.DES_ID
      WHERE E.APP_ACTIVE = 1
      ORDER BY E.APP_Name
    `);
    return result.recordset;
  }

  async listBranches() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT *
      FROM HRM.HR.Branches
      ORDER BY BranchID
    `);
    return result.recordset;
  }

  async listBindings() {
  const pool = await getPool();
  const result = await pool.request().query(`
    ;WITH x AS (
      SELECT
        b.ID,
        b.BranchID,
        b.BC_Emp_ID,
        b.BC_Email,
        b.EffectiveDate,

        e.APP_Name AS EmployeeName,

        LAG(b.BC_Emp_ID) OVER (PARTITION BY b.BranchID ORDER BY b.EffectiveDate, b.ID) AS PrevEmpId,
        LAG(e.APP_Name)  OVER (PARTITION BY b.BranchID ORDER BY b.EffectiveDate, b.ID) AS PrevEmpName,

        LEAD(b.BC_Emp_ID) OVER (PARTITION BY b.BranchID ORDER BY b.EffectiveDate, b.ID) AS NextEmpId,
        LEAD(e.APP_Name)  OVER (PARTITION BY b.BranchID ORDER BY b.EffectiveDate, b.ID) AS NextEmpName,

        LEAD(b.EffectiveDate) OVER (PARTITION BY b.BranchID ORDER BY b.EffectiveDate, b.ID) AS NextEffectiveDate
      FROM GoGreen.OPS.Branch_BC_Binding b
      LEFT JOIN HRM.HR.Employees e ON e.EMP_ID = b.BC_Emp_ID
    )
    SELECT
      ID,
      BranchID,
      BC_Emp_ID,
      EmployeeName,
      BC_Email,
      EffectiveDate,

      PrevEmpId,
      PrevEmpName,
      NextEmpId,
      NextEmpName,

      -- Optional: timeline end date (till next effective date - 1 day)
      CASE 
        WHEN NextEffectiveDate IS NULL THEN NULL
        ELSE DATEADD(DAY, -1, CAST(NextEffectiveDate AS date))
      END AS EndDate,

      -- Optional: helpful label for UI
      CASE
        WHEN PrevEmpId IS NULL THEN 'First Assignment'
        WHEN PrevEmpId = BC_Emp_ID THEN 'Duplicate (should not happen)'
        ELSE 'Owner Changed'
      END AS ChangeType
    FROM x
    ORDER BY BranchID, EffectiveDate DESC, ID DESC;
  `);

  return result.recordset;
}


  async searchBindings({ empId, branchId, email, name }) {
    const pool = await getPool();
    const request = pool.request();

    request.input("empId", sql.Int, empId || null);
    request.input("branchId", sql.Int, branchId || null);
    request.input("email", sql.VarChar, email || null);
    request.input("name", sql.VarChar, name || null);

    const result = await request.query(`
      SELECT
        b.ID,
        b.BranchID,
        b.BC_Emp_ID,
        b.BC_Email,
        b.EffectiveDate,
        e.APP_Name
      FROM GoGreen.OPS.Branch_BC_Binding b
      LEFT JOIN HRM.HR.Employees e
        ON e.EMP_ID = b.BC_Emp_ID
      WHERE
        (@empId IS NULL OR b.BC_Emp_ID = @empId)
        AND (@branchId IS NULL OR b.BranchID = @branchId)
        AND (@email IS NULL OR b.BC_Email LIKE '%' + @email + '%')
        AND (@name IS NULL OR e.APP_Name LIKE '%' + @name + '%')
      ORDER BY b.EffectiveDate DESC, b.ID DESC
    `);

    return result.recordset;
  }

  /* =========================
     CREATE / UPDATE
  ========================== */

  async createBinding({ branchId, empId, email, effectiveDate }) {
    await this.ensureNoDuplicate({
      branchId,
      empId,
      effectiveDate,
    });

    const pool = await getPool();
    const request = pool.request();

    request.input("branchId", sql.Int, branchId);
    request.input("empId", sql.Int, empId);
    request.input("email", sql.VarChar, email);
    request.input("effectiveDate", sql.DateTime, effectiveDate);

    const result = await request.query(`
      INSERT INTO GoGreen.OPS.Branch_BC_Binding
        (BranchID, BC_Emp_ID, BC_Email, EffectiveDate)
      OUTPUT INSERTED.*
      VALUES
        (@branchId, @empId, @email, @effectiveDate)
    `);

    return result.recordset?.[0];
  }

  async updateBinding(id, body) {
    const numericId = Number(id);

    const branchId = Number(body.branchId);
    const empId = Number(body.empId);
    const email = body.email;
    const effectiveDate = body.effectiveDate;

    await this.ensureNoDuplicate({
      id: numericId,
      branchId,
      empId,
      effectiveDate,
    });

    const pool = await getPool();
    const request = pool.request();

    request.input("id", sql.Int, numericId);
    request.input("branchId", sql.Int, branchId);
    request.input("empId", sql.Int, empId);
    request.input("email", sql.VarChar, email);
    request.input("effectiveDate", sql.DateTime, effectiveDate);

    const result = await request.query(`
      UPDATE GoGreen.OPS.Branch_BC_Binding
      SET
        BranchID = @branchId,
        BC_Emp_ID = @empId,
        BC_Email = @email,
        EffectiveDate = @effectiveDate
      OUTPUT INSERTED.*
      WHERE ID = @id
    `);

    return result.recordset?.[0];
  }

  /* =========================
     DUPLICATE LOGIC (CORE)
  ========================== */

  async ensureNoDuplicate({ id = null, branchId, empId, effectiveDate }) {
    const pool = await getPool();
    const request = pool.request();

    request.input("id", sql.Int, id);
    request.input("branchId", sql.Int, branchId);
    request.input("empId", sql.Int, empId);
    request.input("effectiveDate", sql.DateTime, effectiveDate);

    // 1) Find previous assignment as-of effectiveDate
    // 2) Find next assignment after effectiveDate
    const result = await request.query(`
    ;WITH PrevRow AS (
      SELECT TOP 1 ID, BC_Emp_ID, EffectiveDate
      FROM GoGreen.OPS.Branch_BC_Binding
      WHERE BranchID = @branchId
        AND EffectiveDate <= @effectiveDate
        AND (@id IS NULL OR ID <> @id)
      ORDER BY EffectiveDate DESC, ID DESC
    ),
    NextRow AS (
      SELECT TOP 1 ID, BC_Emp_ID, EffectiveDate
      FROM GoGreen.OPS.Branch_BC_Binding
      WHERE BranchID = @branchId
        AND EffectiveDate > @effectiveDate
        AND (@id IS NULL OR ID <> @id)
      ORDER BY EffectiveDate ASC, ID ASC
    )
    SELECT
      (SELECT ID FROM PrevRow) AS PrevID,
      (SELECT BC_Emp_ID FROM PrevRow) AS PrevEmp,
      (SELECT EffectiveDate FROM PrevRow) AS PrevDate,
      (SELECT ID FROM NextRow) AS NextID,
      (SELECT BC_Emp_ID FROM NextRow) AS NextEmp,
      (SELECT EffectiveDate FROM NextRow) AS NextDate
  `);

    const row = result.recordset?.[0] || {};
    const prevEmp = row.PrevEmp != null ? Number(row.PrevEmp) : null;
    const nextEmp = row.NextEmp != null ? Number(row.NextEmp) : null;
    const newEmp = Number(empId);

    // RULE A: If already owner at that timeline, don't allow duplicate
    if (prevEmp !== null && prevEmp === newEmp) {
      const err = new Error(
        "Duplicate: This branch is already assigned to this employee for this timeline."
      );
      err.code = "DUPLICATE_BINDING";
      err.existingId = row.PrevID;
      throw err;
    }

    // RULE B: If next assignment is same employee, this insertion is redundant (creates A ... A)
    // Example: you insert A at 2025, but next is already A at 2026 => pointless/duplicate timeline
    if (nextEmp !== null && nextEmp === newEmp) {
      const err = new Error(
        "Duplicate: A future assignment already assigns this branch to the same employee. Update the existing future row instead."
      );
      err.code = "DUPLICATE_BINDING_FUTURE";
      err.existingId = row.NextID;
      throw err;
    }

    // Optional but recommended:
    // RULE C: Prevent exact same effectiveDate record for same branch (date collision)
    // (If you want strict: one row per branch per effectiveDate)
    const collisionReq = pool.request();
    collisionReq.input("id", sql.Int, id);
    collisionReq.input("branchId", sql.Int, branchId);
    collisionReq.input("effectiveDate", sql.DateTime, effectiveDate);

    const collision = await collisionReq.query(`
    SELECT TOP 1 ID
    FROM GoGreen.OPS.Branch_BC_Binding
    WHERE BranchID = @branchId
      AND EffectiveDate = @effectiveDate
      AND (@id IS NULL OR ID <> @id)
    ORDER BY ID DESC
  `);

    if (collision.recordset?.[0]?.ID) {
      const err = new Error("Duplicate: This branch already has an assignment on the same effective date.");
      err.code = "EFFECTIVE_DATE_COLLISION";
      err.existingId = collision.recordset[0].ID;
      throw err;
    }
  }


}

export const bindingService = new BindingService();
