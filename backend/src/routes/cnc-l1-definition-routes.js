import { Router } from "express";
import { opsCncL1DefinitionController } from "../controllers/cnc-l1-definition-controller.js";

const router = Router();

router.get("/", opsCncL1DefinitionController.getAll);
router.get("/search", opsCncL1DefinitionController.search);

router.post("/", opsCncL1DefinitionController.create);
router.put("/:id", opsCncL1DefinitionController.update);
router.delete("/:id", opsCncL1DefinitionController.delete);
router.get("/roles", opsCncL1DefinitionController.getRoles);

export default router;
