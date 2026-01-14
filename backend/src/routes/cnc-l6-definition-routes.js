import { Router } from "express";
import { opsCncL6DefinitionController } from "../controllers/cnc-l6-definition-controller.js";

const router = Router();

router.get("/roles", opsCncL6DefinitionController.getRoles);

router.get("/", opsCncL6DefinitionController.getAll);
router.post("/", opsCncL6DefinitionController.create);
router.put("/:id", opsCncL6DefinitionController.update);
router.delete("/:id", opsCncL6DefinitionController.delete);

export default router;