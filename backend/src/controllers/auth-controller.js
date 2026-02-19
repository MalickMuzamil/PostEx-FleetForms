import AuthService from "../services/auth-service.js";
const authService = new AuthService();

export const login = async (req, res) => {
    try {
        const { email } = req.body;
        const result = await authService.login(email);
        return res.json(result);
    } catch (e) {
        return res.status(e.status || 500).json({ message: e.message || "Login failed" });
    }
};

export const startOtp = async (req, res) => {
    try {
        const { email } = req.body;
        const result = await authService.startOtp(email);
        return res.json(result);
    } catch (e) {
        return res.status(e.status || 500).json({ message: e.message || "OTP start failed" });
    }
};

export const resendOtp = async (req, res) => {
    try {
        const { email } = req.body;
        const result = await authService.startOtp(email);
        return res.json(result);
    } catch (e) {
        return res.status(e.status || 500).json({ message: e.message || "OTP resend failed" });
    }
};

export const verifyOtp = async (req, res) => {
    try {
        const { email, otpCode } = req.body;
        const result = await authService.verifyOtp(email, otpCode);
        return res.json(result);
    } catch (e) {
        return res.status(e.status || 500).json({ message: e.message || "OTP verify failed" });
    }
};

export const verify = (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    return res.json({ ok: true, user: req.user });
};

export const issueJwt = async (req, res) => {
    try {
        const { email } = req.body;
        const result = await authService.issueJwt(email);
        return res.json(result);
    } catch (e) {
        return res.status(e.status || 500).json({ message: e.message || "JWT issue failed" });
    }
};