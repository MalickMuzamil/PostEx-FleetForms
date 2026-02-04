import sql from "mssql";
import { getPool } from "../config/sql-config.js";

class OpsCncL3L4MappingService {

    /* ===========================
       GET ALL
    ============================ */

    async getAll() {
        const pool = await getPool();

        const result = await pool.request().query(`
      SELECT
        m.ID AS id,

        m.Ops_CnC_L3_ID AS cncL3Id,
        l3.Ops_CnC_L3_Name AS cncL3Code,
        l3.Ops_CnC_L3_Description AS cncL3Description,

        m.Ops_CnC_L4_ID AS cncL4Id,
        l4.Ops_CnC_L4_Name AS cncL4Code,
        l4.Ops_CnC_L4_Description AS cncL4Description,

        m.EffectiveDate AS effectiveDate

      FROM GoGreen.OPS.OpsCnCL3_OpsCnCL4_Binding m

      LEFT JOIN GoGreen.OPS.ops_CnC_L3_definition l3
        ON l3.Ops_CnC_L3_Id = m.Ops_CnC_L3_ID

      LEFT JOIN GoGreen.OPS.ops_CnC_L4_definition l4
        ON l4.Ops_CnC_L4_Id = m.Ops_CnC_L4_ID

      ORDER BY m.ID ASC
    `);

        return result.recordset;
    }

    /* ===========================
       DROPDOWNS
    ============================ */

    async getCnCL3List() {
        const pool = await getPool();

        const result = await pool.request().query(`
      SELECT
        Ops_CnC_L3_Id AS id,
        Ops_CnC_L3_Name AS name,
        Ops_CnC_L3_Description AS [desc]
      FROM GoGreen.OPS.ops_CnC_L3_definition
      ORDER BY Ops_CnC_L3_Name
    `);

        return result.recordset;
    }

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

    /* ===========================
       CREATE
    ============================ */

    async create(data) {
        try {

            await this.ensureRules(data);

            const pool = await getPool();
            const request = pool.request();

            request.input("cncL3Id", sql.Int, data.cncL3Id);
            request.input("cncL4Id", sql.Int, data.cncL4Id);
            request.input("effectiveDate", sql.DateTime, data.effectiveDate);

            const result = await request.query(`
        INSERT INTO GoGreen.OPS.OpsCnCL3_OpsCnCL4_Binding
          (Ops_CnC_L3_ID, Ops_CnC_L4_ID, EffectiveDate)
        OUTPUT INSERTED.*
        VALUES
          (@cncL3Id, @cncL4Id, @effectiveDate)
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
            request.input("cncL3Id", sql.Int, data.cncL3Id);
            request.input("cncL4Id", sql.Int, data.cncL4Id);
            request.input("effectiveDate", sql.DateTime, data.effectiveDate);

            const result = await request.query(`
        UPDATE GoGreen.OPS.OpsCnCL3_OpsCnCL4_Binding
        SET
          Ops_CnC_L3_ID = @cncL3Id,
          Ops_CnC_L4_ID = @cncL4Id,
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

    async ensureRules({ id = 0, cncL3Id, cncL4Id, effectiveDate }) {

        const pool = await getPool();
        const request = pool.request();

        request.input("id", sql.Int, id);
        request.input("cncL3Id", sql.Int, cncL3Id);
        request.input("cncL4Id", sql.Int, cncL4Id);
        request.input("effectiveDate", sql.DateTime, effectiveDate);

        /* === Same date duplicate === */

        const dup = await request.query(`
      SELECT 1
      FROM GoGreen.OPS.OpsCnCL3_OpsCnCL4_Binding
      WHERE
        ID <> @id
        AND Ops_CnC_L3_ID = @cncL3Id
        AND Ops_CnC_L4_ID = @cncL4Id
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
      FROM GoGreen.OPS.OpsCnCL3_OpsCnCL4_Binding
      WHERE
        Ops_CnC_L3_ID = @cncL3Id
        AND Ops_CnC_L4_ID = @cncL4Id
        AND ID <> @id
      ORDER BY EffectiveDate
    `);

        const rows = existing.recordset;

        if (rows.length >= 2) {
            const err = new Error(
                "Only two effective dated records allowed for same CNC L3 and CNC L4"
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

export const opsCncL3L4MappingService =
    new OpsCncL3L4MappingService();
