import { opsCncL4L5MappingService }
    from "../services/OpsCncL4L5MappingService.js";

class OpsCncL4L5MappingController {

    getAll = async (req, res, next) => {
        try {
            const data = await opsCncL4L5MappingService.getAll();
            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

    create = async (req, res, next) => {
        try {

            const { cncL4Id, cncL5Id, effectiveDate } = req.body;

            if (!cncL4Id || !cncL5Id || !effectiveDate) {
                return res.status(400).json({
                    message: "cncL4Id, cncL5Id and effectiveDate are required."
                });
            }

            const data =
                await opsCncL4L5MappingService.create({
                    cncL4Id,
                    cncL5Id,
                    effectiveDate
                });

            res.status(201).json({
                message: "CnC L4 L5 mapping created successfully.",
                data
            });

        } catch (err) {

            if (err?.code === "DUPLICATE_MAPPING")
                return res.status(409).json({
                    message: "Duplicate mapping for same CNC L4, CNC L5 and Effective Date not allowed."
                });

            if (err?.code === "MAX_LIMIT")
                return res.status(409).json({
                    message: "Only two effective dated records allowed for same CNC L4 and CNC L5."
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
                await opsCncL4L5MappingService.update(id, req.body);

            if (!data)
                return res.status(404).json({
                    message: "CnC L4 L5 mapping not found"
                });

            res.json({
                message: "CnC L4 L5 mapping updated successfully",
                data
            });

        } catch (err) {

            if (err?.code === "DUPLICATE_MAPPING")
                return res.status(409).json({
                    message: "Duplicate mapping for same CNC L4, CNC L5 and Effective Date not allowed."
                });

            if (err?.code === "MAX_LIMIT")
                return res.status(409).json({
                    message: "Only two effective dated records allowed for same CNC L4 and CNC L5."
                });

            if (err?.code === "INVALID_DATE_SEQUENCE")
                return res.status(400).json({
                    message: "Effective date must be greater than existing effective date."
                });

            next(err);
        }
    };

    getCnCL4List = async (req, res, next) => {
        try {
            const data = await opsCncL4L5MappingService.getCnCL4List();
            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

    getCnCL5List = async (req, res, next) => {
        try {
            const data = await opsCncL4L5MappingService.getCnCL5List();
            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

}

export const opsCncL4L5MappingController =
    new OpsCncL4L5MappingController();
