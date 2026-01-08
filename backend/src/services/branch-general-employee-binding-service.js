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
      SELECT EMP_ID, APP_Name, APP_NIC
      FROM HRM.HR.Employees
      WHERE APP_ACTIVE = 1
      ORDER BY APP_Name
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
    await this.ensureNoDuplicate({ branchId, empId, email });

    const pool = await getPool();
    const request = pool.request();

    request.input("branchId", sql.Int, branchId);
    request.input("empId", sql.Int, empId);
    request.input("email", sql.VarChar(150), email);
    request.input("effectiveDate", sql.DateTime, effectiveDate);
    request.input("status", sql.Int, status);

    const result = await request.query(`
      INSERT INTO GoGreen.OPS.Branch_GeneralEmp_Binding
        (BranchID, Emp_ID, Email, EffectiveDate, Status)
      OUTPUT INSERTED.*
      VALUES
        (@branchId, @empId, @email, @effectiveDate, @status)
    `);

    return result.recordset?.[0];
  }

  async updateBinding(id, { branchId, empId, email, effectiveDate, status }) {
    await this.ensureNoDuplicate({ id: Number(id), branchId, empId, email });

    const pool = await getPool();
    const request = pool.request();

    request.input("id", sql.Int, id);
    request.input("branchId", sql.Int, branchId);
    request.input("empId", sql.Int, empId);
    request.input("email", sql.VarChar(150), email);
    request.input("effectiveDate", sql.DateTime, effectiveDate);
    request.input("status", sql.Int, status);

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

  // 🔹 Delete
  async deleteBinding(id) {
    const pool = await getPool();
    const request = pool.request();

    request.input("id", sql.Int, id);

    const result = await request.query(`
      DELETE FROM GoGreen.OPS.Branch_GeneralEmp_Binding
      OUTPUT DELETED.*
      WHERE ID = @id
    `);

    return result.recordset?.[0];
  }

  async ensureNoDuplicate({ id = null, branchId, empId, email }) {
    const pool = await getPool();
    const request = pool.request();

    request.input("id", sql.Int, id);
    request.input("branchId", sql.Int, branchId);
    request.input("empId", sql.Int, empId);
    request.input("email", sql.VarChar(150), (email || "").trim());

    const result = await request.query(`
      SELECT TOP 1 ID
      FROM GoGreen.OPS.Branch_GeneralEmp_Binding
      WHERE
        (@id IS NULL OR ID <> @id)
        AND (
          -- Rule A: same employee + same email (main)
          (Emp_ID = @empId AND Email = @email)

          -- Rule B (recommended): same branch + same employee
          OR (BranchID = @branchId AND Emp_ID = @empId)

          -- Rule C (optional): same branch + same email
          -- OR (BranchID = @branchId AND Email = @email)
        )
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
