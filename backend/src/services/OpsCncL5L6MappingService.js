import sql from "mssql";
import { getPool } from "../config/sql-config.js";

class OpsCncL5L6MappingService {

    /* ===========================
       GET ALL
    ============================ */

    async getAll() {
        const pool = await getPool();

        const result = await pool.request().query(`
      SELECT
        m.ID AS id,

        m.Ops_CnC_L5_ID AS cncL5Id,
        l5.Ops_CnC_L5_Name AS cncL5Code,
        l5.Ops_CnC_L5_Description AS cncL5Description,

        m.Ops_CnC_L6_ID AS cncL6Id,
        l6.Ops_CnC_L6_Name AS cncL6Code,
        l6.Ops_CnC_L6_Description AS cncL6Description,

        m.EffectiveDate AS effectiveDate

      FROM GoGreen.OPS.OpsCnCL5_OpsCnCL6_Binding m

      LEFT JOIN GoGreen.OPS.ops_CnC_L5_definition l5
        ON l5.Ops_CnC_L5_Id = m.Ops_CnC_L5_ID

      LEFT JOIN GoGreen.OPS.ops_CnC_L6_definition l6
        ON l6.Ops_CnC_L6_Id = m.Ops_CnC_L6_ID

      ORDER BY m.ID ASC
    `);

        return result.recordset;
    }

    /* ===========================
       DROPDOWNS
    ============================ */

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

    async getCnCL6List() {
        const pool = await getPool();

        const result = await pool.request().query(`
      SELECT
        Ops_CnC_L6_Id AS id,
        Ops_CnC_L6_Name AS name,
        Ops_CnC_L6_Description AS [desc]
      FROM GoGreen.OPS.ops_CnC_L6_definition
      ORDER BY Ops_CnC_L6_Name
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

            request.input("cncL5Id", sql.Int, data.cncL5Id);
            request.input("cncL6Id", sql.Int, data.cncL6Id);
            request.input("effectiveDate", sql.DateTime, data.effectiveDate);

            const result = await request.query(`
        INSERT INTO GoGreen.OPS.OpsCnCL5_OpsCnCL6_Binding
          (Ops_CnC_L5_ID, Ops_CnC_L6_ID, EffectiveDate)
        OUTPUT INSERTED.*
        VALUES
          (@cncL5Id, @cncL6Id, @effectiveDate)
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
            request.input("cncL5Id", sql.Int, data.cncL5Id);
            request.input("cncL6Id", sql.Int, data.cncL6Id);
            request.input("effectiveDate", sql.DateTime, data.effectiveDate);

            const result = await request.query(`
        UPDATE GoGreen.OPS.OpsCnCL5_OpsCnCL6_Binding
        SET
          Ops_CnC_L5_ID = @cncL5Id,
          Ops_CnC_L6_ID = @cncL6Id,
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

    async ensureRules({ id = 0, cncL5Id, cncL6Id, effectiveDate }) {

        const pool = await getPool();
        const request = pool.request();

        request.input("id", sql.Int, id);
        request.input("cncL5Id", sql.Int, cncL5Id);
        request.input("cncL6Id", sql.Int, cncL6Id);
        request.input("effectiveDate", sql.DateTime, effectiveDate);

        /* === Same date duplicate === */

        const dup = await request.query(`
      SELECT 1
      FROM GoGreen.OPS.OpsCnCL5_OpsCnCL6_Binding
      WHERE
        ID <> @id
        AND Ops_CnC_L5_ID = @cncL5Id
        AND Ops_CnC_L6_ID = @cncL6Id
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
      FROM GoGreen.OPS.OpsCnCL5_OpsCnCL6_Binding
      WHERE
        Ops_CnC_L5_ID = @cncL5Id
        AND Ops_CnC_L6_ID = @cncL6Id
        AND ID <> @id
      ORDER BY EffectiveDate
    `);

        const rows = existing.recordset;

        if (rows.length >= 2) {
            const err = new Error(
                "Only two effective dated records allowed for same CNC L5 and CNC L6"
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

export const opsCncL5L6MappingService =
    new OpsCncL5L6MappingService();
