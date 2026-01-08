import AuthService from "../services/auth-service.js";

const authService = new AuthService();

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await authService.login(email, password);
        return res.json(result);
    } catch (e) {
        return res.status(e.status || 500).json({ message: e.message });
    }
};

export const signup = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const result = await authService.signup({ name, email, password });
        return res.status(201).json(result);
    } catch (e) {
        return res.status(e.status || 500).json({ message: e.message });
    }
};

export const verify = (req, res) => {
    // authMiddleware req.user set karta hai
    return res.json({ ok: true, user: req.user });
};
