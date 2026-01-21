// services/delivery-route-definition-service.js
import sql from "mssql";
import { getPool } from "../config/sql-config.js";

class DeliveryRouteDefinitionService {
  // GET: /delivery-routes
  async listRoutes() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT *
      FROM [GoGreen].[OPS].[CorrectDescForReports]
      ORDER BY Id DESC
    `);
    return result.recordset;
  }

  // POST: /delivery-routes
  async createRoute({ routeDescription }) {
    await this.ensureNoDuplicate({ routeDescription });

    const pool = await getPool();
    const request = pool.request();

    request.input("description", sql.VarChar(sql.MAX), routeDescription.trim());

    const result = await request.query(`
      INSERT INTO [GoGreen].[OPS].[CorrectDescForReports]
        (CorrectionDescriptionforReports)
      VALUES
        (@description);

      SELECT *
      FROM [GoGreen].[OPS].[CorrectDescForReports]
      WHERE Id = SCOPE_IDENTITY();
    `);

    return result.recordset?.[0];
  }

  // DELETE: /delivery-routes/:id
  async deleteRoute(id) {
    const pool = await getPool();
    const request = pool.request();
    request.input("id", sql.Int, id);

    const result = await request.query(`
      SELECT *
      FROM [GoGreen].[OPS].[CorrectDescForReports]
      WHERE Id = @id;

      DELETE FROM [GoGreen].[OPS].[CorrectDescForReports]
      WHERE Id = @id;
    `);

    return result.recordset?.[0] || null;
  }

  // PUT: /delivery-routes/:id
  async updateRoute(id, { routeDescription, editedBy = "Admin" }) {
    if (!id) return null;

    const desc = (routeDescription ?? "").toString().trim();

    // ✅ duplicate check (exclude current id)
    const pool = await getPool();
    const request = pool.request();

    request.input("id", sql.Int, Number(id));
    request.input("description", sql.VarChar(sql.MAX), desc);

    const dup = await request.query(`
    SELECT TOP 1 Id
    FROM [GoGreen].[OPS].[CorrectDescForReports]
    WHERE CorrectionDescriptionforReports = @description
      AND Id <> @id
  `);

    if (dup.recordset?.length) {
      const err = new Error("Duplicate delivery route description");
      err.code = "DUPLICATE_DELIVERY_ROUTE_DESC";
      err.existingId = dup.recordset[0].Id;
      throw err;
    }

    // ✅ update + return updated row
    const result = await request.query(`
    UPDATE [GoGreen].[OPS].[CorrectDescForReports]
    SET CorrectionDescriptionforReports = @description
    OUTPUT INSERTED.*
    WHERE Id = @id
  `);

    return result.recordset?.[0] || null;
  }

  // Duplicate check (RouteDescription unique)
  async ensureNoDuplicate({ routeDescription }) {
    const pool = await getPool();
    const request = pool.request();

    request.input("description", sql.VarChar(sql.MAX), routeDescription.trim());

    const result = await request.query(`
      SELECT TOP 1 Id
      FROM [GoGreen].[OPS].[CorrectDescForReports]
      WHERE CorrectionDescriptionforReports = @description
    `);

    if (result.recordset.length) {
      const err = new Error("Duplicate delivery route description");
      err.code = "DUPLICATE_DELIVERY_ROUTE_DESC";
      err.existingId = result.recordset[0].Id;
      throw err;
    }
  }
}

export const deliveryRouteDefinitionService = new DeliveryRouteDefinitionService();
