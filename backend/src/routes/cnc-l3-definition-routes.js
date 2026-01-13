import { Router } from "express";
import { opsCncL3DefinitionController } from "../controllers/cnc-l3-definition-controller.js";

const router = Router();

router.get("/roles", opsCncL3DefinitionController.getRoles);

router.get("/", opsCncL3DefinitionController.getAll);
router.post("/", opsCncL3DefinitionController.create);
router.put("/:id", opsCncL3DefinitionController.update);
router.delete("/:id", opsCncL3DefinitionController.delete);

export default router;
