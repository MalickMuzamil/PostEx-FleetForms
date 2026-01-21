// controllers/sub-branch-assignment-definition-controller.js
import { subBranchAssignmentDefinitionService } from "../services/sub-branch-assignment-definition-service.js";

class SubBranchAssignmentDefinitionController {

    // ---------- SUB-BRANCHES ----------
    getSubBranches = async (req, res, next) => {
        try {
            const data = await subBranchAssignmentDefinitionService.listSubBranches();
            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

    // ---------- SUB-BRANCH BY ID ----------
    getSubBranchById = async (req, res, next) => {
        try {
            const idNum = Number(req.params.subBranchId);
            if (!idNum) {
                return res.status(400).json({ message: "Invalid subBranchId." });
            }

            const data = await subBranchAssignmentDefinitionService.getSubBranchById(idNum);
            if (!data) {
                return res.status(404).json({ message: "Sub-Branch not found." });
            }

            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

    // ---------- ACTIVE EMPLOYEES ----------
    getActiveEmployeesByBranch = async (req, res, next) => {
        try {
            const branchId = Number(req.query.branchId);
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

    // ---------- LIST ----------
    getAll = async (req, res, next) => {
        try {
            const data = await subBranchAssignmentDefinitionService.listAssignments();
            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

    // ---------- GET BY ID ----------
    getById = async (req, res, next) => {
        try {
            const idNum = Number(req.params.id);
            if (!idNum) {
                return res.status(400).json({ message: "Invalid id." });
            }

            const data = await subBranchAssignmentDefinitionService.getAssignmentById(idNum);
            if (!data) {
                return res.status(404).json({ message: "Assignment not found." });
            }

            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

    // ---------- CREATE ----------
    create = async (req, res, next) => {
        try {
            const { subBranchId, employeeId, email, effectiveDate } = req.body;

            if (!subBranchId || !employeeId || !email || !effectiveDate) {
                return res.status(400).json({
                    message: "subBranchId, employeeId, email, effectiveDate are required.",
                });
            }

            const data = await subBranchAssignmentDefinitionService.createAssignment({
                subBranchId,
                employeeId,
                email,
                effectiveDate,
            });

            res.status(201).json({
                message: "Assignment created successfully.",
                data,
            });
        } catch (err) {

            // ✅ SAME AS BINDING — timeline validations
            if (
                err?.code === "EFFECTIVE_DATE_COLLISION" ||
                err?.code === "PAST_LOCKED" ||
                err?.code === "CONSECUTIVE_DUPLICATE"
            ) {
                return res.status(409).json({
                    message: err.message,
                    existingId: err.existingId,
                    code: err.code,
                });
            }

            // ✅ validation / business errors
            if (
                err?.code === "INVALID_EFFECTIVE_DATE" ||
                err?.code === "INVALID_EMAIL" ||
                err?.code === "EMP_INACTIVE" ||
                err?.code === "EMP_BRANCH_MISMATCH" ||
                err?.code === "EMP_NOT_FOUND" ||
                err?.code === "SUB_BRANCH_NOT_FOUND"
            ) {
                return res.status(400).json({
                    message: err.message,
                    code: err.code,
                });
            }

            next(err);
        }
    };

    // ---------- UPDATE ----------
    update = async (req, res, next) => {
        try {
            const idNum = Number(req.params.id);
            if (!idNum) {
                return res.status(400).json({ message: "Invalid id." });
            }

            const data = await subBranchAssignmentDefinitionService.updateAssignment(
                idNum,
                req.body
            );

            if (!data) {
                return res.status(404).json({ message: "Assignment not found." });
            }

            res.json({
                message: "Assignment updated successfully.",
                data,
            });
        } catch (err) {

            // ✅ SAME AS BINDING — timeline validations
            if (
                err?.code === "EFFECTIVE_DATE_COLLISION" ||
                err?.code === "PAST_LOCKED" ||
                err?.code === "CONSECUTIVE_DUPLICATE"
            ) {
                return res.status(409).json({
                    message: err.message,
                    existingId: err.existingId,
                    code: err.code,
                });
            }

            // ✅ sub-branch change not allowed (binding jaisa)
            if (err?.code === "SUB_BRANCH_CHANGE_NOT_ALLOWED") {
                return res.status(400).json({
                    message: err.message,
                    code: err.code,
                });
            }

            // ✅ validation / business errors
            if (
                err?.code === "INVALID_EFFECTIVE_DATE" ||
                err?.code === "INVALID_EMAIL" ||
                err?.code === "EMP_INACTIVE" ||
                err?.code === "EMP_BRANCH_MISMATCH" ||
                err?.code === "EMP_NOT_FOUND" ||
                err?.code === "SUB_BRANCH_NOT_FOUND"
            ) {
                return res.status(400).json({
                    message: err.message,
                    code: err.code,
                });
            }

            next(err);
        }
    };

    // ---------- DELETE ----------
    delete = async (req, res, next) => {
        try {
            const idNum = Number(req.params.id);
            if (!idNum) {
                return res.status(400).json({ message: "Invalid id." });
            }

            const data = await subBranchAssignmentDefinitionService.deleteAssignment(idNum);
            if (!data) {
                return res.status(404).json({ message: "Assignment not found." });
            }

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
