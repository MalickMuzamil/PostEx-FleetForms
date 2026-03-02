// Duplicate avoid: Customer_Number + Master_No + Time (override / upsert)

// =============================
// 1) controllers/call-logs-controller.js
// =============================
import { callLogsService } from "../services/call-logs-service.js";

class CallLogsController {
    getAll = async (req, res, next) => {
        try {
            const top = req.query?.top;
            const data = await callLogsService.list({ top });
            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

    validateBulk = async (req, res, next) => {
        try {
            const payloads = req.body?.payloads ?? [];
            const data = await callLogsService.validateBulk(payloads);
            res.json({ data });
        } catch (err) {
            if (err?.code === "VALIDATION_ERROR") {
                return res.status(400).json({ message: err.message || "Validation error." });
            }
            next(err);
        }
    };

    bulkImport = async (req, res, next) => {
        try {
            const payloads = req.body?.payloads ?? [];

            if (!Array.isArray(payloads) || payloads.length === 0) {
                return res.status(400).json({ message: "payloads array is required." });
            }

            const data = await callLogsService.bulkImport({ payloads });

            return res.status(201).json({
                message: "Call Logs imported successfully (override by Customer_Number + Master_No + Time).",
                data,
            });
        } catch (err) {
            if (err?.code === "BULK_VALIDATION_FAILED") {
                return res.status(400).json({
                    message: err.message || "Bulk validation failed.",
                    code: "BULK_VALIDATION_FAILED",
                    invalidRows: err.invalidRows || [],
                });
            }

            if (err?.code === "VALIDATION_ERROR") {
                return res.status(400).json({ message: err.message || "Validation error." });
            }

            next(err);
        }
    };
}

export const callLogsController = new CallLogsController();


