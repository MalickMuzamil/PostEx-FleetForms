import { branchWiseCalenderService } from "../services/branch-wise-calender-service.js";

class BranchWiseCalenderController {
    getAll = async (req, res, next) => {
        try {
            const top = req.query?.top;
            const data = await branchWiseCalenderService.list({ top });
            return res.json({ data });
        } catch (err) {
            return next(err);
        }
    };

    validateBulk = async (req, res, next) => {
        try {
            const payloads = req.body?.payloads ?? [];
            const data = await branchWiseCalenderService.validateBulk(payloads);
            return res.json({ data });
        } catch (err) {
            if (err?.code === "VALIDATION_ERROR") {
                return res.status(400).json({ message: err.message || "Validation error." });
            }
            return next(err);
        }
    };

    bulkImport = async (req, res, next) => {
        try {
            const payloads = req.body?.payloads ?? [];

            if (!Array.isArray(payloads) || payloads.length === 0) {
                return res.status(400).json({ message: "payloads array is required." });
            }

            const data = await branchWiseCalenderService.bulkImport({ payloads });

            // ✅ service now returns { inserted, updated, skipped }
            return res.status(201).json({
                message: "Branch Wise Calender imported successfully.",
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

            return next(err);
        }
    };
}

export const branchWiseCalenderController = new BranchWiseCalenderController();