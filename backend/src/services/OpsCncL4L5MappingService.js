import sql from "mssql";
import { getPool } from "../config/sql-config.js";

class OpsCncL4L5MappingService {

  /* ===========================
     GET ALL
  ============================ */

  async getAll() {
    const pool = await getPool();

    const result = await pool.request().query(`
      SELECT
        m.ID AS id,

        m.Ops_CnC_L4_ID AS cncL4Id,
        l4.Ops_CnC_L4_Name AS cncL4Code,
        l4.Ops_CnC_L4_Description AS cncL4Description,

        m.Ops_CnC_L5_ID AS cncL5Id,
        l5.Ops_CnC_L5_Name AS cncL5Code,
        l5.Ops_CnC_L5_Description AS cncL5Description,

        m.EffectiveDate AS effectiveDate

      FROM GoGreen.OPS.OpsCnCL4_OpsCnCL5_Binding m

      LEFT JOIN GoGreen.OPS.ops_CnC_L4_definition l4
        ON l4.Ops_CnC_L4_Id = m.Ops_CnC_L4_ID

      LEFT JOIN GoGreen.OPS.ops_CnC_L5_definition l5
        ON l5.Ops_CnC_L5_Id = m.Ops_CnC_L5_ID

      ORDER BY m.ID ASC
    `);

    return result.recordset;
  }

  /* ===========================
     DROPDOWNS
  ============================ */

  async getCnCL4List() {
    const pool = await getPool();

    const result = await pool.request().query(`
      SELECT
        Ops_CnC_L4_Id AS id,
        Ops_CnC_L4_Name AS name,
        Ops_CnC_L4_Description AS [desc]
      FROM GoGreen.OPS.ops_CnC_L4_definition
      ORDER BY Ops_CnC_L4_Name
    `);

    return result.recordset;
  }

  async getCnCL5List() {
    const pool = await getPool();

    const result = await pool.request().query(`
      SELECT
        Ops_CnC_L5_Id AS id,
        Ops_CnC_L5_Name AS name,
        Ops_CnC_L5_Description AS [desc]
      FROM GoGreen.OPS.ops_CnC_L5_definition
      ORDER BY Ops_CnC_L5_Name
    `);

    return result.recordset;
  }

  /* ===========================
     CREATE
  ============================ */

  async create(data) {
    try {

      await this.ensureRules(data);

      const pool = await getPool();
      const request = pool.request();

      request.input("cncL4Id", sql.Int, data.cncL4Id);
      request.input("cncL5Id", sql.Int, data.cncL5Id);
      request.input("effectiveDate", sql.DateTime, data.effectiveDate);

      const result = await request.query(`
        INSERT INTO GoGreen.OPS.OpsCnCL4_OpsCnCL5_Binding
          (Ops_CnC_L4_ID, Ops_CnC_L5_ID, EffectiveDate)
        OUTPUT INSERTED.*
        VALUES
          (@cncL4Id, @cncL5Id, @effectiveDate)
      `);

      return result.recordset[0];

    } catch (err) {

      if (err.number === 2601 || err.number === 2627) {
        throw new Error("Duplicate mapping already exists");
      }

      throw err;
    }
  }

  /* ===========================
     UPDATE
  ============================ */

  async update(id, data) {
    try {

      await this.ensureRules({
        id: Number(id),
        ...data
      });

      const pool = await getPool();
      const request = pool.request();

      request.input("id", sql.Int, Number(id));
      request.input("cncL4Id", sql.Int, data.cncL4Id);
      request.input("cncL5Id", sql.Int, data.cncL5Id);
      request.input("effectiveDate", sql.DateTime, data.effectiveDate);

      const result = await request.query(`
        UPDATE GoGreen.OPS.OpsCnCL4_OpsCnCL5_Binding
        SET
          Ops_CnC_L4_ID = @cncL4Id,
          Ops_CnC_L5_ID = @cncL5Id,
          EffectiveDate = @effectiveDate
        OUTPUT INSERTED.*
        WHERE ID = @id
      `);

      return result.recordset[0];

    } catch (err) {

      if (err.number === 2601 || err.number === 2627) {
        throw new Error("Duplicate mapping already exists");
      }

      throw err;
    }
  }

  /* ===========================
     RULE ENFORCER
  ============================ */

  async ensureRules({ id = 0, cncL4Id, cncL5Id, effectiveDate }) {

    const pool = await getPool();
    const request = pool.request();

    request.input("id", sql.Int, id);
    request.input("cncL4Id", sql.Int, cncL4Id);
    request.input("cncL5Id", sql.Int, cncL5Id);
    request.input("effectiveDate", sql.DateTime, effectiveDate);

    /* === Same date duplicate === */

    const dup = await request.query(`
      SELECT 1
      FROM GoGreen.OPS.OpsCnCL4_OpsCnCL5_Binding
      WHERE
        ID <> @id
        AND Ops_CnC_L4_ID = @cncL4Id
        AND Ops_CnC_L5_ID = @cncL5Id
        AND CAST(EffectiveDate AS DATE)
            = CAST(@effectiveDate AS DATE)
    `);

    if (dup.recordset.length) {
      const err = new Error("Duplicate mapping for same date");
      err.code = "DUPLICATE_MAPPING";
      throw err;
    }

    /* === Fetch existing === */

    const existing = await request.query(`
      SELECT ID, EffectiveDate
      FROM GoGreen.OPS.OpsCnCL4_OpsCnCL5_Binding
      WHERE
        Ops_CnC_L4_ID = @cncL4Id
        AND Ops_CnC_L5_ID = @cncL5Id
        AND ID <> @id
      ORDER BY EffectiveDate
    `);

    const rows = existing.recordset;

    if (rows.length >= 2) {
      const err = new Error(
        "Only two effective dated records allowed for same CNC L4 and CNC L5"
      );
      err.code = "MAX_LIMIT";
      throw err;
    }

    if (rows.length === 1) {
      const oldDate = new Date(rows[0].EffectiveDate);
      const newDate = new Date(effectiveDate);

      if (newDate <= oldDate) {
        const err = new Error(
          "New effective date must be greater than existing effective date"
        );
        err.code = "INVALID_DATE_SEQUENCE";
        throw err;
      }
    }
  }

}

export const opsCncL4L5MappingService =
  new OpsCncL4L5MappingService();
