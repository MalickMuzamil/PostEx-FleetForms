import { Router } from "express";
import { opsCncL2DefinitionController } from "../controllers/cnc-l2-definition-controller.js";

const router = Router();

router.get("/roles", opsCncL2DefinitionController.getRoles);

router.get("/", opsCncL2DefinitionController.getAll);
router.post("/", opsCncL2DefinitionController.create);
router.put("/:id", opsCncL2DefinitionController.update);
router.delete("/:id", opsCncL2DefinitionController.delete);

export default router;