import { bindingService } from "../services/binding-service.js";

class BindingController {

    getActiveEmployees = async (req, res, next) => {
        try {
            const data = await bindingService.listActiveEmployees();
            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

    getBranches = async (req, res, next) => {
        try {
            const data = await bindingService.listBranches();
            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

    getAllBindings = async (req, res, next) => {
        try {
            const data = await bindingService.listBindings();
            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

    searchBindings = async (req, res, next) => {
        try {
            const { empId, branchId, email, name } = req.query;

            const data = await bindingService.searchBindings({
                empId,
                branchId,
                email,
                name,
            });

            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

    createBinding = async (req, res, next) => {
        try {
            const { empId, branchId, email, effectiveDate } = req.body;

            if (!empId || !branchId || !email || !effectiveDate) {
                return res.status(400).json({
                    message: "empId, branchId, email, effectiveDate are required.",
                });
            }

            const data = await bindingService.createBinding({
                empId,
                branchId,
                email,
                effectiveDate,
            });

            return res.status(201).json({
                message: "Binding created successfully.",
                data,
            });
        } catch (err) {
            if (err?.code === "USER_NOT_ACTIVE") {
                return res.status(400).json({
                    message: "Selected user is not active. Please select an active user.",
                });
            }

            if (err?.code === "DUPLICATE_BINDING") {
                return res.status(409).json({
                    message:
                        "Duplicate binding not allowed. This user/email (or branch/user) is already assigned.",
                    existingId: err.existingId,
                });
            }

            next(err);
        }
    };

    updateBinding = async (req, res, next) => {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({ message: "Binding id is required" });
            }

            const data = await bindingService.updateBinding(id, req.body);

            if (!data) {
                return res.status(404).json({ message: "Binding not found" });
            }

            return res.json({
                message: "Binding updated successfully",
                data,
            });
        } catch (err) {
            if (err?.code === "DUPLICATE_BINDING") {
                return res.status(409).json({
                    message:
                        "Duplicate binding not allowed. This user/email (or branch/user) is already assigned.",
                    existingId: err.existingId,
                });
            }

            if (err?.code === "USER_NOT_ACTIVE") {
                return res.status(400).json({
                    message: "Selected user is not active. Please select an active user.",
                });
            }

            next(err);
        }
    };


    deleteBinding = async (req, res, next) => {
        try {
            const { id } = req.params;
            const data = await bindingService.deleteBinding(id);

            if (!data) {
                return res.status(404).json({ message: "Binding not found" });
            }

            res.json({ message: "Binding deleted successfully", data });
        } catch (e) {
            next(e);
        }
    };
}

export const bindingController = new BindingController();