// controllers/sub-branch-assignment-definition-controller.js
import { subBranchAssignmentDefinitionService } from "../services/sub-branch-assignment-definition-service.js";

class SubBranchAssignmentDefinitionController {
    // ---------- SUB-BRANCHES (Dropdown) ----------
    // GET /sub-branch-assignment-definition/sub-branches
    getSubBranches = async (req, res, next) => {
        try {
            const data = await subBranchAssignmentDefinitionService.listSubBranches();
            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

    // ---------- SUB-BRANCH BY ID (details) ----------
    // GET /sub-branch-assignment-definition/sub-branches/:subBranchId
    getSubBranchById = async (req, res, next) => {
        try {
            const { subBranchId } = req.params;
            const idNum = Number(subBranchId);

            if (!idNum) return res.status(400).json({ message: "Invalid subBranchId." });

            const data = await subBranchAssignmentDefinitionService.getSubBranchById(idNum);
            if (!data) return res.status(404).json({ message: "Sub-Branch not found." });

            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

    // ---------- ACTIVE EMPLOYEES (by Branch) ----------
    // GET /sub-branch-assignment-definition/employees/active?branchId=1
    getActiveEmployeesByBranch = async (req, res, next) => {
        try {
            const branchId = req.query.branchId ? Number(req.query.branchId) : null;
            if (!branchId) {
                return res.status(400).json({ message: "branchId is required." });
            }

            const data =
                await subBranchAssignmentDefinitionService.listActiveEmployeesByBranch(branchId);

            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

    // ---------- LIST ALL ASSIGNMENTS ----------
    // GET /sub-branch-assignment-definition
    getAll = async (req, res, next) => {
        try {
            const data = await subBranchAssignmentDefinitionService.listAssignments();
            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

    // ---------- GET ASSIGNMENT BY ID ----------
    // GET /sub-branch-assignment-definition/:id
    getById = async (req, res, next) => {
        try {
            const { id } = req.params;
            const idNum = Number(id);

            if (!idNum) return res.status(400).json({ message: "Invalid id." });

            const data = await subBranchAssignmentDefinitionService.getAssignmentById(idNum);
            if (!data) return res.status(404).json({ message: "Assignment not found." });

            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

    // ---------- CREATE ----------
    // POST /sub-branch-assignment-definition
    create = async (req, res, next) => {
        try {
            const {
                subBranchId,
                employeeId,
                email,
                effectiveDate,
                statusFlag,
                force,
                enteredBy,
            } = req.body;

            if (!subBranchId || !employeeId || !email || !effectiveDate) {
                return res.status(400).json({
                    message: "subBranchId, employeeId, email, effectiveDate are required.",
                });
            }

            const finalEnteredBy =
                enteredBy || req.user?.username || req.user?.id || "Admin";

            const data = await subBranchAssignmentDefinitionService.createAssignment({
                subBranchId,
                employeeId,
                email,
                effectiveDate,
                statusFlag,
                force: !!force,
                enteredBy: finalEnteredBy,
            });

            res.status(201).json({
                message: "Assignment created successfully.",
                data,
            });
        } catch (err) {
            // ✅ overwrite confirm / duplicate effective date
            if (err?.status === 409 || err?.code === "CONFIRM_OVERWRITE" || err?.code === "DUPLICATE_EFFECTIVE_DATE") {
                return res.status(409).json({
                    message: err?.message || "Conflict",
                    code: err?.code,
                    conflict: err?.conflict,
                });
            }

            // ✅ validations
            if (
                err?.code === "PAST_EFFECTIVE_DATE" ||
                err?.code === "INVALID_EFFECTIVE_DATE" ||
                err?.code === "INVALID_EMAIL" ||
                err?.code === "EMP_INACTIVE" ||
                err?.code === "EMP_BRANCH_MISMATCH" ||
                err?.code === "EMP_NOT_FOUND" ||
                err?.code === "SUB_BRANCH_NOT_FOUND"
            ) {
                return res.status(422).json({
                    message: err?.message || "Validation failed.",
                    code: err?.code,
                });
            }

            next(err);
        }
    };

    // ---------- UPDATE ----------
    // PUT /sub-branch-assignment-definition/:id
    update = async (req, res, next) => {
        try {
            const { id } = req.params;
            const idNum = Number(id);

            if (!idNum) return res.status(400).json({ message: "Invalid id." });

            const finalEditedBy =
                req.body?.editedBy || req.user?.username || req.user?.id || "Admin";

            const data = await subBranchAssignmentDefinitionService.updateAssignment(
                idNum,
                { ...req.body, editedBy: finalEditedBy }
            );

            if (!data) return res.status(404).json({ message: "Assignment not found." });

            res.json({
                message: "Assignment updated successfully.",
                data,
            });
        } catch (err) {
            // validations
            if (
                err?.code === "PAST_EFFECTIVE_DATE" ||
                err?.code === "INVALID_EFFECTIVE_DATE" ||
                err?.code === "INVALID_EMAIL" ||
                err?.code === "EMP_INACTIVE" ||
                err?.code === "EMP_BRANCH_MISMATCH" ||
                err?.code === "EMP_NOT_FOUND" ||
                err?.code === "SUB_BRANCH_NOT_FOUND"
            ) {
                return res.status(422).json({
                    message: err?.message || "Validation failed.",
                    code: err?.code,
                });
            }

            next(err);
        }
    };

    // ---------- DELETE ----------
    // DELETE /sub-branch-assignment-definition/:id
    delete = async (req, res, next) => {
        try {
            const { id } = req.params;
            const idNum = Number(id);

            if (!idNum) return res.status(400).json({ message: "Invalid id." });

            const data = await subBranchAssignmentDefinitionService.deleteAssignment(idNum);
            if (!data) return res.status(404).json({ message: "Assignment not found." });

            res.json({
                message: "Assignment deleted successfully.",
                data,
            });
        } catch (err) {
            next(err);
        }
    };
}

export const subBranchAssignmentDefinitionController =
    new SubBranchAssignmentDefinitionController();
