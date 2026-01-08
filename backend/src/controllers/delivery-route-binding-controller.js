import { deliveryRouteBindingService } from "../services/delivery-route-binding-service.js";

class DeliveryRouteBindingController {
    // ---------- GET ALL ----------
    async list(req, res) {
        try {
            const data = await deliveryRouteBindingService.listBindings();
            return res.status(200).json({ data });
        } catch (err) {
            console.error("list error:", err);
            return res.status(500).json({
                message: "Failed to fetch delivery route bindings",
            });
        }
    }

    // ---------- Route → Branches ----------
    async branchesByRoute(req, res) {
        try {
            const deliveryRouteId = Number(req.params?.deliveryRouteId);
            if (!deliveryRouteId) {
                return res.status(400).json({ message: "Invalid deliveryRouteId" });
            }

            const data =
                await deliveryRouteBindingService.getBranchesByRouteId(
                    deliveryRouteId
                );

            return res.status(200).json({ data });
        } catch (err) {
            console.error("branchesByRoute error:", err);
            return res.status(500).json({ message: "Failed to fetch branches" });
        }
    }

    // ---------- DELIVERY ROUTES MASTER ----------
    async deliveryRoutes(req, res) {
        try {
            const data = await deliveryRouteBindingService.listDeliveryRoutes();
            return res.status(200).json({ data });
        } catch (err) {
            console.error("deliveryRoutes error:", err);
            return res.status(500).json({ message: "Failed to fetch delivery routes" });
        }
    }

    // ---------- Route + Branch → SubBranches ----------
    async subBranchesByRouteAndBranch(req, res) {
        try {
            const deliveryRouteId = Number(req.params?.deliveryRouteId);
            const branchId = Number(req.params?.branchId);

            if (!deliveryRouteId) {
                return res.status(400).json({ message: "Invalid deliveryRouteId" });
            }
            if (!branchId) {
                return res.status(400).json({ message: "Invalid branchId" });
            }

            const data =
                await deliveryRouteBindingService.getSubBranchesByRouteAndBranch({
                    deliveryRouteId,
                    branchId,
                });

            return res.status(200).json({ data });
        } catch (err) {
            console.error("subBranchesByRouteAndBranch error:", err);
            return res.status(500).json({ message: "Failed to fetch sub branches" });
        }
    }

    // ---------- CREATE (Single / Bulk) ----------
    async create(req, res) {
        try {
            const payload = req.body;

            const validateOne = (p) => {
                if (!p) return "Payload required";
                if (!p.branchId || !p.subBranchId || !p.deliveryRouteId)
                    return "branchId, subBranchId, deliveryRouteId are required";
                if (!p.effectiveDate) return "effectiveDate is required";
                if (
                    p.requiredReportsFlag != null &&
                    p.requiredReportsFlag !== 0 &&
                    p.requiredReportsFlag !== 1
                )
                    return "requiredReportsFlag must be 0 or 1";
                return null;
            };

            const isBulkObj =
                payload &&
                !Array.isArray(payload) &&
                typeof payload === "object" &&
                Array.isArray(payload.payloads);

            // -------- BULK ----------
            if (Array.isArray(payload) || isBulkObj) {
                const rows = Array.isArray(payload) ? payload : payload.payloads;
                const force = isBulkObj ? Boolean(payload.force) : false;

                if (!rows.length) {
                    return res.status(400).json({ message: "Payload array is empty" });
                }

                for (const [i, p] of rows.entries()) {
                    const errMsg = validateOne(p);
                    if (errMsg) {
                        return res
                            .status(400)
                            .json({ message: `Row ${i + 1}: ${errMsg}` });
                    }
                }

                const result =
                    await deliveryRouteBindingService.createBulkBindings(
                        isBulkObj ? { payloads: rows, force } : rows
                    );

                return res.status(201).json({
                    message: "Bulk delivery route bindings saved successfully",
                    data: result,
                });
            }

            // -------- SINGLE ----------
            const errMsg = validateOne(payload);
            if (errMsg) return res.status(400).json({ message: errMsg });

            const result =
                await deliveryRouteBindingService.createBinding(payload);

            return res.status(201).json({
                message: "Delivery route binding saved successfully",
                data: result,
            });
        } catch (err) {
            console.error("create error:", err);

            if (err?.httpStatus === 409 && err?.code) {
                return res.status(409).json({
                    message: err.message,
                    code: err.code,
                    conflict: err.conflict,
                    conflicts: err.conflicts,
                });
            }

            return res.status(err?.httpStatus || 500).json({
                message: err.message || "Failed to save delivery route binding",
            });
        }
    }

    // ---------- UPDATE ----------
    async update(req, res) {
        try {
            const { id } = req.params;
            const payload = req.body;

            if (!id || isNaN(Number(id))) {
                return res.status(400).json({ message: "Invalid id" });
            }

            if (!payload?.effectiveDate) {
                return res
                    .status(400)
                    .json({ message: "effectiveDate is required" });
            }

            const result =
                await deliveryRouteBindingService.updateBinding(id, payload);

            if (!result) {
                return res
                    .status(404)
                    .json({ message: "Delivery route binding not found" });
            }

            return res.status(200).json({
                message: "Delivery route binding updated successfully",
                data: result,
            });
        } catch (err) {
            console.error("update error:", err);

            if (err?.httpStatus === 409 && err?.code) {
                return res.status(409).json({
                    message: err.message,
                    code: err.code,
                    conflict: err.conflict,
                    conflicts: err.conflicts,
                });
            }

            return res.status(err?.httpStatus || 500).json({
                message: err.message || "Failed to update delivery route binding",
            });
        }
    }

    // ---------- DELETE ----------
    async delete(req, res) {
        try {
            const { id } = req.params;

            if (!id || isNaN(Number(id))) {
                return res.status(400).json({ message: "Invalid id" });
            }

            const result =
                await deliveryRouteBindingService.deleteBinding(id);

            if (!result) {
                return res
                    .status(404)
                    .json({ message: "Delivery route binding not found" });
            }

            return res.status(200).json({
                message: "Delivery route binding deleted successfully",
                data: result,
            });
        } catch (err) {
            console.error("delete error:", err);
            return res.status(500).json({
                message: "Failed to delete delivery route binding",
            });
        }
    }
}

export const deliveryRouteBindingController =
    new DeliveryRouteBindingController();
