import sql from "mssql";
import { getPool } from "../config/sql-config.js";

class OpsCncL2L3MappingService {

    /* ===========================
       GET ALL
    ============================ */

    async getAll() {
        const pool = await getPool();

        const result = await pool.request().query(`
      SELECT
        m.ID AS id,

        m.Ops_CnC_L2_ID AS cncL2Id,
        l2.Ops_CnC_L2_Name AS cncL2Code,
        l2.Ops_CnC_L2_Description AS cncL2Description,

        m.Ops_CnC_L3_ID AS cncL3Id,
        l3.Ops_CnC_L3_Name AS cncL3Code,
        l3.Ops_CnC_L3_Description AS cncL3Description,

        m.EffectiveDate AS effectiveDate

      FROM GoGreen.OPS.OpsCnCL2_OpsCnCL3_Binding m

      LEFT JOIN GoGreen.OPS.ops_CnC_L2_definition l2
        ON l2.Ops_CnC_L2_Id = m.Ops_CnC_L2_ID

      LEFT JOIN GoGreen.OPS.ops_CnC_L3_definition l3
        ON l3.Ops_CnC_L3_Id = m.Ops_CnC_L3_ID

      ORDER BY m.ID ASC
    `);

        return result.recordset;
    }

    /* ===========================
       DROPDOWNS
    ============================ */

    async getCnCL2List() {
        const pool = await getPool();

        const result = await pool.request().query(`
      SELECT
        Ops_CnC_L2_Id AS id,
        Ops_CnC_L2_Name AS name,
        Ops_CnC_L2_Description AS [desc]
      FROM GoGreen.OPS.ops_CnC_L2_definition
      ORDER BY Ops_CnC_L2_Name
    `);

        return result.recordset;
    }

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

    /* ===========================
       CREATE
    ============================ */

    async create(data) {
        try {

            await this.ensureRules(data);

            const pool = await getPool();
            const request = pool.request();

            request.input("cncL2Id", sql.Int, data.cncL2Id);
            request.input("cncL3Id", sql.Int, data.cncL3Id);
            request.input("effectiveDate", sql.DateTime, data.effectiveDate);

            const result = await request.query(`
        INSERT INTO GoGreen.OPS.OpsCnCL2_OpsCnCL3_Binding
          (Ops_CnC_L2_ID, Ops_CnC_L3_ID, EffectiveDate)
        OUTPUT INSERTED.*
        VALUES
          (@cncL2Id, @cncL3Id, @effectiveDate)
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
            request.input("cncL2Id", sql.Int, data.cncL2Id);
            request.input("cncL3Id", sql.Int, data.cncL3Id);
            request.input("effectiveDate", sql.DateTime, data.effectiveDate);

            const result = await request.query(`
        UPDATE GoGreen.OPS.OpsCnCL2_OpsCnCL3_Binding
        SET
          Ops_CnC_L2_ID = @cncL2Id,
          Ops_CnC_L3_ID = @cncL3Id,
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

    async ensureRules({ id = 0, cncL2Id, cncL3Id, effectiveDate }) {

        const pool = await getPool();
        const request = pool.request();

        request.input("id", sql.Int, id);
        request.input("cncL2Id", sql.Int, cncL2Id);
        request.input("cncL3Id", sql.Int, cncL3Id);
        request.input("effectiveDate", sql.DateTime, effectiveDate);

        /* === Same date duplicate === */

        const dup = await request.query(`
      SELECT 1
      FROM GoGreen.OPS.OpsCnCL2_OpsCnCL3_Binding
      WHERE
        ID <> @id
        AND Ops_CnC_L2_ID = @cncL2Id
        AND Ops_CnC_L3_ID = @cncL3Id
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
      FROM GoGreen.OPS.OpsCnCL2_OpsCnCL3_Binding
      WHERE
        Ops_CnC_L2_ID = @cncL2Id
        AND Ops_CnC_L3_ID = @cncL3Id
        AND ID <> @id
      ORDER BY EffectiveDate
    `);

        const rows = existing.recordset;

        if (rows.length >= 2) {
            const err = new Error(
                "Only two effective dated records allowed for same CNC L2 and CNC L3"
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

export const opsCncL2L3MappingService =
    new OpsCncL2L3MappingService();
