import { opsCncL5DefinitionService } from "../services/cnc-l5-service.js";

class OpsCncL5DefinitionController {
  getAll = async (req, res, next) => {
    try {
      const data = await opsCncL5DefinitionService.getAll();
      res.json({ data });
    } catch (err) {
      next(err);
    }
  };

  getRoles = async (req, res, next) => {
    try {
      const data = await opsCncL5DefinitionService.listRoles();
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

      const data = await opsCncL5DefinitionService.create({
        role: role ?? null,
        name,
        description,
        enteredOn,
        enteredBy,
      });

      return res.status(201).json({
        message: "CnC L5 definition created successfully.",
        data,
      });
    } catch (err) {
      if (err?.code === "DUPLICATE_CNC_L5") {
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
      if (!id) return res.status(400).json({ message: "id is required" });

      const data = await opsCncL5DefinitionService.update(id, req.body);
      if (!data) return res.status(404).json({ message: "CnC L5 definition not found" });

      return res.json({
        message: "CnC L5 definition updated successfully",
        data,
      });
    } catch (err) {
      if (err?.code === "DUPLICATE_CNC_L5") {
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

      const data = await opsCncL5DefinitionService.delete(id);
      if (!data) return res.status(404).json({ message: "CnC L5 definition not found" });

      res.json({ message: "CnC L5 definition deleted successfully", data });
    } catch (e) {
      next(e);
    }
  };
}

export const opsCncL5DefinitionController = new OpsCncL5DefinitionController();