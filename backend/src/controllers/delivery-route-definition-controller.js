// controllers/delivery-route-definition-controller.js
import { deliveryRouteDefinitionService } from "../services/delivery-route-definition-service.js";

class DeliveryRouteDefinitionController {
    // GET: /delivery-routes
    async getAll(req, res) {
        try {
            const data = await deliveryRouteDefinitionService.listRoutes();
            return res.status(200).json({ data });
        } catch (err) {
            console.error("getAll error:", err);
            return res.status(500).json({ message: "Failed to fetch delivery routes" });
        }
    }

    // POST: /delivery-routes
    async create(req, res) {
        try {
            const { routeDescription } = req.body;

            if (!routeDescription || !routeDescription.trim()) {
                return res.status(400).json({ message: "routeDescription is required" });
            }

            const data = await deliveryRouteDefinitionService.createRoute({
                routeDescription,
            });

            return res.status(201).json({
                message: "Delivery route description created successfully",
                data,
            });
        } catch (err) {
            console.error("create error:", err);

            if (err?.code === "DUPLICATE_DELIVERY_ROUTE_DESC") {
                return res.status(409).json({
                    message: err.message || "Duplicate delivery route description",
                    code: err.code,
                    existingId: err.existingId,
                });
            }

            return res.status(500).json({
                message: err.message || "Failed to create delivery route description",
            });
        }
    }

    // DELETE: /delivery-routes/:id
    async remove(req, res) {
        try {
            const { id } = req.params;

            if (!id || isNaN(Number(id))) {
                return res.status(400).json({ message: "Invalid id" });
            }

            const data = await deliveryRouteDefinitionService.deleteRoute(Number(id));

            if (!data) {
                return res.status(404).json({ message: "Delivery route description not found" });
            }

            return res.status(200).json({
                message: "Delivery route description deleted successfully",
                data,
            });
        } catch (err) {
            console.error("remove error:", err);
            return res.status(500).json({ message: "Failed to delete delivery route description" });
        }
    }
}

export const deliveryRouteDefinitionController =
    new DeliveryRouteDefinitionController();
