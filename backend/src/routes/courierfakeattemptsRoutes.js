import express from "express";
import { courierFakeAttemptsController } from "../controllers/courier-fake-attempts-controller.js";

const router = express.Router();

router.get("/", courierFakeAttemptsController.getAll);
router.post("/validate-bulk", courierFakeAttemptsController.validateBulk);
router.post("/bulk-import", courierFakeAttemptsController.bulkImport);
router.delete("/", courierFakeAttemptsController.delete);

export default router;