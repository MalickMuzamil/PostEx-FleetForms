import { opsCncL5L6MappingService }
    from "../services/OpsCncL5L6MappingService.js";

class OpsCncL5L6MappingController {

    getAll = async (req, res, next) => {
        try {
            const data = await opsCncL5L6MappingService.getAll();
            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

    create = async (req, res, next) => {
        try {

            const { cncL5Id, cncL6Id, effectiveDate } = req.body;

            if (!cncL5Id || !cncL6Id || !effectiveDate) {
                return res.status(400).json({
                    message: "cncL5Id, cncL6Id and effectiveDate are required."
                });
            }

            const data =
                await opsCncL5L6MappingService.create({
                    cncL5Id,
                    cncL6Id,
                    effectiveDate
                });

            res.status(201).json({
                message: "CnC L5 L6 mapping created successfully.",
                data
            });

        } catch (err) {

            if (err?.code === "DUPLICATE_MAPPING")
                return res.status(409).json({
                    message: "Duplicate mapping for same CNC L5, CNC L6 and Effective Date not allowed."
                });

            if (err?.code === "MAX_LIMIT")
                return res.status(409).json({
                    message: "Only two effective dated records allowed for same CNC L5 and CNC L6."
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
                await opsCncL5L6MappingService.update(id, req.body);

            if (!data)
                return res.status(404).json({
                    message: "CnC L5 L6 mapping not found"
                });

            res.json({
                message: "CnC L5 L6 mapping updated successfully",
                data
            });

        } catch (err) {

            if (err?.code === "DUPLICATE_MAPPING")
                return res.status(409).json({
                    message: "Duplicate mapping for same CNC L5, CNC L6 and Effective Date not allowed."
                });

            if (err?.code === "MAX_LIMIT")
                return res.status(409).json({
                    message: "Only two effective dated records allowed for same CNC L5 and CNC L6."
                });

            if (err?.code === "INVALID_DATE_SEQUENCE")
                return res.status(400).json({
                    message: "Effective date must be greater than existing effective date."
                });

            next(err);
        }
    };

    getCnCL5List = async (req, res, next) => {
        try {
            const data = await opsCncL5L6MappingService.getCnCL5List();
            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

    getCnCL6List = async (req, res, next) => {
        try {
            const data = await opsCncL5L6MappingService.getCnCL6List();
            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

}

export const opsCncL5L6MappingController =
    new OpsCncL5L6MappingController();
