import sql from "mssql";
import { getPool } from "../config/sql-config.js";

/**
 * Table:
 * GoGreen.OPS.Branch_GeneralEmp_Binding
 * Columns:
 * ID, BranchID, Emp_ID, Email, EffectiveDate, Status
 */
class BranchGeneralEmpBindingService {

  // 🔹 Active employees (dropdown)
  async listActiveEmployees() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
    E.EMP_ID,
    E.APP_Name,
    E.APP_NIC,
    E.APP_ACTIVE,
    E.DEP_ID,
    D.DEP_DESC      AS DepartmentName,
    E.DES_ID,
    G.DES_DESC      AS DesignationName
FROM HRM.HR.Employees E
LEFT JOIN HRM.HR.Department D
    ON E.DEP_ID = D.DEP_ID
LEFT JOIN HRM.HR.Designation G
    ON E.DES_ID = G.DES_ID
WHERE E.APP_ACTIVE = 1
ORDER BY E.APP_Name;
    `);
    return result.recordset;
  }

  // 🔹 Branches (dropdown)
  async listBranches() {
    const pool = await getPool();
    const result = await pool.request().query(`
    SELECT *
    FROM HRM.HR.Branches
    ORDER BY BranchID
  `);
    return result.recordset;
  }

  // 🔹 Table/List
  async listBindings() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        b.ID,
        b.BranchID,
        b.Emp_ID,
        b.Email,
        b.EffectiveDate,
        b.Status,
        e.APP_Name   AS EmployeeName,
        br.BranchName
      FROM GoGreen.OPS.Branch_GeneralEmp_Binding b
      LEFT JOIN HRM.HR.Employees e
        ON e.EMP_ID = b.Emp_ID
      LEFT JOIN HRM.HR.Branches br
        ON br.BranchID = b.BranchID
      ORDER BY b.ID DESC
    `);
    return result.recordset;
  }
  async createBinding({ branchId, empId, email, effectiveDate, status = 1 }) {
    const pool = await getPool();

    const checkReq = pool.request();
    checkReq.input("branchId", sql.Int, Number(branchId));
    checkReq.input("empId", sql.Int, Number(empId));

    const existingRes = await checkReq.query(`
    SELECT TOP 1 *
    FROM GoGreen.OPS.Branch_GeneralEmp_Binding
    WHERE BranchID = @branchId
      AND Emp_ID = @empId
    ORDER BY ID DESC
  `);

    const existing = existingRes.recordset?.[0];

    if (existing) {
      if (Number(existing.Status) === 1) {
        const err = new Error("Duplicate binding");
        err.code = "DUPLICATE_BINDING";
        err.existingId = existing.ID;
        throw err;
      }

      const reactReq = pool.request();
      reactReq.input("id", sql.Int, existing.ID);
      reactReq.input("email", sql.VarChar(150), (email || existing.Email || "").trim());
      reactReq.input("effectiveDate", sql.DateTime, effectiveDate ?? existing.EffectiveDate ?? null);
      reactReq.input("status", sql.Int, 1);

      const updated = await reactReq.query(`
      UPDATE GoGreen.OPS.Branch_GeneralEmp_Binding
      SET
        Email = @email,
        EffectiveDate = @effectiveDate,
        Status = @status
      OUTPUT INSERTED.*
      WHERE ID = @id
    `);

      return updated.recordset?.[0];
    }

    const request = pool.request();
    request.input("branchId", sql.Int, Number(branchId));
    request.input("empId", sql.Int, Number(empId));
    request.input("email", sql.VarChar(150), (email || "").trim());
    request.input("effectiveDate", sql.DateTime, effectiveDate ?? null);
    request.input("status", sql.Int, Number(status ?? 1));

    const result = await request.query(`
    INSERT INTO GoGreen.OPS.Branch_GeneralEmp_Binding
      (BranchID, Emp_ID, Email, EffectiveDate, Status)
    OUTPUT INSERTED.*
    VALUES
      (@branchId, @empId, @email, @effectiveDate, @status)
  `);

    return result.recordset?.[0];
  }

  // ✅ update: prevent making (BranchID+Emp_ID) duplicate with another ACTIVE row
  async updateBinding(id, { branchId, empId, email, effectiveDate, status }) {
    const pool = await getPool();
    const numericId = Number(id);

    // ✅ load existing row (for missing branchId/empId/status)
    const curReq = pool.request();
    curReq.input("id", sql.Int, numericId);

    const curRes = await curReq.query(`
    SELECT TOP 1 *
    FROM GoGreen.OPS.Branch_GeneralEmp_Binding
    WHERE ID = @id
  `);

    const current = curRes.recordset?.[0];
    if (!current) return null;

    const finalBranchId = Number(branchId ?? current.BranchID);
    const finalEmpId = Number(empId ?? current.Emp_ID);
    const finalEmail = (email ?? current.Email ?? "").trim();
    const finalEffectiveDate = effectiveDate ?? current.EffectiveDate ?? null;
    const finalStatus = Number(status ?? current.Status ?? 1);

    // ✅ prevent duplicate active pair on other row
    const dupReq = pool.request();
    dupReq.input("id", sql.Int, numericId);
    dupReq.input("branchId", sql.Int, finalBranchId);
    dupReq.input("empId", sql.Int, finalEmpId);

    const dup = await dupReq.query(`
    SELECT TOP 1 ID
    FROM GoGreen.OPS.Branch_GeneralEmp_Binding
    WHERE BranchID = @branchId
      AND Emp_ID = @empId
      AND Status = 1
      AND ID <> @id
    ORDER BY ID DESC
  `);

    if (dup.recordset?.[0]?.ID) {
      const err = new Error("Duplicate binding");
      err.code = "DUPLICATE_BINDING";
      err.existingId = dup.recordset[0].ID;
      throw err;
    }

    const request = pool.request();
    request.input("id", sql.Int, numericId);
    request.input("branchId", sql.Int, finalBranchId);
    request.input("empId", sql.Int, finalEmpId);
    request.input("email", sql.VarChar(150), finalEmail);
    request.input("effectiveDate", sql.DateTime, finalEffectiveDate);
    request.input("status", sql.Int, finalStatus);

    const result = await request.query(`
    UPDATE GoGreen.OPS.Branch_GeneralEmp_Binding
    SET
      BranchID = @branchId,
      Emp_ID = @empId,
      Email = @email,
      EffectiveDate = @effectiveDate,
      Status = @status
    OUTPUT INSERTED.*
    WHERE ID = @id
  `);

    return result.recordset?.[0];
  }


  // ✅ delete => soft delete (Status=0)
  async deleteBinding(id) {
    const pool = await getPool();
    const request = pool.request();

    request.input("id", sql.Int, Number(id));

    const result = await request.query(`
    UPDATE GoGreen.OPS.Branch_GeneralEmp_Binding
    SET Status = 0
    OUTPUT INSERTED.*
    WHERE ID = @id
  `);

    return result.recordset?.[0];
  }

  // ✅ duplicate check: ONLY BranchID + Emp_ID (ignore email/effectiveDate)
  async ensureNoDuplicate({ id = null, branchId, empId }) {
    const pool = await getPool();
    const request = pool.request();

    request.input("id", sql.Int, id);
    request.input("branchId", sql.Int, Number(branchId));
    request.input("empId", sql.Int, Number(empId));

    const result = await request.query(`
    SELECT TOP 1 ID
    FROM GoGreen.OPS.Branch_GeneralEmp_Binding
    WHERE BranchID = @branchId
      AND Emp_ID = @empId
      AND (@id IS NULL OR ID <> @id)
    ORDER BY ID DESC
  `);

    if (result.recordset?.length) {
      const err = new Error("Duplicate binding");
      err.code = "DUPLICATE_BINDING";
      err.existingId = result.recordset[0].ID;
      throw err;
    }
  }

}

export const branchGeneralEmpBindingService =
  new BranchGeneralEmpBindingService();
