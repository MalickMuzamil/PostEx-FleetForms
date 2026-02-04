import sql from "mssql";
import { getPool } from "../config/sql-config.js";

class OpsCncL1BranchMappingService {

    /* ===========================
       GET ALL
    ============================ */

    async getAll() {
        const pool = await getPool();

        const result = await pool.request().query(`
    SELECT
      m.ID                      AS id,

      m.BranchID                AS branchId,
      br.BranchName             AS branchName,
      br.BranchDesc             AS branchDescription,

      m.Ops_CnC_L1_ID           AS cncL1Id,
      c.Ops_CnC_L1_Name         AS cncL1Code,
      c.Ops_CnC_L1_Description  AS cncL1Description,

      m.EffectiveDate           AS effectiveDate

    FROM GoGreen.OPS.Branch_OpsCnCL1_Binding m

    LEFT JOIN HRM.HR.Branches br
      ON br.BranchID = m.BranchID

    LEFT JOIN GoGreen.OPS.ops_CnC_L1_definition c
      ON c.Ops_CnC_L1_Id = m.Ops_CnC_L1_ID

    ORDER BY m.ID ASC
  `);

        return result.recordset;
    }

    async getBranches() {
        const pool = await getPool();

        const result = await pool.request().query(`
    SELECT
      BranchID   AS id,
      BranchName AS name,
       BranchDesc AS [desc]
    FROM HRM.HR.Branches
    ORDER BY BranchName
  `);

        return result.recordset;
    }

    async getCnCL1List() {
        const pool = await getPool();

        const result = await pool.request().query(`
    SELECT
      Ops_CnC_L1_Id   AS id,
      Ops_CnC_L1_Name AS name,
      Ops_CnC_L1_Description AS [desc]
    FROM GoGreen.OPS.ops_CnC_L1_definition
    ORDER BY Ops_CnC_L1_Name
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

            request.input("branchId", sql.Int, data.branchId);
            request.input("cncL1Id", sql.Int, data.cncL1Id);
            request.input("effectiveDate", sql.DateTime, data.effectiveDate);

            const result = await request.query(`
      INSERT INTO GoGreen.OPS.Branch_OpsCnCL1_Binding
        (BranchID, Ops_CnC_L1_ID, EffectiveDate)
      OUTPUT INSERTED.*
      VALUES
        (@branchId, @cncL1Id, @effectiveDate)
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
            request.input("branchId", sql.Int, data.branchId);
            request.input("cncL1Id", sql.Int, data.cncL1Id);
            request.input("effectiveDate", sql.DateTime, data.effectiveDate);

            const result = await request.query(`
      UPDATE GoGreen.OPS.Branch_OpsCnCL1_Binding
      SET
        BranchID = @branchId,
        Ops_CnC_L1_ID = @cncL1Id,
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

    async ensureRules({ id = 0, branchId, cncL1Id, effectiveDate }) {

        const pool = await getPool();
        const request = pool.request();

        request.input("id", sql.Int, id);
        request.input("branchId", sql.Int, branchId);
        request.input("cncL1Id", sql.Int, cncL1Id);
        request.input("effectiveDate", sql.DateTime, effectiveDate);

        /* ===============================
           1) SAME DATE DUPLICATE CHECK
        =============================== */

        const dup = await request.query(`
    SELECT 1
    FROM GoGreen.OPS.Branch_OpsCnCL1_Binding
    WHERE
      ID <> @id
      AND BranchID = @branchId
      AND Ops_CnC_L1_ID = @cncL1Id
      AND CAST(EffectiveDate AS DATE)
          = CAST(@effectiveDate AS DATE)
  `);

        if (dup.recordset.length) {
            const err = new Error("Duplicate mapping for same date");
            err.code = "DUPLICATE_MAPPING";
            throw err;
        }

        /* ===============================
           2) FETCH EXISTING RECORDS
        =============================== */

        const existingResult = await request.query(`
    SELECT ID, EffectiveDate
    FROM GoGreen.OPS.Branch_OpsCnCL1_Binding
    WHERE
      BranchID = @branchId
      AND Ops_CnC_L1_ID = @cncL1Id
      AND ID <> @id
    ORDER BY EffectiveDate
  `);

        const rows = existingResult.recordset;

        /* ===============================
           3) MAX TWO RECORDS RULE
        =============================== */

        if (rows.length >= 2) {
            const err = new Error(
                "Only two effective dated records allowed for same Branch and CNC"
            );
            err.code = "MAX_LIMIT";
            throw err;
        }

        /* ===============================
           4) DATE SEQUENCE RULE
        =============================== */

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

export const opsCncL1BranchMappingService =
    new OpsCncL1BranchMappingService();
