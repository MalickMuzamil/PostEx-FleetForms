import sql from "mssql";
import { getPool } from "../config/sql-config.js";

class BindingService {
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
      SELECT *
      FROM GoGreen.OPS.Branch_BC_Binding
      ORDER BY ID DESC
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
        (@empId   IS NULL OR b.BC_Emp_ID = @empId)
        AND (@branchId IS NULL OR b.BranchID = @branchId)
        AND (@email   IS NULL OR b.BC_Email LIKE '%' + @email + '%')
        AND (@name    IS NULL OR e.APP_Name LIKE '%' + @name + '%')
        AND (e.APP_ACTIVE = 1 OR e.APP_ACTIVE IS NULL)
      ORDER BY b.ID DESC
    `);

    return result.recordset;
  }

  async createBinding({ branchId, empId, email, effectiveDate }) {
    await this.ensureNoDuplicate({ branchId, empId, email });
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
      email,
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

  async deleteBinding(id) {
    const pool = await getPool();
    const request = pool.request();

    request.input("id", sql.Int, id);

    const result = await request.query(`
    DELETE FROM GoGreen.OPS.Branch_BC_Binding
    OUTPUT DELETED.*
    WHERE ID = @id
  `);

    return result.recordset?.[0];
  }

  async ensureNoDuplicate({ id, branchId, empId }) {
    const pool = await getPool();
    const request = pool.request();

    request.input("id", sql.Int, id);
    request.input("branchId", sql.Int, branchId);
    request.input("empId", sql.Int, empId);

    const result = await request.query(`
    SELECT TOP 1 ID
    FROM GoGreen.OPS.Branch_BC_Binding
    WHERE
      ID <> @id
      AND BranchID = @branchId
      AND BC_Emp_ID = @empId
  `);

    if (result.recordset.length) {
      const err = new Error("Duplicate binding");
      err.code = "DUPLICATE_BINDING";
      err.existingId = result.recordset[0].ID;
      throw err;
    }
  }



}

export const bindingService = new BindingService();
