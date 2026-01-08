import { Router } from "express";
import { deliveryRouteBindingController } from "../controllers/delivery-route-binding-controller.js";

const router = Router();

router.get("/", (req, res) => deliveryRouteBindingController.branches(req, res));

router.get("/:branchId/sub-branches", (req, res) =>
    deliveryRouteBindingController.subBranchesByBranch(req, res)
);

export default router;