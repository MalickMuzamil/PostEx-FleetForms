import { opsCncL1BranchMappingService } from "../services/OpsCncL1BranchMappingService.js";

class OpsCncL1BranchMappingController {

    getAll = async (req, res, next) => {
        try {
            const data = await opsCncL1BranchMappingService.getAll();
            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

    create = async (req, res, next) => {
        try {
            const { branchId, cncL1Id, effectiveDate } = req.body;

            if (!branchId || !cncL1Id || !effectiveDate) {
                return res.status(400).json({
                    message: "branchId, cncL1Id and effectiveDate are required.",
                });
            }

            const data = await opsCncL1BranchMappingService.create({
                branchId,
                cncL1Id,
                effectiveDate,
            });

            return res.status(201).json({
                message: "CnC L1 Branch mapping created successfully.",
                data,
            });
        } catch (err) {

            if (err?.code === "DUPLICATE_MAPPING") {
                return res.status(409).json({
                    message: "Duplicate mapping for same Branch, CNC and Effective Date not allowed.",
                });
            }

            if (err?.code === "MAX_LIMIT") {
                return res.status(409).json({
                    message: "Only two effective dated records allowed for same Branch and CNC.",
                });
            }

            if (err?.code === "INVALID_DATE_SEQUENCE") {
                return res.status(400).json({
                    message: "Effective date must be greater than existing effective date.",
                });
            }

            next(err);
        }
    };

    update = async (req, res, next) => {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({ message: "id is required" });
            }

            const data = await opsCncL1BranchMappingService.update(id, req.body);

            if (!data) {
                return res.status(404).json({
                    message: "CnC L1 Branch mapping not found",
                });
            }

            return res.json({
                message: "CnC L1 Branch mapping updated successfully",
                data,
            });
        } catch (err) {

            if (err?.code === "DUPLICATE_MAPPING") {
                return res.status(409).json({
                    message: "Duplicate mapping for same Branch, CNC and Effective Date not allowed.",
                });
            }

            if (err?.code === "MAX_LIMIT") {
                return res.status(409).json({
                    message: "Only two effective dated records allowed for same Branch and CNC.",
                });
            }

            if (err?.code === "INVALID_DATE_SEQUENCE") {
                return res.status(400).json({
                    message: "Effective date must be greater than existing effective date.",
                });
            }

            next(err);
        }
    };

    getBranches = async (req, res, next) => {
        try {
            const data = await opsCncL1BranchMappingService.getBranches();
            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

    getCnCL1List = async (req, res, next) => {
        try {
            const data = await opsCncL1BranchMappingService.getCnCL1List();
            res.json({ data });
        } catch (err) {
            next(err);
        }
    };
}

export const opsCncL1BranchMappingController =
    new OpsCncL1BranchMappingController();
