import { Router } from "express";
import { opsCncL5DefinitionController } from "../controllers/cnc-l5-definition-controller.js";

const router = Router();

router.get("/roles", opsCncL5DefinitionController.getRoles);

router.get("/", opsCncL5DefinitionController.getAll);
router.post("/", opsCncL5DefinitionController.create);
router.put("/:id", opsCncL5DefinitionController.update);
router.delete("/:id", opsCncL5DefinitionController.delete);

export default router;