import { Router } from "express";
import { opsCncL4DefinitionController } from "../controllers/cnc-l4-definition-controller.js";

const router = Router();

router.get("/roles", opsCncL4DefinitionController.getRoles);

router.get("/", opsCncL4DefinitionController.getAll);
router.post("/", opsCncL4DefinitionController.create);
router.put("/:id", opsCncL4DefinitionController.update);
router.delete("/:id", opsCncL4DefinitionController.delete);

export default router;
