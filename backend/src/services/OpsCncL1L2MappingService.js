import sql from "mssql";
import { getPool } from "../config/sql-config.js";

class OpsCncL1L2MappingService {

    /* ===========================
       GET ALL
    ============================ */

    async getAll() {
        const pool = await getPool();

        const result = await pool.request().query(`
      SELECT
        m.ID AS id,

        m.Ops_CnC_L1_ID AS cncL1Id,
        l1.Ops_CnC_L1_Name AS cncL1Code,
        l1.Ops_CnC_L1_Description AS cncL1Description,

        m.Ops_CnC_L2_ID AS cncL2Id,
        l2.Ops_CnC_L2_Name AS cncL2Code,
        l2.Ops_CnC_L2_Description AS cncL2Description,

        m.EffectiveDate AS effectiveDate

      FROM GoGreen.OPS.OpsCnCL1_OpsCnCL2_Binding m

      LEFT JOIN GoGreen.OPS.ops_CnC_L1_definition l1
        ON l1.Ops_CnC_L1_Id = m.Ops_CnC_L1_ID

      LEFT JOIN GoGreen.OPS.ops_CnC_L2_definition l2
        ON l2.Ops_CnC_L2_Id = m.Ops_CnC_L2_ID

      ORDER BY m.ID ASC
    `);

        return result.recordset;
    }

    /* ===========================
       DROPDOWNS
    ============================ */

    async getCnCL1List() {
        const pool = await getPool();

        const result = await pool.request().query(`
      SELECT
        Ops_CnC_L1_Id AS id,
        Ops_CnC_L1_Name AS name,
        Ops_CnC_L1_Description AS [desc]
      FROM GoGreen.OPS.ops_CnC_L1_definition
      ORDER BY Ops_CnC_L1_Name
    `);

        return result.recordset;
    }

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

    /* ===========================
       CREATE
    ============================ */

    async create(data) {
        try {
            await this.ensureRules(data);

            const pool = await getPool();
            const request = pool.request();

            request.input("cncL1Id", sql.Int, data.cncL1Id);
            request.input("cncL2Id", sql.Int, data.cncL2Id);
            request.input("effectiveDate", sql.DateTime, data.effectiveDate);

            const result = await request.query(`
        INSERT INTO GoGreen.OPS.OpsCnCL1_OpsCnCL2_Binding
          (Ops_CnC_L1_ID, Ops_CnC_L2_ID, EffectiveDate)
        OUTPUT INSERTED.*
        VALUES
          (@cncL1Id, @cncL2Id, @effectiveDate)
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
            request.input("cncL1Id", sql.Int, data.cncL1Id);
            request.input("cncL2Id", sql.Int, data.cncL2Id);
            request.input("effectiveDate", sql.DateTime, data.effectiveDate);

            const result = await request.query(`
        UPDATE GoGreen.OPS.OpsCnCL1_OpsCnCL2_Binding
        SET
          Ops_CnC_L1_ID = @cncL1Id,
          Ops_CnC_L2_ID = @cncL2Id,
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

    async ensureRules({ id = 0, cncL1Id, cncL2Id, effectiveDate }) {

        const pool = await getPool();
        const request = pool.request();

        request.input("id", sql.Int, id);
        request.input("cncL1Id", sql.Int, cncL1Id);
        request.input("cncL2Id", sql.Int, cncL2Id);
        request.input("effectiveDate", sql.DateTime, effectiveDate);

        /* === Same date duplicate === */

        const dup = await request.query(`
      SELECT 1
      FROM GoGreen.OPS.OpsCnCL1_OpsCnCL2_Binding
      WHERE
        ID <> @id
        AND Ops_CnC_L1_ID = @cncL1Id
        AND Ops_CnC_L2_ID = @cncL2Id
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
      FROM GoGreen.OPS.OpsCnCL1_OpsCnCL2_Binding
      WHERE
        Ops_CnC_L1_ID = @cncL1Id
        AND Ops_CnC_L2_ID = @cncL2Id
        AND ID <> @id
      ORDER BY EffectiveDate
    `);

        const rows = existing.recordset;

        if (rows.length >= 2) {
            const err = new Error(
                "Only two effective dated records allowed for same CNC L1 and CNC L2"
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

export const opsCncL1L2MappingService =
    new OpsCncL1L2MappingService();
