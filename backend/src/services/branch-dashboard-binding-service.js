import sql from "mssql";
import { getPool } from "../config/sql-config.js";

class BranchDashboardBindingService {
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
      SELECT
        b.ID,
        b.BranchID,
        b.Req_Con_Call,
        b.EffectiveDate,
        br.BranchName,
        br.BranchDesc
      FROM GoGreen.OPS.Branch_RequiredinDashboard_Binding b
      LEFT JOIN HRM.HR.Branches br
        ON br.BranchID = b.BranchID
      ORDER BY b.ID DESC
    `);
    return result.recordset;
  }

  async getBindingByBranchId(branchId) {
    const pool = await getPool();
    const request = pool.request();
    request.input("branchId", sql.Int, branchId);

    const result = await request.query(`
      SELECT TOP 1 *
      FROM GoGreen.OPS.Branch_RequiredinDashboard_Binding
      WHERE BranchID = @branchId
    `);

    return result.recordset?.[0] || null;
  }

  async createBinding({ branchId, effectiveDate }) {
    // ✅ block duplicate branch
    await this.ensureNoDuplicate({ branchId });

    const pool = await getPool();
    const request = pool.request();

    request.input("branchId", sql.Int, branchId);
    request.input("reqConCall", sql.Int, 1); // default
    request.input("effectiveDate", sql.DateTime, effectiveDate);

    const result = await request.query(`
      INSERT INTO GoGreen.OPS.Branch_RequiredinDashboard_Binding
        (BranchID, Req_Con_Call, EffectiveDate)
      OUTPUT INSERTED.*
      VALUES
        (@branchId, @reqConCall, @effectiveDate)
    `);

    return result.recordset?.[0];
  }

  async updateBinding(id, { branchId, reqConCall, effectiveDate }) {
    if (branchId) {
      await this.ensureNoDuplicate({ id: Number(id), branchId: Number(branchId) });
    }

    const pool = await getPool();
    const request = pool.request();

    request.input("id", sql.Int, id);
    request.input("reqConCall", sql.Int, reqConCall);
    request.input("effectiveDate", sql.DateTime, effectiveDate);

    if (branchId) request.input("branchId", sql.Int, branchId);

    const result = await request.query(`
      UPDATE GoGreen.OPS.Branch_RequiredinDashboard_Binding
      SET
        ${branchId ? "BranchID = @branchId," : ""}
        Req_Con_Call = @reqConCall,
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
      DELETE FROM GoGreen.OPS.Branch_RequiredinDashboard_Binding
      OUTPUT DELETED.*
      WHERE ID = @id
    `);

    return result.recordset?.[0];
  }

  async ensureNoDuplicate({ id = null, branchId }) {
    const pool = await getPool();
    const request = pool.request();

    request.input("id", sql.Int, id);
    request.input("branchId", sql.Int, branchId);

    const result = await request.query(`
      SELECT TOP 1 ID
      FROM GoGreen.OPS.Branch_RequiredinDashboard_Binding
      WHERE BranchID = @branchId
        AND (@id IS NULL OR ID <> @id)
    `);

    if (result.recordset?.length) {
      const err = new Error("This branch has already been bound. No new entry allowed.");
      err.code = "DUPLICATE_BRANCH";
      err.existingId = result.recordset[0].ID;
      throw err;
    }
  }
}

export const branchDashboardBindingService = new BranchDashboardBindingService();
