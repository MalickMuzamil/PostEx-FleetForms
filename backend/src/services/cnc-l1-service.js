import sql from "mssql";
import { getPool } from "../config/sql-config.js";

class OpsCncL1DefinitionService {
  async getAll() {
    const pool = await getPool();
    const result = await pool.request().query(`
     SELECT
    Ops_CnC_L1_Id          AS id,
    Ops_CnC_L1_Name        AS name,
    Ops_CnC_L1_Description AS description,
    Ops_CnC_L1_Role        AS role,
    EnteredOn              AS enteredOn,
    EnteredBy              AS enteredBy,
    EditedOn               AS editedOn,
    EditedBy               AS editedBy
  FROM GoGreen.OPS.ops_CnC_L1_definition
  ORDER BY Ops_CnC_L1_Id DESC
    `);

    return result.recordset;
  }

  async listRoles() {
    const pool = await getPool();
    const result = await pool.request().query(`
    SELECT DISTINCT Ops_CnC_L1_Role AS role
    FROM GoGreen.OPS.ops_CnC_L1_definition
    WHERE Ops_CnC_L1_Role IS NOT NULL
    ORDER BY Ops_CnC_L1_Role
  `);
    return result.recordset;
  }

  async search({ q }) {
    const pool = await getPool();
    const request = pool.request();

    request.input("q", sql.VarChar, q || null);

    const result = await request.query(`
      SELECT
        ID,
        Role,
        Name,
        Description,
        EnteredOn,
        EnteredBy,
        EditedOn,
        EditedBy
      FROM GoGreen.OPS.CnC_L1_Definition
      WHERE
        (@q IS NULL OR
          Name LIKE '%' + @q + '%' OR
          Description LIKE '%' + @q + '%' OR
          Role LIKE '%' + @q + '%' OR
          EnteredBy LIKE '%' + @q + '%' OR
          EditedBy LIKE '%' + @q + '%'
        )
      ORDER BY ID DESC
    `);

    return result.recordset;
  }

  async create({ role, name, description, enteredOn, enteredBy }) {
    await this.ensureNoDuplicate({ role, name });

    const pool = await getPool();
    const request = pool.request();

    request.input("role", sql.VarChar, role);
    request.input("name", sql.VarChar, name);
    request.input("description", sql.VarChar, description);
    request.input("enteredOn", sql.DateTime, enteredOn);
    request.input("enteredBy", sql.VarChar, enteredBy);

    const result = await request.query(`
    INSERT INTO GoGreen.OPS.ops_CnC_L1_definition
      (Ops_CnC_L1_Role, Ops_CnC_L1_Name, Ops_CnC_L1_Description, EnteredOn, EnteredBy, EditedOn, EditedBy)
    OUTPUT INSERTED.*
    VALUES
      (@role, @name, @description, @enteredOn, @enteredBy, NULL, NULL)
  `);

    return result.recordset?.[0];
  }

  async update(id, body) {
    const numericId = Number(id);

    const role = body.role;
    const name = body.name;
    const description = body.description;
    const enteredOn = body.enteredOn; // keep old
    const enteredBy = body.enteredBy; // keep old
    const editedOn = body.editedOn;
    const editedBy = body.editedBy;

    await this.ensureNoDuplicate({ id: numericId, role, name });

    const pool = await getPool();
    const request = pool.request();

    request.input("id", sql.Int, numericId);
    request.input("role", sql.VarChar, role);
    request.input("name", sql.VarChar, name);
    request.input("description", sql.VarChar, description);

    request.input("enteredOn", sql.DateTime, enteredOn);
    request.input("enteredBy", sql.VarChar, enteredBy);

    request.input("editedOn", sql.DateTime, editedOn);
    request.input("editedBy", sql.VarChar, editedBy);

    const result = await request.query(`
    UPDATE GoGreen.OPS.ops_CnC_L1_definition
    SET
      Ops_CnC_L1_Role = @role,
      Ops_CnC_L1_Name = @name,
      Ops_CnC_L1_Description = @description,
      EnteredOn = @enteredOn,
      EnteredBy = @enteredBy,
      EditedOn = @editedOn,
      EditedBy = @editedBy
    OUTPUT INSERTED.*
    WHERE Ops_CnC_L1_Id = @id
  `);

    return result.recordset?.[0];
  }
  
  async delete(id) {
    const pool = await getPool();
    const request = pool.request();

    request.input("id", sql.Int, Number(id));

    const result = await request.query(`
    DELETE FROM GoGreen.OPS.ops_CnC_L1_definition
    OUTPUT DELETED.*
    WHERE Ops_CnC_L1_Id = @id
  `);

    return result.recordset?.[0];
  }

  async ensureNoDuplicate({ id, role, name }) {
    const pool = await getPool();
    const request = pool.request();

    request.input("id", sql.Int, id || 0);
    request.input("role", sql.VarChar, role);
    request.input("name", sql.VarChar, name);

    const result = await request.query(`
    SELECT TOP 1 Ops_CnC_L1_Id AS ID
    FROM GoGreen.OPS.ops_CnC_L1_definition
    WHERE
      Ops_CnC_L1_Id <> @id
      AND Ops_CnC_L1_Role = @role
      AND Ops_CnC_L1_Name = @name
  `);

    if (result.recordset.length) {
      const err = new Error("Duplicate CnC L1 definition");
      err.code = "DUPLICATE_CNC_L1";
      err.existingId = result.recordset[0].ID;
      throw err;
    }
  }
}

export const opsCncL1DefinitionService = new OpsCncL1DefinitionService();
