import { Router } from "express";
import { attendanceController } from "../controllers/attendance-controller.js";

const router = Router();

router.get("/", attendanceController.getAll);

// bulk
router.post("/validate-bulk", attendanceController.validateBulk);
router.post("/bulk-import", attendanceController.bulkImport);

export default router;