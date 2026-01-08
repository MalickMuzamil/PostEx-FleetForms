import { Router } from "express";
import { subBranchDefinitionController } from "../controllers/sub-branch-definition-controller.js";

const router = Router();

router.get("/branches", subBranchDefinitionController.getBranches);

router.get("/", subBranchDefinitionController.getAll);
router.get("/:id", subBranchDefinitionController.getById);
router.post("/", subBranchDefinitionController.create);
router.put("/:id", subBranchDefinitionController.update);
router.delete("/:id", subBranchDefinitionController.delete);

export default router;