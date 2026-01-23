import sql from "mssql";
import { getPool } from "../config/sql-config.js";

class BindingService {
  /* =========================
     LISTING APIS
  ========================== */

  async listActiveEmployees() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        E.EMP_ID,
        E.APP_Name,
        E.APP_NIC,
        E.APP_ACTIVE,
        E.DEP_ID,
        D.DEP_DESC AS DepartmentName,
        E.DES_ID,
        G.DES_DESC AS DesignationName
      FROM HRM.HR.Employees E
      LEFT JOIN HRM.HR.Department D ON E.DEP_ID = D.DEP_ID
      LEFT JOIN HRM.HR.Designation G ON E.DES_ID = G.DES_ID
      WHERE E.APP_ACTIVE = 1
      ORDER BY E.APP_Name
    `);
    return result.recordset;
  }

  async listBranches() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT *
      FROM HRM.HR.Branches
      ORDER BY BranchID
    `);
    return result.recordset;
  }

  async listBindings() {
    const pool = await getPool();
    const result = await pool.request().query(`
    ;WITH x AS (
      SELECT
        b.ID,
        b.BranchID,
        b.BC_Emp_ID,
        b.BC_Email,
        b.EffectiveDate,

        e.APP_Name AS EmployeeName,

        LAG(b.BC_Emp_ID) OVER (PARTITION BY b.BranchID ORDER BY b.EffectiveDate, b.ID) AS PrevEmpId,
        LAG(e.APP_Name)  OVER (PARTITION BY b.BranchID ORDER BY b.EffectiveDate, b.ID) AS PrevEmpName,

        LEAD(b.BC_Emp_ID) OVER (PARTITION BY b.BranchID ORDER BY b.EffectiveDate, b.ID) AS NextEmpId,
        LEAD(e.APP_Name)  OVER (PARTITION BY b.BranchID ORDER BY b.EffectiveDate, b.ID) AS NextEmpName,

        LEAD(b.EffectiveDate) OVER (PARTITION BY b.BranchID ORDER BY b.EffectiveDate, b.ID) AS NextEffectiveDate
      FROM GoGreen.OPS.Branch_BC_Binding b
      LEFT JOIN HRM.HR.Employees e ON e.EMP_ID = b.BC_Emp_ID
    )
    SELECT
      ID,
      BranchID,
      BC_Emp_ID,
      EmployeeName,
      BC_Email,
      EffectiveDate,

      PrevEmpId,
      PrevEmpName,
      NextEmpId,
      NextEmpName,

      -- Optional: timeline end date (till next effective date - 1 day)
      CASE 
        WHEN NextEffectiveDate IS NULL THEN NULL
        ELSE DATEADD(DAY, -1, CAST(NextEffectiveDate AS date))
      END AS EndDate,

      -- Optional: helpful label for UI
      CASE
        WHEN PrevEmpId IS NULL THEN 'First Assignment'
        WHEN PrevEmpId = BC_Emp_ID THEN 'Duplicate (should not happen)'
        ELSE 'Owner Changed'
      END AS ChangeType
    FROM x
    ORDER BY BranchID, EffectiveDate DESC, ID DESC;
  `);

    return result.recordset;
  }


  async searchBindings({ empId, branchId, email, name }) {
    const pool = await getPool();
    const request = pool.request();

    request.input("empId", sql.Int, empId || null);
    request.input("branchId", sql.Int, branchId || null);
    request.input("email", sql.VarChar, email || null);
    request.input("name", sql.VarChar, name || null);

    const result = await request.query(`
      SELECT
        b.ID,
        b.BranchID,
        b.BC_Emp_ID,
        b.BC_Email,
        b.EffectiveDate,
        e.APP_Name
      FROM GoGreen.OPS.Branch_BC_Binding b
      LEFT JOIN HRM.HR.Employees e
        ON e.EMP_ID = b.BC_Emp_ID
      WHERE
        (@empId IS NULL OR b.BC_Emp_ID = @empId)
        AND (@branchId IS NULL OR b.BranchID = @branchId)
        AND (@email IS NULL OR b.BC_Email LIKE '%' + @email + '%')
        AND (@name IS NULL OR e.APP_Name LIKE '%' + @name + '%')
      ORDER BY b.EffectiveDate DESC, b.ID DESC
    `);

    return result.recordset;
  }

  /* =========================
     CREATE / UPDATE
  ========================== */

  async createBinding({ branchId, empId, email, effectiveDate }) {
    if (!branchId || !empId || !email || !effectiveDate) {
      const err = new Error("branchId, empId, email, effectiveDate are required.");
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    const finalBranchId = Number(branchId);
    const finalEmpId = Number(empId);
    const finalEmail = (email || "").trim();
    const finalEffectiveDate = effectiveDate;

    await this.ensureNoDuplicate({
      branchId: finalBranchId,
      empId: finalEmpId,
      effectiveDate: finalEffectiveDate,
    });

    const pool = await getPool();
    const request = pool.request();

    request.input("branchId", sql.Int, finalBranchId);
    request.input("empId", sql.Int, finalEmpId);
    request.input("email", sql.VarChar, finalEmail);
    request.input("effectiveDate", sql.DateTime, finalEffectiveDate);

    const result = await request.query(`
    INSERT INTO GoGreen.OPS.Branch_BC_Binding
      (BranchID, BC_Emp_ID, BC_Email, EffectiveDate)
    OUTPUT INSERTED.*
    VALUES
      (@branchId, @empId, @email, @effectiveDate)
  `);

    return result.recordset?.[0];
  }

  async updateBinding(id, body) {
    const numericId = Number(id);

    // ✅ accept both naming styles (safety)
    const inputBranchId = Number(body.branchId ?? body.BranchID ?? body.branch_id ?? body.branchId);
    const empId = Number(body.empId ?? body.employeeId ?? body.BC_Emp_ID);
    const email = (body.email ?? body.BC_Email ?? "").trim();
    const effectiveDate = body.effectiveDate ?? body.EffectiveDate;

    if (!numericId || !empId || !email || !effectiveDate) {
      const err = new Error("empId, email, effectiveDate are required.");
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    const pool = await getPool();

    // ✅ 1) Record must exist + Branch change NOT allowed
    const existingRes = await pool
      .request()
      .input("id", sql.Int, numericId)
      .query(`
      SELECT ID, BranchID
      FROM GoGreen.OPS.Branch_BC_Binding
      WHERE ID = @id
    `);

    const existing = existingRes.recordset?.[0];
    if (!existing) {
      const err = new Error("Record not found.");
      err.code = "NOT_FOUND";
      throw err;
    }

    const existingBranchId = Number(existing.BranchID);

    // if UI sends branchId, enforce it matches; if not sent, still enforce original
    if (Number.isFinite(inputBranchId) && inputBranchId !== existingBranchId) {
      const err = new Error("Branch cannot be changed in update.");
      err.code = "BRANCH_CHANGE_NOT_ALLOWED";
      throw err;
    }

    // ✅ 2) Apply SAME validations as CREATE (but update-safe via id exclusion)
    await this.ensureNoDuplicate({
      id: numericId,
      branchId: existingBranchId, // always original branch
      empId,                      // ✅ employee change allowed
      effectiveDate,              // ✅ date change allowed
    });

    // ✅ 3) Update
    const request = pool.request();
    request.input("id", sql.Int, numericId);
    request.input("empId", sql.Int, empId);
    request.input("email", sql.VarChar, email);
    request.input("effectiveDate", sql.DateTime, effectiveDate);

    const result = await request.query(`
    UPDATE GoGreen.OPS.Branch_BC_Binding
    SET
      BC_Emp_ID = @empId,
      BC_Email = @email,
      EffectiveDate = @effectiveDate
    OUTPUT INSERTED.*
    WHERE ID = @id
  `);

    return result.recordset?.[0];
  }


  /* =========================
     DUPLICATE LOGIC (CORE)
  ========================== */

  async ensureNoDuplicate({ id = null, branchId, empId, effectiveDate }) {
    const pool = await getPool();
    const newEmp = Number(empId);

    // ✅ DATE-ONLY normalization (avoid time issues)
    const toDateOnly = (val) => {
      const d = new Date(val);
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    };

    /* =====================================
       0) SCENE-2 RULE (CREATE ONLY):
       Max 2 ACTIVE / NOT-EXPIRED assignments per branch
       - "Active" means: EndDate is NULL OR EndDate >= Today
       - EndDate = (Next EffectiveDate - 1 day)
    ====================================== */
    if (id == null) {
      const activeRes = await pool.request()
        .input("branchId", sql.Int, branchId)
        .query(`
        ;WITH x AS (
          SELECT
            ID,
            CAST(EffectiveDate AS date) AS StartD,
            LEAD(CAST(EffectiveDate AS date)) OVER (
              PARTITION BY BranchID
              ORDER BY CAST(EffectiveDate AS date), ID
            ) AS NextD
          FROM GoGreen.OPS.Branch_BC_Binding
          WHERE BranchID = @branchId
        ),
        y AS (
          SELECT
            ID,
            StartD,
            CASE
              WHEN NextD IS NULL THEN NULL
              ELSE DATEADD(DAY, -1, NextD)
            END AS EndD
          FROM x
        )
        SELECT COUNT(1) AS Cnt
        FROM y
        WHERE (EndD IS NULL OR EndD >= CAST(GETDATE() AS date)); -- ✅ not expired
      `);

      const activeCnt = Number(activeRes.recordset?.[0]?.Cnt ?? 0);

      if (activeCnt >= 2) {
        const err = new Error(
          "New insertion not allowed. 2 assignments are still active/not-expired. Wait until one expires, then add."
        );
        err.code = "TWO_ACTIVE_ALREADY";
        throw err;
      }
    }

    /* =====================================
       1) SAME-DAY COLLISION (NO ENTRY ON SAME DATE)
       - Applies to CREATE + UPDATE
    ====================================== */
    const collisionReq = pool.request();
    collisionReq.input("id", sql.Int, id);
    collisionReq.input("branchId", sql.Int, branchId);
    collisionReq.input("effectiveDate", sql.DateTime, effectiveDate);

    const collision = await collisionReq.query(`
    SELECT TOP 1
      ID,
      CONVERT(varchar(10), CAST(EffectiveDate AS date), 23) AS ExistingDate
    FROM GoGreen.OPS.Branch_BC_Binding
    WHERE BranchID = @branchId
      AND CAST(EffectiveDate AS date) = CAST(@effectiveDate AS date)
      AND (@id IS NULL OR ID <> @id)
    ORDER BY ID DESC;
  `);

    if (collision.recordset?.[0]?.ID) {
      const err = new Error(
      `Duplicate: This branch already has an assignment on the same date (${collision.recordset[0].ExistingDate}).`
    );
    err.code = "EFFECTIVE_DATE_COLLISION";
    err.existingId = collision.recordset[0].ID;
    throw err;
  }

  /* =====================================
     ✅ SCENE-1 NOTE:
     "EARLIEST DATE LOCK" REMOVED
     Now you can add earlier dates (26/27/28) even if 31 already exists.
  ====================================== */

  /* =====================================
     2) FIND IMMEDIATE PREV / NEXT (NEIGHBORS)
     - Used for consecutive duplicate rule (A > A not allowed)
  ====================================== */
  const neighborsReq = pool.request();
  neighborsReq.input("id", sql.Int, id);
  neighborsReq.input("branchId", sql.Int, branchId);
  neighborsReq.input("effectiveDate", sql.DateTime, effectiveDate);

  const neighbors = await neighborsReq.query(`
        ;WITH PrevRow AS(
          SELECT TOP 1 ID, BC_Emp_ID, CAST(EffectiveDate AS date) AS D
      FROM GoGreen.OPS.Branch_BC_Binding
      WHERE BranchID = @branchId
        AND CAST(EffectiveDate AS date) < CAST(@effectiveDate AS date)
        AND(@id IS NULL OR ID <> @id)
      ORDER BY CAST(EffectiveDate AS date) DESC, ID DESC
        ),
          NextRow AS(
            SELECT TOP 1 ID, BC_Emp_ID, CAST(EffectiveDate AS date) AS D
      FROM GoGreen.OPS.Branch_BC_Binding
      WHERE BranchID = @branchId
        AND CAST(EffectiveDate AS date) > CAST(@effectiveDate AS date)
        AND(@id IS NULL OR ID <> @id)
      ORDER BY CAST(EffectiveDate AS date) ASC, ID ASC
          )
      SELECT
        (SELECT ID FROM PrevRow) AS PrevID,
          (SELECT BC_Emp_ID FROM PrevRow) AS PrevEmp,
            (SELECT ID FROM NextRow) AS NextID,
              (SELECT BC_Emp_ID FROM NextRow) AS NextEmp;
      `);

  const nb = neighbors.recordset?.[0] || {};
  const prevEmp = nb.PrevEmp != null ? Number(nb.PrevEmp) : null;
  const nextEmp = nb.NextEmp != null ? Number(nb.NextEmp) : null;

  /* =====================================
     3) CORE RULE: NO CONSECUTIVE DUPLICATE (A > A not allowed)
     - Block if newEmp equals immediate previous OR immediate next.
     - Allows A > B > A
  ====================================== */
  if (prevEmp !== null && newEmp === prevEmp) {
    const err = new Error("Duplicate: Same employee cannot be consecutive (A > A not allowed).");
    err.code = "CONSECUTIVE_DUPLICATE";
    err.existingId = nb.PrevID;
    throw err;
  }

  if (nextEmp !== null && newEmp === nextEmp) {
    const err = new Error("Duplicate: Same employee cannot be consecutive (A > A not allowed).");
    err.code = "CONSECUTIVE_DUPLICATE";
    err.existingId = nb.NextID;
    throw err;
  }

  // ✅ Passed
}




}

export const bindingService = new BindingService();


