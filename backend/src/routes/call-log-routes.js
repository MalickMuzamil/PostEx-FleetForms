// =============================
// 2) routes/call-logs-routes.js
// =============================
import express from "express";
import { callLogsController } from "../controllers/call-logs-controller.js";

const router = express.Router();

router.get("/", callLogsController.getAll);
router.post("/validate-bulk", callLogsController.validateBulk);
router.post("/bulk-import", callLogsController.bulkImport);

export default router;
