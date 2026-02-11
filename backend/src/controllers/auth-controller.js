import AuthService from "../services/auth-service.js";

const authService = new AuthService();

export const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        const result = await authService.login(username, password);

        return res.json(result);
    } catch (e) {
        return res.status(e.status || 500).json({
            message: e.message || "Login failed",
        });
    }
};

export const verify = (req, res) => {
    // authMiddleware req.user set karta hai
    return res.json({ ok: true, user: req.user });
};
