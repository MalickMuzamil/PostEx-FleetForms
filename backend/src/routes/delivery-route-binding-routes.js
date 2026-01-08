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
