import { branchDashboardBindingService } from "../services/branch-dashboard-binding-service.js";

class BranchDashboardBindingController {

    // ---------- BRANCHES (Dropdown) ----------
    getBranches = async (req, res, next) => {
        try {
            const data = await branchDashboardBindingService.listBranches();
            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

    // ---------- LIST ALL BINDINGS ----------
    getAllBindings = async (req, res, next) => {
        try {
            const data = await branchDashboardBindingService.listBindings();
            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

    // ---------- CREATE ----------
    createBinding = async (req, res, next) => {
        try {
            const { branchId, effectiveDate } = req.body;

            if (!branchId || !effectiveDate) {
                return res.status(400).json({
                    message: "branchId and effectiveDate are required.",
                });
            }

            const data = await branchDashboardBindingService.createBinding({
                branchId,
                effectiveDate,
            });

            res.status(201).json({
                message: "Branch Dashboard Binding created successfully.",
                data,
            });
        } catch (err) {
            if (err?.code === "DUPLICATE_BRANCH") {
                return res.status(409).json({
                    message: "This branch has already been bound. No new entry allowed.",
                    existingId: err.existingId,
                });
            }
            next(err);
        }
    };

    // ---------- UPDATE ----------
    updateBinding = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { branchId, reqConCall, effectiveDate } = req.body;

            if (!id) return res.status(400).json({ message: "Invalid id." });
            if (reqConCall === undefined || !effectiveDate) {
                return res.status(400).json({
                    message: "reqConCall and effectiveDate are required.",
                });
            }

            const data = await branchDashboardBindingService.updateBinding(id, {
                branchId, // optional
                reqConCall,
                effectiveDate,
            });

            if (!data) return res.status(404).json({ message: "Binding not found." });

            res.json({
                message: "Branch Dashboard Binding updated successfully.",
                data,
            });
        } catch (err) {
            if (err?.code === "DUPLICATE_BRANCH") {
                return res.status(409).json({
                    message: "This branch has already been bound. No new entry allowed.",
                    existingId: err.existingId,
                });
            }
            next(err);
        }
    };

    // ---------- DELETE ----------
    deleteBinding = async (req, res, next) => {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({ message: "Invalid id." });
            }

            const data = await branchDashboardBindingService.deleteBinding(id);

            if (!data) {
                return res.status(404).json({ message: "Binding not found." });
            }

            res.json({
                message: "Branch Dashboard Binding deleted successfully.",
                data,
            });
        } catch (err) {
            next(err);
        }
    };
}

export const branchDashboardBindingController =
    new BranchDashboardBindingController();
