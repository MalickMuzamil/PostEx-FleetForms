import sql from "mssql";
import { getPool } from "../config/sql-config.js";

class SubBranchAssignmentDefinitionService {
  /* =========================
     LISTING APIS (same as yours)
  ========================== */

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

    const result = await request.query(`
      SELECT 
        E.EMP_ID,
        E.APP_Name            AS EmployeeName,
        E.APP_Name            AS AppName,
        E.APP_ACTIVE,
        E.BRANCHID            AS BranchID,

        E.DEP_ID,
        D.DEP_DESC            AS DepartmentName,

        E.DES_ID,
        G.DES_DESC            AS DesignationName

      FROM HRM.HR.Employees E
      LEFT JOIN HRM.HR.Department D ON E.DEP_ID = D.DEP_ID
      LEFT JOIN HRM.HR.Designation G ON E.DES_ID = G.DES_ID
      WHERE E.APP_ACTIVE = 1
        AND E.BRANCHID = @branchId
      ORDER BY E.APP_Name
    `);

    return result.recordset;
  }

  async listAssignments() {
    const pool = await getPool();

    const result = await pool.request().query(`
      WITH A AS (
        SELECT
          a.ID,
          a.Sub_Branch_ID,
          a.Sub_Branch_Emp_ID,
          a.Sub_Branch_Email,
          a.EffectiveDate,

          ROW_NUMBER() OVER (
            PARTITION BY a.Sub_Branch_ID
            ORDER BY a.EffectiveDate DESC, a.ID DESC
          ) AS rn_latest_any,

          ROW_NUMBER() OVER (
            PARTITION BY a.Sub_Branch_ID
            ORDER BY
              CASE WHEN a.EffectiveDate <= GETDATE() THEN 0 ELSE 1 END,
              a.EffectiveDate DESC,
              a.ID DESC
          ) AS rn_current_prefer_past
        FROM GoGreen.OPS.Sub_Branch_Assignment_Definition a
      )
      SELECT
        A.ID                      AS ID,
        A.Sub_Branch_ID           AS SubBranchID,
        sb.Sub_Branch_Name        AS SubBranchName,
        sb.BranchID               AS BranchID,
        br.BranchName             AS BranchName,
        A.Sub_Branch_Emp_ID       AS EmployeeId,
        e.APP_Name                AS EmployeeName,
        A.Sub_Branch_Email        AS Email,
        A.EffectiveDate           AS EffectiveDate,

        CASE
          WHEN A.EffectiveDate > GETDATE() THEN 'UPCOMING'
          WHEN A.rn_current_prefer_past = 1 THEN 'CURRENT'
          ELSE 'PAST'
        END AS Status

      FROM A
      LEFT JOIN GoGreen.OPS.Sub_Branch_Definition sb
        ON sb.Sub_Branch_ID = A.Sub_Branch_ID
      LEFT JOIN HRM.HR.Branches br
        ON br.BranchID = sb.BranchID
      LEFT JOIN HRM.HR.Employees e
        ON e.EMP_ID = A.Sub_Branch_Emp_ID
      ORDER BY A.ID DESC
    `);

    return result.recordset;
  }

  async getAssignmentById(id) {
    const pool = await getPool();
    const request = pool.request();
    request.input("id", sql.Int, Number(id));

    const result = await request.query(`
      SELECT TOP 1
        a.ID               AS ID,
        a.Sub_Branch_ID     AS SubBranchID,
        a.Sub_Branch_Emp_ID AS EmployeeId,
        a.Sub_Branch_Email  AS Email,
        a.EffectiveDate     AS EffectiveDate,
        a.IsActive          AS IsActive
      FROM GoGreen.OPS.Sub_Branch_Assignment_Definition a
      WHERE a.ID = @id
    `);

    return result.recordset?.[0] || null;
  }

  /* =========================
     CREATE / UPDATE
     (Binding wali same validations)
  ========================== */

  async createAssignment({ subBranchId, employeeId, email, effectiveDate }) {
    const sbId = Number(subBranchId) || null;
    const empId = Number(employeeId) || null;

    if (!sbId) {
      const e = new Error("Sub-Branch is required.");
      e.code = "SUB_BRANCH_REQUIRED";
      e.status = 400;
      throw e;
    }
    if (!empId) {
      const e = new Error("Employee is required.");
      e.code = "EMP_REQUIRED";
      e.status = 400;
      throw e;
    }

    const eff = this.parseEffectiveDate(effectiveDate);
    const mail = this.validateEmail(email);

    const pool = await getPool();
    const tx = new sql.Transaction(pool);

    try {
      await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

      // ✅ 0) Sub-branch exists + BranchID
      const { branchId } = await this.assertSubBranchAndGetBranchId(tx, sbId);

      // ✅ 1) Employee exists + active + branch match
      await this.assertEmployeeValidForBranch(tx, empId, branchId);

      // ✅ 2) Binding-style validations (same day collision + earliest lock + A>A)
      await this.ensureNoDuplicateAssignmentTx(tx, {
        id: null,
        subBranchId: sbId,
        employeeId: empId,
        effectiveDate: eff,
      });

      // ✅ 3) Insert (IsActive NOT NULL)
      const insertReq = new sql.Request(tx);
      insertReq.input("subBranchId", sql.Int, sbId);
      insertReq.input("employeeId", sql.Int, empId);
      insertReq.input("email", sql.VarChar(100), mail);
      insertReq.input("effectiveDate", sql.DateTime, eff);

      const ins = await insertReq.query(`
      INSERT INTO GoGreen.OPS.Sub_Branch_Assignment_Definition
        (Sub_Branch_ID, Sub_Branch_Emp_ID, Sub_Branch_Email, EffectiveDate, IsActive)
      OUTPUT INSERTED.*
      VALUES
        (@subBranchId, @employeeId, @email, @effectiveDate, 1)
    `);

      const inserted = ins.recordset?.[0] || null;

      // ✅ 4) Today-based IsActive: only 1 row active for this sub-branch
      await this.refreshIsActiveForSubBranchTx(tx, sbId);

      await tx.commit();
      return inserted;
    } catch (e) {
      try {
        await tx.rollback();
      } catch (_) { }
      throw e;
    }
  }

  async updateAssignment(id, payload) {
    const numericId = Number(id);
    if (!numericId) {
      const e = new Error("Invalid id.");
      e.code = "VALIDATION_ERROR";
      e.status = 400;
      throw e;
    }

    const current = await this.getAssignmentById(numericId);
    if (!current) return null;

    // ✅ Sub-Branch change NOT allowed
    const inputSubBranchId =
      payload?.subBranchId ?? payload?.SubBranchID ?? payload?.Sub_Branch_ID;

    if (
      inputSubBranchId != null &&
      Number(inputSubBranchId) !== Number(current.SubBranchID)
    ) {
      const e = new Error("Sub-Branch cannot be changed in update.");
      e.code = "SUB_BRANCH_CHANGE_NOT_ALLOWED";
      e.status = 400;
      throw e;
    }

    const finalSubBranchId = Number(current.SubBranchID);

    const finalEmployeeId = Number(
      payload?.employeeId ??
      payload?.EmployeeId ??
      payload?.Sub_Branch_Emp_ID ??
      current.EmployeeId,
    ) || null;

    if (!finalEmployeeId) {
      const e = new Error("Employee is required.");
      e.code = "EMP_REQUIRED";
      e.status = 400;
      throw e;
    }

    const finalEmail =
      typeof payload?.email === "string"
        ? this.validateEmail(payload.email)
        : this.validateEmail(current.Email);

    const finalEffective = payload?.effectiveDate
      ? this.parseEffectiveDate(payload.effectiveDate)
      : this.parseEffectiveDate(current.EffectiveDate);

    const pool = await getPool();
    const tx = new sql.Transaction(pool);

    try {
      await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

      // ✅ 0) Sub-branch exists + BranchID
      const { branchId } = await this.assertSubBranchAndGetBranchId(
        tx,
        finalSubBranchId,
      );

      // ✅ 1) Employee exists + active + branch match
      await this.assertEmployeeValidForBranch(tx, finalEmployeeId, branchId);

      // ✅ 2) Binding-style validations (update-safe via id exclusion)
      await this.ensureNoDuplicateAssignmentTx(tx, {
        id: numericId,
        subBranchId: finalSubBranchId,
        employeeId: finalEmployeeId,
        effectiveDate: finalEffective,
      });

      // ✅ 3) Update
      const req = new sql.Request(tx);
      req.input("id", sql.Int, numericId);
      req.input("employeeId", sql.Int, finalEmployeeId);
      req.input("email", sql.VarChar(100), finalEmail);
      req.input("effectiveDate", sql.DateTime, finalEffective);

      const result = await req.query(`
      UPDATE GoGreen.OPS.Sub_Branch_Assignment_Definition
      SET
        Sub_Branch_Emp_ID = @employeeId,
        Sub_Branch_Email = @email,
        EffectiveDate = @effectiveDate
      OUTPUT INSERTED.*
      WHERE ID = @id
    `);

      const updated = result.recordset?.[0] || null;

      // ✅ 4) Today-based IsActive: only 1 row active for this sub-branch
      await this.refreshIsActiveForSubBranchTx(tx, finalSubBranchId);

      await tx.commit();
      return updated;
    } catch (e) {
      try {
        await tx.rollback();
      } catch (_) { }
      throw e;
    }
  }

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

  /* =========================
     BINDING-STYLE VALIDATIONS (CORE)
     - SAME DAY COLLISION
     - EARLIEST DATE LOCK
     - NO CONSECUTIVE DUPLICATE (A > A)
  ========================== */

  async ensureNoDuplicateAssignmentTx(tx, { id = null, subBranchId, employeeId, effectiveDate }) {
    const newEmp = Number(employeeId);

    const toDateOnly = (val) => {
      const d = new Date(val);
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    };

    const newDate = toDateOnly(effectiveDate);

    /* 1) SAME-DAY COLLISION */
    {
      const req = new sql.Request(tx);
      req.input("id", sql.Int, id);
      req.input("subBranchId", sql.Int, subBranchId);
      req.input("effectiveDate", sql.DateTime, effectiveDate);

      const collision = await req.query(`
        SELECT TOP 1
          ID,
          CONVERT(varchar(10), CAST(EffectiveDate AS date), 23) AS ExistingDate
        FROM GoGreen.OPS.Sub_Branch_Assignment_Definition WITH (UPDLOCK, HOLDLOCK)
        WHERE Sub_Branch_ID = @subBranchId
          AND CAST(EffectiveDate AS date) = CAST(@effectiveDate AS date)
          AND (@id IS NULL OR ID <> @id)
        ORDER BY ID DESC;
      `);

      if (collision.recordset?.[0]?.ID) {
        const e = new Error(
          `Duplicate: This sub-branch already has an assignment on the same date (${collision.recordset[0].ExistingDate}).`
        );
        e.code = "EFFECTIVE_DATE_COLLISION";
        e.status = 409;
        e.existingId = collision.recordset[0].ID;
        throw e;
      }
    }

    /* 2) EARLIEST DATE LOCK (same as Binding) */
    {
      const req = new sql.Request(tx);
      req.input("id", sql.Int, id);
      req.input("subBranchId", sql.Int, subBranchId);

      const minRes = await req.query(`
        SELECT MIN(CAST(EffectiveDate AS date)) AS MinD
        FROM GoGreen.OPS.Sub_Branch_Assignment_Definition WITH (UPDLOCK, HOLDLOCK)
        WHERE Sub_Branch_ID = @subBranchId
          AND (@id IS NULL OR ID <> @id);
      `);

      const minD = minRes.recordset?.[0]?.MinD ? toDateOnly(minRes.recordset[0].MinD) : null;

      // first ever entry
      if (!minD) {
        // continue
      } else if (id == null) {
        // CREATE: block on/before minD
        if (newDate <= minD) {
          const e = new Error(
            `Date is reserved. You can only add AFTER ${minD.toISOString().slice(0, 10)}.`
          );
          e.code = "PAST_LOCKED";
          e.status = 409;
          throw e;
        }
      } else {
        // UPDATE: allow equal minD (edit earliest), block earlier
        if (newDate < minD) {
          const e = new Error(
            `Date is reserved. You can only set ON/AFTER ${minD.toISOString().slice(0, 10)}.`
          );
          e.code = "PAST_LOCKED";
          e.status = 409;
          throw e;
        }
      }
    }

    /* 3) FIND PREV / NEXT (NEIGHBORS) + A > A BLOCK */
    {
      const req = new sql.Request(tx);
      req.input("id", sql.Int, id);
      req.input("subBranchId", sql.Int, subBranchId);
      req.input("effectiveDate", sql.DateTime, effectiveDate);

      const neighbors = await req.query(`
        ;WITH PrevRow AS (
          SELECT TOP 1 ID, Sub_Branch_Emp_ID
          FROM GoGreen.OPS.Sub_Branch_Assignment_Definition WITH (UPDLOCK, HOLDLOCK)
          WHERE Sub_Branch_ID = @subBranchId
            AND CAST(EffectiveDate AS date) < CAST(@effectiveDate AS date)
            AND (@id IS NULL OR ID <> @id)
          ORDER BY CAST(EffectiveDate AS date) DESC, ID DESC
        ),
        NextRow AS (
          SELECT TOP 1 ID, Sub_Branch_Emp_ID
          FROM GoGreen.OPS.Sub_Branch_Assignment_Definition WITH (UPDLOCK, HOLDLOCK)
          WHERE Sub_Branch_ID = @subBranchId
            AND CAST(EffectiveDate AS date) > CAST(@effectiveDate AS date)
            AND (@id IS NULL OR ID <> @id)
          ORDER BY CAST(EffectiveDate AS date) ASC, ID ASC
        )
        SELECT
          (SELECT ID FROM PrevRow) AS PrevID,
          (SELECT Sub_Branch_Emp_ID FROM PrevRow) AS PrevEmp,
          (SELECT ID FROM NextRow) AS NextID,
          (SELECT Sub_Branch_Emp_ID FROM NextRow) AS NextEmp;
      `);

      const nb = neighbors.recordset?.[0] || {};
      const prevEmp = nb.PrevEmp != null ? Number(nb.PrevEmp) : null;
      const nextEmp = nb.NextEmp != null ? Number(nb.NextEmp) : null;

      if (prevEmp !== null && newEmp === prevEmp) {
        const e = new Error("Duplicate: Same employee cannot be consecutive (A > A not allowed).");
        e.code = "CONSECUTIVE_DUPLICATE";
        e.status = 409;
        e.existingId = nb.PrevID;
        throw e;
      }

      if (nextEmp !== null && newEmp === nextEmp) {
        const e = new Error("Duplicate: Same employee cannot be consecutive (A > A not allowed).");
        e.code = "CONSECUTIVE_DUPLICATE";
        e.status = 409;
        e.existingId = nb.NextID;
        throw e;
      }
    }
  }

  /* =========================
     HELPERS (your existing rules kept)
  ========================== */

  async assertSubBranchAndGetBranchId(tx, subBranchId) {
    const req = new sql.Request(tx);
    req.input("subBranchId", sql.Int, Number(subBranchId));

    const r = await req.query(`
      SELECT TOP 1
        sb.Sub_Branch_ID AS SubBranchID,
        sb.BranchID      AS BranchID
      FROM GoGreen.OPS.Sub_Branch_Definition sb
      WHERE sb.Sub_Branch_ID = @subBranchId
    `);

    const sb = r.recordset?.[0];
    if (!sb) { const e = new Error("Selected Sub-Branch does not exist."); e.code = "SUB_BRANCH_NOT_FOUND"; e.status = 404; throw e; }

    const branchId = Number(sb.BranchID) || null;
    if (!branchId) { const e = new Error("Branch not found for selected Sub-Branch."); e.code = "BRANCH_NOT_FOUND"; e.status = 404; throw e; }

    return { branchId };
  }

  async assertEmployeeValidForBranch(tx, employeeId, branchId) {
    const req = new sql.Request(tx);
    req.input("employeeId", sql.Int, Number(employeeId));

    const er = await req.query(`
      SELECT TOP 1 EMP_ID, APP_ACTIVE, BranchID
      FROM HRM.HR.Employees
      WHERE EMP_ID = @employeeId
    `);

    const emp = er.recordset?.[0];
    if (!emp) { const e = new Error("Employee not found."); e.code = "EMP_NOT_FOUND"; e.status = 404; throw e; }

    if (Number(emp.APP_ACTIVE) !== 1) { const e = new Error("Selected user is not active."); e.code = "EMP_INACTIVE"; e.status = 400; throw e; }

    if (Number(emp.BranchID) !== Number(branchId)) {
      const e = new Error("Employee does not belong to selected Branch.");
      e.code = "EMP_BRANCH_MISMATCH";
      e.status = 400;
      throw e;
    }
  }

  parseEffectiveDate(value) {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) {
      const err = new Error("Invalid effective date.");
      err.code = "INVALID_EFFECTIVE_DATE";
      err.status = 400;
      throw err;
    }
    return d;
  }

  validateEmail(value) {
    const v = String(value ?? "").trim();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    if (!ok) {
      const err = new Error("Please enter a valid email address.");
      err.code = "INVALID_EMAIL";
      err.status = 400;
      throw err;
    }
    return v;
  }

  async refreshIsActiveForSubBranchTx(tx, subBranchId) {
    const req = new sql.Request(tx);
    req.input("subBranchId", sql.Int, Number(subBranchId));

    await req.query(`
    ;WITH ranked AS (
      SELECT
        ID,
        ROW_NUMBER() OVER (
          PARTITION BY Sub_Branch_ID
          ORDER BY
            CASE WHEN EffectiveDate <= GETDATE() THEN 0 ELSE 1 END,
            EffectiveDate DESC,
            ID DESC
        ) AS rn
      FROM GoGreen.OPS.Sub_Branch_Assignment_Definition WITH (UPDLOCK, HOLDLOCK)
      WHERE Sub_Branch_ID = @subBranchId
    )
    UPDATE t
    SET IsActive = CASE WHEN r.rn = 1 THEN 1 ELSE 0 END
    FROM GoGreen.OPS.Sub_Branch_Assignment_Definition t
    INNER JOIN ranked r ON r.ID = t.ID
    WHERE t.Sub_Branch_ID = @subBranchId;
  `);
  }

}

export const subBranchAssignmentDefinitionService =
  new SubBranchAssignmentDefinitionService();
