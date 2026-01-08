import sql from "mssql";
import { getPool } from "../config/sql-config.js";

class SubBranchAssignmentDefinitionService {
    // ===========================
    // HELPERS / VALIDATIONS
    // ===========================

    validateFutureDate(effectiveDate) {
        const d = new Date(effectiveDate);
        if (Number.isNaN(d.getTime())) {
            const err = new Error("Invalid effective date.");
            err.code = "INVALID_EFFECTIVE_DATE";
            throw err;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const cmp = new Date(d);
        cmp.setHours(0, 0, 0, 0);

        if (cmp <= today) {
            const err = new Error(
                "Effective date cannot be a past date. Please select a future date."
            );
            err.code = "PAST_EFFECTIVE_DATE";
            throw err;
        }

        return cmp;
    }

    validateEmail(email) {
        const e = String(email || "").trim();

        // basic + length safe
        const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 50;

        if (!ok) {
            const err = new Error("Please enter a valid email address.");
            err.code = "INVALID_EMAIL";
            throw err;
        }

        return e;
    }

    // ===========================
    // DROPDOWNS
    // ===========================

    async listSubBranches() {
        const pool = await getPool();
        const result = await pool.request().query(`
      SELECT
        sb.Sub_Branch_ID          AS SubBranchID,
        sb.Sub_Branch_ID          AS ID,
        sb.Sub_Branch_Name        AS SubBranchName,
        sb.Sub_Branch_Description AS SubBranchDesc,
        sb.BranchID               AS BranchID,
        br.BranchName             AS BranchName
      FROM GoGreen.OPS.Sub_Branch_Definition sb
      LEFT JOIN HRM.HR.Branches br
        ON br.BranchID = sb.BranchID
      ORDER BY sb.Sub_Branch_ID
    `);

        return result.recordset;
    }

    async getSubBranchById(subBranchId) {
        const pool = await getPool();
        const request = pool.request();
        request.input("subBranchId", sql.Int, Number(subBranchId));

        const result = await request.query(`
      SELECT TOP 1
        sb.Sub_Branch_ID          AS SubBranchID,
        sb.Sub_Branch_ID          AS ID,
        sb.Sub_Branch_Name        AS SubBranchName,
        sb.Sub_Branch_Description AS SubBranchDesc,
        sb.BranchID               AS BranchID,
        br.BranchName             AS BranchName
      FROM GoGreen.OPS.Sub_Branch_Definition sb
      LEFT JOIN HRM.HR.Branches br
        ON br.BranchID = sb.BranchID
      WHERE sb.Sub_Branch_ID = @subBranchId
    `);

        return result.recordset?.[0] || null;
    }

    async listActiveEmployeesByBranch(branchId) {
        const pool = await getPool();
        const request = pool.request();
        request.input("branchId", sql.Int, Number(branchId));

        // ⚠️ If Employees table uses different branch column name, update "BranchID" here.
        const result = await request.query(`
      SELECT EMP_ID, APP_Name, APP_ACTIVE, CNIC, BranchID
      FROM HRM.HR.Employees
      WHERE APP_ACTIVE = 1
        AND BranchID = @branchId
      ORDER BY EMP_ID
    `);

        return result.recordset;
    }

    // ===========================
    // TABLE LIST
    // ===========================

    async listAssignments() {
        const pool = await getPool();

        const result = await pool.request().query(`
      SELECT
        a.ID                                   AS ID,
        a.Sub_Branch_ID                         AS SubBranchID,
        sb.Sub_Branch_Name                      AS SubBranchName,
        sb.BranchID                             AS BranchID,
        br.BranchName                           AS BranchName,
        a.Sub_Branch_Emp_ID                     AS EmployeeId,
        e.APP_Name                              AS EmployeeName,
        a.Sub_Branch_Email                      AS Email,
        a.EffectiveDate                         AS EffectiveDate,
        ISNULL(a.StatusFlag, 1)                 AS StatusFlag
      FROM GoGreen.OPS.Sub_Branch_Assignment_Definition a
      LEFT JOIN GoGreen.OPS.Sub_Branch_Definition sb
        ON sb.Sub_Branch_ID = a.Sub_Branch_ID
      LEFT JOIN HRM.HR.Branches br
        ON br.BranchID = sb.BranchID
      LEFT JOIN HRM.HR.Employees e
        ON e.EMP_ID = a.Sub_Branch_Emp_ID
      ORDER BY a.ID DESC
    `);

        return result.recordset;
    }

    async getAssignmentById(id) {
        const pool = await getPool();
        const request = pool.request();
        request.input("id", sql.Int, Number(id));

        const result = await request.query(`
      SELECT TOP 1
        a.ID                                   AS ID,
        a.Sub_Branch_ID                         AS SubBranchID,
        a.Sub_Branch_Emp_ID                     AS EmployeeId,
        a.Sub_Branch_Email                      AS Email,
        a.EffectiveDate                         AS EffectiveDate,
        ISNULL(a.StatusFlag, 1)                 AS StatusFlag
      FROM GoGreen.OPS.Sub_Branch_Assignment_Definition a
      WHERE a.ID = @id
    `);

        return result.recordset?.[0] || null;
    }

    // ===========================
    // CREATE (UPDATED: transaction + locking + duplicate effective date)
    // ===========================

    async createAssignment({
        subBranchId,
        employeeId,
        email,
        effectiveDate,
        statusFlag = 1,
        enteredBy = "Admin",
        force = false,
    }) {
        const sbId = Number(subBranchId) || null;
        const empId = Number(employeeId) || null;

        if (!sbId) {
            const err = new Error("Sub-Branch is required.");
            err.code = "SUB_BRANCH_REQUIRED";
            throw err;
        }

        if (!empId) {
            const err = new Error("Employee is required.");
            err.code = "EMP_REQUIRED";
            throw err;
        }

        const eff = this.validateFutureDate(effectiveDate);
        const mail = this.validateEmail(email);

        const pool = await getPool();
        const tx = new sql.Transaction(pool);

        try {
            await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

            // 1) Sub-branch exists + get BranchID (inside tx)
            {
                const req = new sql.Request(tx);
                req.input("subBranchId", sql.Int, sbId);

                const r = await req.query(`
          SELECT TOP 1
            sb.Sub_Branch_ID AS SubBranchID,
            sb.BranchID      AS BranchID
          FROM GoGreen.OPS.Sub_Branch_Definition sb
          WHERE sb.Sub_Branch_ID = @subBranchId
        `);

                const sb = r.recordset?.[0] || null;
                if (!sb) {
                    const err = new Error("Selected Sub-Branch does not exist.");
                    err.code = "SUB_BRANCH_NOT_FOUND";
                    throw err;
                }

                // attach for later checks
                var branchId = Number(sb.BranchID) || null;
                if (!branchId) {
                    const err = new Error("Branch not found for selected Sub-Branch.");
                    err.code = "BRANCH_NOT_FOUND";
                    throw err;
                }
            }

            // 2) employee exists + active + branch match (inside tx)
            {
                const req = new sql.Request(tx);
                req.input("employeeId", sql.Int, empId);

                const er = await req.query(`
          SELECT TOP 1 EMP_ID, APP_ACTIVE, BranchID
          FROM HRM.HR.Employees
          WHERE EMP_ID = @employeeId
        `);

                const emp = er.recordset?.[0] || null;
                if (!emp) {
                    const err = new Error("Employee not found.");
                    err.code = "EMP_NOT_FOUND";
                    throw err;
                }

                if (Number(emp.APP_ACTIVE) !== 1) {
                    const err = new Error(
                        "Selected user is not active. Please select an active user."
                    );
                    err.code = "EMP_INACTIVE";
                    throw err;
                }

                if (Number(emp.BranchID) !== Number(branchId)) {
                    const err = new Error("Employee does not belong to selected Branch.");
                    err.code = "EMP_BRANCH_MISMATCH";
                    throw err;
                }
            }

            // 3) Hard duplicate check: same SubBranch + same EffectiveDate (any status)
            {
                const req = new sql.Request(tx);
                req.input("subBranchId", sql.Int, sbId);
                req.input("effectiveDate", sql.DateTime, eff);

                const dup = await req.query(`
          SELECT TOP 1 ID
          FROM GoGreen.OPS.Sub_Branch_Assignment_Definition WITH (UPDLOCK, HOLDLOCK)
          WHERE Sub_Branch_ID = @subBranchId
            AND CONVERT(date, EffectiveDate) = CONVERT(date, @effectiveDate)
          ORDER BY ID DESC
        `);

                const existingSameDate = dup.recordset?.[0] || null;

                if (existingSameDate && !force) {
                    const err = new Error(
                        "A binding already exists for this Sub-Branch with the same effective date."
                    );
                    err.code = "DUPLICATE_EFFECTIVE_DATE";
                    err.status = 409;
                    err.conflict = {
                        ID: existingSameDate.ID,
                        ExistingEffectiveDate: eff,
                    };
                    throw err;
                }

                // if force and same-date exists => deactivate that record too (safe)
                if (existingSameDate && force) {
                    const deactSame = new sql.Request(tx);
                    deactSame.input("id", sql.Int, Number(existingSameDate.ID));
                    await deactSame.query(`
            UPDATE GoGreen.OPS.Sub_Branch_Assignment_Definition
            SET StatusFlag = 0,
                InactivatedOn = GETDATE()
            WHERE ID = @id
          `);
                }
            }

            // 4) Check ACTIVE binding exists (lock) => confirm overwrite if needed
            let activeConflict = null;
            {
                const req = new sql.Request(tx);
                req.input("subBranchId", sql.Int, sbId);

                const cr = await req.query(`
          SELECT TOP 1 ID, EffectiveDate
          FROM GoGreen.OPS.Sub_Branch_Assignment_Definition WITH (UPDLOCK, HOLDLOCK)
          WHERE Sub_Branch_ID = @subBranchId
            AND ISNULL(StatusFlag, 1) = 1
          ORDER BY EffectiveDate DESC
        `);

                activeConflict = cr.recordset?.[0] || null;

                if (activeConflict) {
                    const existingYMD = new Date(activeConflict.EffectiveDate)
                        .toISOString()
                        .split("T")[0];
                    const newYMD = new Date(eff).toISOString().split("T")[0];

                    if (existingYMD !== newYMD && !force) {
                        const err = new Error(
                            "An active binding already exists for this Sub-Branch with a different effective date. Confirm overwrite."
                        );
                        err.code = "CONFIRM_OVERWRITE";
                        err.status = 409;
                        err.conflict = {
                            ID: activeConflict.ID,
                            ExistingEffectiveDate: activeConflict.EffectiveDate,
                        };
                        throw err;
                    }
                }
            }

            // 5) force => deactivate ACTIVE + future (only active) definitions
            if (force) {
                // deactivate current active
                {
                    const req = new sql.Request(tx);
                    req.input("subBranchId", sql.Int, sbId);

                    await req.query(`
            UPDATE GoGreen.OPS.Sub_Branch_Assignment_Definition
            SET StatusFlag = 0,
                InactivatedOn = GETDATE()
            WHERE Sub_Branch_ID = @subBranchId
              AND ISNULL(StatusFlag, 1) = 1
          `);
                }

                // deactivate future defs (>= new effective date) — only active ones
                {
                    const req = new sql.Request(tx);
                    req.input("subBranchId", sql.Int, sbId);
                    req.input("newEff", sql.DateTime, eff);

                    await req.query(`
            UPDATE GoGreen.OPS.Sub_Branch_Assignment_Definition
            SET StatusFlag = 0,
                InactivatedOn = GETDATE()
            WHERE Sub_Branch_ID = @subBranchId
              AND ISNULL(StatusFlag, 1) = 1
              AND EffectiveDate >= @newEff
          `);
                }
            }

            // 6) Insert new assignment
            const insertReq = new sql.Request(tx);
            insertReq.input("subBranchId", sql.Int, sbId);
            insertReq.input("employeeId", sql.Int, empId);
            insertReq.input("email", sql.NVarChar(50), mail);
            insertReq.input("effectiveDate", sql.DateTime, eff);
            insertReq.input("statusFlag", sql.Bit, Number(statusFlag) === 0 ? 0 : 1);
            insertReq.input("enteredBy", sql.NVarChar(100), String(enteredBy || "Admin").trim());

            const ins = await insertReq.query(`
        INSERT INTO GoGreen.OPS.Sub_Branch_Assignment_Definition
          (Sub_Branch_ID, Sub_Branch_Emp_ID, Sub_Branch_Email, EffectiveDate,
           StatusFlag, EnteredOn, EnteredBy)
        OUTPUT INSERTED.*
        VALUES
          (@subBranchId, @employeeId, @email, @effectiveDate,
           @statusFlag, GETDATE(), @enteredBy)
      `);

            await tx.commit();
            return ins.recordset?.[0] || null;
        } catch (e) {
            try {
                await tx.rollback();
            } catch (_) { }
            throw e;
        }
    }

    // ===========================
    // UPDATE (safe validations)
    // ===========================

    async updateAssignment(id, payload) {
        const current = await this.getAssignmentById(id);
        if (!current) return null;

        const finalSubBranchId = Number(payload?.subBranchId ?? current.SubBranchID) || null;
        const finalEmployeeId = Number(payload?.employeeId ?? current.EmployeeId) || null;

        if (!finalSubBranchId) {
            const err = new Error("Sub-Branch is required.");
            err.code = "SUB_BRANCH_REQUIRED";
            throw err;
        }

        if (!finalEmployeeId) {
            const err = new Error("Employee is required.");
            err.code = "EMP_REQUIRED";
            throw err;
        }

        const finalEmail =
            typeof payload?.email === "string"
                ? this.validateEmail(payload.email)
                : String(current.Email || "").trim();

        const finalEffective =
            payload?.effectiveDate
                ? this.validateFutureDate(payload.effectiveDate)
                : new Date(current.EffectiveDate);

        const finalStatus =
            payload?.statusFlag == null
                ? Number(current.StatusFlag) === 0
                    ? 0
                    : 1
                : Number(payload.statusFlag) === 0
                    ? 0
                    : 1;

        // Validate subbranch + branch
        const sb = await this.getSubBranchById(finalSubBranchId);
        if (!sb) {
            const err = new Error("Selected Sub-Branch does not exist.");
            err.code = "SUB_BRANCH_NOT_FOUND";
            throw err;
        }

        const branchId = Number(sb.BranchID) || null;

        // Validate employee active + branch match
        const pool = await getPool();
        {
            const req = pool.request();
            req.input("employeeId", sql.Int, finalEmployeeId);

            const er = await req.query(`
        SELECT TOP 1 EMP_ID, APP_ACTIVE, BranchID
        FROM HRM.HR.Employees
        WHERE EMP_ID = @employeeId
      `);

            const emp = er.recordset?.[0] || null;
            if (!emp) {
                const err = new Error("Employee not found.");
                err.code = "EMP_NOT_FOUND";
                throw err;
            }

            if (Number(emp.APP_ACTIVE) !== 1) {
                const err = new Error(
                    "Selected user is not active. Please select an active user."
                );
                err.code = "EMP_INACTIVE";
                throw err;
            }

            if (Number(emp.BranchID) !== Number(branchId)) {
                const err = new Error("Employee does not belong to selected Branch.");
                err.code = "EMP_BRANCH_MISMATCH";
                throw err;
            }
        }

        const request = pool.request();
        request.input("id", sql.Int, Number(id));
        request.input("subBranchId", sql.Int, finalSubBranchId);
        request.input("employeeId", sql.Int, finalEmployeeId);
        request.input("email", sql.NVarChar(50), finalEmail);
        request.input("effectiveDate", sql.DateTime, finalEffective);
        request.input("statusFlag", sql.Bit, finalStatus);
        request.input("editedBy", sql.NVarChar(100), String(payload?.editedBy || "Admin").trim());

        const result = await request.query(`
      UPDATE GoGreen.OPS.Sub_Branch_Assignment_Definition
      SET
        Sub_Branch_ID = @subBranchId,
        Sub_Branch_Emp_ID = @employeeId,
        Sub_Branch_Email = @email,
        EffectiveDate = @effectiveDate,
        StatusFlag = @statusFlag,
        EditedOn = GETDATE(),
        EditedBy = @editedBy
      OUTPUT INSERTED.*
      WHERE ID = @id
    `);

        return result.recordset?.[0] || null;
    }

    // ===========================
    // DELETE
    // ===========================

    async deleteAssignment(id) {
        const pool = await getPool();
        const request = pool.request();
        request.input("id", sql.Int, Number(id));

        const result = await request.query(`
      DELETE FROM GoGreen.OPS.Sub_Branch_Assignment_Definition
      OUTPUT DELETED.*
      WHERE ID = @id
    `);

        return result.recordset?.[0] || null;
    }
}

export const subBranchAssignmentDefinitionService =
    new SubBranchAssignmentDefinitionService();
