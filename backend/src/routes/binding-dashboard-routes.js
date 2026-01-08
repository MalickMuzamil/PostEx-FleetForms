import { Router } from "express";
import { branchDashboardBindingController } from "../controllers/branch-dashboard-binding-controller.js";

const router = Router();

// dropdown
router.get("/branches", branchDashboardBindingController.getBranches);

// crud
router.get("/", branchDashboardBindingController.getAllBindings);
router.post("/", branchDashboardBindingController.createBinding);
router.put("/:id", branchDashboardBindingController.updateBinding);
router.delete("/:id", branchDashboardBindingController.deleteBinding);

export default router;
