import express from "express";
import { branchWiseCalenderController } from "../controllers/branch-wise-calender-controller.js";

const router = express.Router();

router.get("/", branchWiseCalenderController.getAll);
router.post("/validate-bulk", branchWiseCalenderController.validateBulk);
router.post("/bulk-import", branchWiseCalenderController.bulkImport);

export default router;