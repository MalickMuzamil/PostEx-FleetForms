// routes/sub-branch-assignment-definition-routes.js
import { Router } from "express";
import { subBranchAssignmentDefinitionController } from "../controllers/sub-branch-assignment-definition-controller.js";

const router = Router();

// dropdowns
router.get(
    "/sub-branches",
    subBranchAssignmentDefinitionController.getSubBranches
);
router.get(
    "/sub-branches/:subBranchId",
    subBranchAssignmentDefinitionController.getSubBranchById
);
router.get(
    "/employees/active",
    subBranchAssignmentDefinitionController.getActiveEmployeesByBranch
);

// CRUD
router.get("/", subBranchAssignmentDefinitionController.getAll);
router.get("/:id", subBranchAssignmentDefinitionController.getById);
router.post("/", subBranchAssignmentDefinitionController.create);
router.put("/:id", subBranchAssignmentDefinitionController.update);
router.delete("/:id", subBranchAssignmentDefinitionController.delete);

export default router;
