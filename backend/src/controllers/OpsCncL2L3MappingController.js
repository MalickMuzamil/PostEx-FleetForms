import { opsCncL2L3MappingService } from "../services/OpsCncL2L3MappingService.js";

class OpsCncL2L3MappingController {

    getAll = async (req, res, next) => {
        try {
            const data = await opsCncL2L3MappingService.getAll();
            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

    create = async (req, res, next) => {
        try {

            const { cncL2Id, cncL3Id, effectiveDate } = req.body;

            if (!cncL2Id || !cncL3Id || !effectiveDate) {
                return res.status(400).json({
                    message: "cncL2Id, cncL3Id and effectiveDate are required."
                });
            }

            const data =
                await opsCncL2L3MappingService.create({
                    cncL2Id,
                    cncL3Id,
                    effectiveDate
                });

            res.status(201).json({
                message: "CnC L2 L3 mapping created successfully.",
                data
            });

        } catch (err) {

            if (err?.code === "DUPLICATE_MAPPING")
                return res.status(409).json({
                    message: "Duplicate mapping for same CNC L2, CNC L3 and Effective Date not allowed."
                });

            if (err?.code === "MAX_LIMIT")
                return res.status(409).json({
                    message: "Only two effective dated records allowed for same CNC L2 and CNC L3."
                });

            if (err?.code === "INVALID_DATE_SEQUENCE")
                return res.status(400).json({
                    message: "Effective date must be greater than existing effective date."
                });

            next(err);
        }
    };

    update = async (req, res, next) => {
        try {

            const { id } = req.params;

            if (!id)
                return res.status(400).json({ message: "id is required" });

            const data =
                await opsCncL2L3MappingService.update(id, req.body);

            if (!data)
                return res.status(404).json({
                    message: "CnC L2 L3 mapping not found"
                });

            res.json({
                message: "CnC L2 L3 mapping updated successfully",
                data
            });

        } catch (err) {

            if (err?.code === "DUPLICATE_MAPPING")
                return res.status(409).json({
                    message: "Duplicate mapping for same CNC L2, CNC L3 and Effective Date not allowed."
                });

            if (err?.code === "MAX_LIMIT")
                return res.status(409).json({
                    message: "Only two effective dated records allowed for same CNC L2 and CNC L3."
                });

            if (err?.code === "INVALID_DATE_SEQUENCE")
                return res.status(400).json({
                    message: "Effective date must be greater than existing effective date."
                });

            next(err);
        }
    };

    getCnCL2List = async (req, res, next) => {
        try {
            const data = await opsCncL2L3MappingService.getCnCL2List();
            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

    getCnCL3List = async (req, res, next) => {
        try {
            const data = await opsCncL2L3MappingService.getCnCL3List();
            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

}

export const opsCncL2L3MappingController =
    new OpsCncL2L3MappingController();