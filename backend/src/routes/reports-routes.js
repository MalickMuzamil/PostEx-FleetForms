import express from "express";
import { verifyUser } from "../controllers/reports-controller.js";

const router = express.Router();

router.post("/branch-report", verifyUser);

export default router;