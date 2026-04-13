import { courierFakeAttemptsService } from "../services/courier-fake-attempts-service.js";

class CourierFakeAttemptsController {
    getAll = async (req, res, next) => {
        try {
            const top = req.query?.top;
            const data = await courierFakeAttemptsService.list({ top });
            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

    validateBulk = async (req, res, next) => {
        try {
            const payloads = req.body?.payloads ?? [];
            const data = await courierFakeAttemptsService.validateBulk(payloads);
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

            const data = await courierFakeAttemptsService.bulkImport({ payloads });

            return res.status(201).json({
                message: "Courier Fake Attempts imported successfully.",
                data,
            });
        } catch (err) {
            console.error("BULK IMPORT ERROR DETAILS:", JSON.stringify({
                message: err?.message,
                code: err?.code,
                number: err?.number,
                state: err?.state,
                class: err?.class,
                originalError: err?.originalError?.message,
                precedingErrors: err?.precedingErrors?.map(e => e?.message),
            }, null, 2));

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

    delete = async (req, res, next) => {
        try {
            const { cnNo, date, courierId } = req.body;
            const data = await courierFakeAttemptsService.delete({ cnNo, date, courierId });
            res.json({ data });
        } catch (err) {
            if (err?.code === "VALIDATION_ERROR") {
                return res.status(400).json({ message: err.message || "Validation error." });
            }
            next(err);
        }
    };
}

export const courierFakeAttemptsController = new CourierFakeAttemptsController();