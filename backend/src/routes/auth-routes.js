import express from "express";
import { login, verify, signup } from "../controllers/auth-controller.js";
import { authMiddleware } from "../middleware/auth-middleware.js";

const router = express.Router();

router.post("/login", login);
router.post("/signup", signup);  
router.get("/verify", authMiddleware, verify);

export default router;
