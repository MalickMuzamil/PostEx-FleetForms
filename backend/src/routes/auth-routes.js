import express from "express";
import { login, startOtp, verifyOtp, resendOtp, verifyToken } from "../controllers/auth-controller.js";
import { authMiddleware } from "../middleware/auth-middleware.js";

const router = express.Router();

router.post("/login", login);
router.post("/start-otp", startOtp);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);

router.get("/verify-token", authMiddleware, verifyToken);

export default router;
