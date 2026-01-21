import express from "express";
import { deliveryRouteDefinitionController } from "../controllers/delivery-route-definition-controller.js";

const router = express.Router();

router.get("/", (req, res) => deliveryRouteDefinitionController.getAll(req, res));
router.post("/", (req, res) => deliveryRouteDefinitionController.create(req, res));
router.delete("/:id", (req, res) => deliveryRouteDefinitionController.remove(req, res));
router.put("/:id", (req, res) => deliveryRouteDefinitionController.update(req, res));


export default router;