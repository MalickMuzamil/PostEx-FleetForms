import ReportsService from "../services/reports-service.js";
const reportsService = new ReportsService();

export const verifyUser = async (req, res) => {
    try {
        const { email } = req.body;
        const result = await reportsService.verifyUser(email);
        return res.json(result);
    } catch (e) {
        return res.status(e.status || 500).json({ message: e.message || "Verification failed" });
    }
};