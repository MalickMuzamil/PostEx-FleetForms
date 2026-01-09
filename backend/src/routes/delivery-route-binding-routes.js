import { Router } from "express";
import { deliveryRouteBindingController } from "../controllers/delivery-route-binding-controller.js";

const router = Router();

router.get("/", (req, res) =>
    deliveryRouteBindingController.list(req, res)
);

router.get(
    "/route/:deliveryRouteId/branches",
    (req, res) =>
        deliveryRouteBindingController.branchesByRoute(req, res)
);

router.get(
    "/route/:deliveryRouteId/branch/:branchId/sub-branches",
    (req, res) =>
        deliveryRouteBindingController.subBranchesByRouteAndBranch(req, res)
);

// ✅ NEW (BULK) - branches for many routes
router.post("/routes/branches", (req, res) =>
    deliveryRouteBindingController.branchesByRoutes(req, res)
);

// ✅ NEW (BULK) - sub-branches for many (route,branch) pairs
router.post("/routes/branches/sub-branches", (req, res) =>
    deliveryRouteBindingController.subBranchesByRoutesAndBranches(req, res)
);

router.post("/validate-bulk", (req, res) =>
  deliveryRouteBindingController.validateBulk(req, res)
);

router.post("/", (req, res) =>
    deliveryRouteBindingController.create(req, res)
);

router.put("/:id", (req, res) =>
    deliveryRouteBindingController.update(req, res)
);

router.delete("/:id", (req, res) =>
    deliveryRouteBindingController.delete(req, res)
);

router.get(
    "/delivery-routes",
    (req, res) => deliveryRouteBindingController.deliveryRoutes(req, res)
);

export default router;
