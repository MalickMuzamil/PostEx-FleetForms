import { branchGeneralEmpBindingService } from "../services/branch-general-employee-binding-service.js";

class BranchGeneralEmpBindingController {
    // ✅ Lookups
    async listActiveEmployees(req, res, next) {
        try {
            const data = await branchGeneralEmpBindingService.listActiveEmployees();
            res.json(data);
        } catch (err) {
            next(err);
        }
    }

    async listBranches(req, res, next) {
        try {
            const data = await branchGeneralEmpBindingService.listBranches();
            res.json(data);
        } catch (err) {
            next(err);
        }
    }

    // ✅ Table/List
    async listBindings(req, res, next) {
        try {
            const data = await branchGeneralEmpBindingService.listBindings();
            res.json(data);
        } catch (err) {
            next(err);
        }
    }

    // ✅ Create
    async create(req, res, next) {
        try {
            const created = await branchGeneralEmpBindingService.createBinding(req.body);
            return res.status(201).json({ message: "Binding created successfully.", data: created });
        } catch (err) {
            if (err?.code === "DUPLICATE_BINDING") {
                return res.status(409).json({
                    message: "Duplicate binding not allowed. This employee/email (or branch/employee) is already assigned.",
                    existingId: err.existingId,
                });
            }
            next(err);
        }
    }

    // ✅ Update (only Email, EffectiveDate, Status)
    async update(req, res, next) {
        try {
            const id = Number(req.params.id);
            const updated = await branchGeneralEmpBindingService.updateBinding(id, req.body);

            if (!updated) return res.status(404).json({ message: "Binding not found" });

            return res.json({ message: "Binding updated successfully.", data: updated });
        } catch (err) {
            if (err?.code === "DUPLICATE_BINDING") {
                return res.status(409).json({
                    message: "Duplicate binding not allowed. This employee/email (or branch/employee) is already assigned.",
                    existingId: err.existingId,
                });
            }
            next(err);
        }
    }

    // ✅ Delete
    async remove(req, res, next) {
        try {
            const id = Number(req.params.id);
            const deleted = await branchGeneralEmpBindingService.deleteBinding(id);
            res.json(deleted);
        } catch (err) {
            next(err);
        }
    }
}

export const branchGeneralEmpBindingController =
    new BranchGeneralEmpBindingController();
