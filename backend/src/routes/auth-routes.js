import express from "express";
import { login, verify, startOtp, verifyOtp, resendOtp } from "../controllers/auth-controller.js";
import { authMiddleware } from "../middleware/auth-middleware.js";

const router = express.Router();

router.post("/login", login);
router.get("/verify", authMiddleware, verify);
router.post("/start-otp", startOtp);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);

export default router;
