// controllers/sub-branch-definition-controller.js
import { subBranchDefinitionService } from "../services/sub-branch-definition-service.js";

class SubBranchDefinitionController {
    // ---------- BRANCHES (Dropdown) ----------
    getBranches = async (req, res, next) => {
        try {
            const data = await subBranchDefinitionService.listBranches();
            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

    getAll = async (req, res, next) => {
        try {
            console.log("QUERY:", req.query);

            const branchId = req.query.branchId ? Number(req.query.branchId) : null;
            const includeInactive = req.query.includeInactive === "1";

            const data = branchId
                ? await subBranchDefinitionService.listSubBranchesByBranchId(
                    branchId,
                    includeInactive
                )
                : await subBranchDefinitionService.listSubBranches(); // active only (table/view)

            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

    // ---------- GET BY ID ----------
    getById = async (req, res, next) => {
        try {
            const { id } = req.params;
            if (!id) return res.status(400).json({ message: "Invalid id." });

            const data = await subBranchDefinitionService.getSubBranchById(id);
            if (!data)
                return res.status(404).json({ message: "Sub-Branch not found." });

            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

    // ---------- CREATE ----------
    create = async (req, res, next) => {
        try {
            const {
                branchId,
                subBranchName,
                subBranchDesc,      
                enteredBy,
            } = req.body;

            if (!branchId || !subBranchName) {
                return res.status(400).json({
                    message: "branchId and subBranchName are required.",
                });
            }

            const finalEnteredBy =
                enteredBy || req.user?.username || req.user?.id || "Admin";

            const data = await subBranchDefinitionService.createSubBranch({
                branchId,
                subBranchName,
                subBranchDesc,           // ✅ pass to service
                enteredBy: finalEnteredBy,
            });

            res.status(201).json({
                message: "Sub-Branch created successfully.",
                data,
            });
        } catch (err) {
            if (err?.code === "DUPLICATE_SUB_BRANCH") {
                return res.status(409).json({
                    message: "Sub-Branch Name already exists for this branch.",
                    existingId: err.existingId,
                });
            }
            if (err?.code === "INVALID_FORMAT") {
                return res.status(422).json({
                    message:
                        "Sub-Branch Name format is invalid. Please follow the required format.",
                });
            }
            next(err);
        }
    };

    // ---------- UPDATE ----------
    update = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { branchId, subBranchName, subBranchDesc, editedBy } = req.body;

            const idNum = Number(id);
            if (!idNum) return res.status(400).json({ message: "Invalid id." });

            if (!branchId && !subBranchName && subBranchDesc == null) {
                return res.status(400).json({
                    message: "Nothing to update. Provide branchId, subBranchName, or subBranchDesc.",
                });
            }

            const finalEditedBy =
                editedBy || req.user?.username || req.user?.id || "Admin";

            const data = await subBranchDefinitionService.updateSubBranch(idNum, {
                branchId,
                subBranchName,
                subBranchDesc,      // ✅ add this
                editedBy: finalEditedBy,
            });

            if (!data) return res.status(404).json({ message: "Sub-Branch not found." });

            res.json({ message: "Sub-Branch updated successfully.", data });
        } catch (err) {
            next(err);
        }
    };

    // ---------- DELETE (SOFT DELETE) ----------
    delete = async (req, res, next) => {
        try {
            const { id } = req.params;
            if (!id) return res.status(400).json({ message: "Invalid id." });

            // ✅ deletedBy (frontend bheje ya na bheje, fallback Admin)
            const deletedBy =
                req.body?.deletedBy || req.user?.username || req.user?.id;

            const data = await subBranchDefinitionService.deleteSubBranch(id, deletedBy);

            if (!data)
                return res.status(404).json({ message: "Sub-Branch not found." });

            res.json({
                message: "Sub-Branch deleted successfully.",
                data,
            });
        } catch (err) {
            next(err);
        }
    };
}

export const subBranchDefinitionController = new SubBranchDefinitionController();
