import express from "express";
import { login, verify, startOtp, verifyOtp, resendOtp, issueJwt } from "../controllers/auth-controller.js";
import { authMiddleware } from "../middleware/auth-middleware.js";

const router = express.Router();

router.post("/login", login);
router.get("/verify", authMiddleware, verify);
router.post("/start-otp", startOtp);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);
router.post("/issue-jwt", issueJwt);

export default router;
