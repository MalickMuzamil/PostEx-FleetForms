import { opsCncL1DefinitionService } from "../services/cnc-l1-service.js";

class OpsCncL1DefinitionController {
    getAll = async (req, res, next) => {
        try {
            const data = await opsCncL1DefinitionService.getAll();
            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

    getRoles = async (req, res, next) => {
        try {
            const data = await opsCncL1DefinitionService.listRoles();
            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

    search = async (req, res, next) => {
        try {
            const { q } = req.query;

            const data = await opsCncL1DefinitionService.search({ q });

            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

    create = async (req, res, next) => {
        try {
            const { role, name, description, enteredOn, enteredBy } = req.body;

            if (!name || !description) {
                return res.status(400).json({
                    message: "name and description are required.",
                });
            }

            // role optional (depends on your UI/backend rule)
            const data = await opsCncL1DefinitionService.create({
                role: role ?? null,
                name,
                description,
                enteredOn,
                enteredBy,
            });

            return res.status(201).json({
                message: "CnC L1 definition created successfully.",
                data,
            });
        } catch (err) {
            if (err?.code === "DUPLICATE_CNC_L1") {
                return res.status(409).json({
                    message: "Duplicate record not allowed. Same role + name already exists.",
                    existingId: err.existingId,
                });
            }

            next(err);
        }
    };

    update = async (req, res, next) => {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({ message: "id is required" });
            }

            const data = await opsCncL1DefinitionService.update(id, req.body);

            if (!data) {
                return res.status(404).json({ message: "CnC L1 definition not found" });
            }

            return res.json({
                message: "CnC L1 definition updated successfully",
                data,
            });
        } catch (err) {
            if (err?.code === "DUPLICATE_CNC_L1") {
                return res.status(409).json({
                    message: "Duplicate record not allowed. Same role + name already exists.",
                    existingId: err.existingId,
                });
            }

            next(err);
        }
    };

    delete = async (req, res, next) => {
        try {
            const { id } = req.params;
            const data = await opsCncL1DefinitionService.delete(id);

            if (!data) {
                return res.status(404).json({ message: "CnC L1 definition not found" });
            }

            res.json({ message: "CnC L1 definition deleted successfully", data });
        } catch (e) {
            next(e);
        }
    };
}

export const opsCncL1DefinitionController = new OpsCncL1DefinitionController();