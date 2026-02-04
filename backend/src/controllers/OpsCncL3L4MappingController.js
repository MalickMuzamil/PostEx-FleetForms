import { opsCncL3L4MappingService }
    from "../services/OpsCncL3L4MappingService.js";

class OpsCncL3L4MappingController {

    getAll = async (req, res, next) => {
        try {
            const data = await opsCncL3L4MappingService.getAll();
            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

    create = async (req, res, next) => {
        try {

            const { cncL3Id, cncL4Id, effectiveDate } = req.body;

            if (!cncL3Id || !cncL4Id || !effectiveDate) {
                return res.status(400).json({
                    message: "cncL3Id, cncL4Id and effectiveDate are required."
                });
            }

            const data =
                await opsCncL3L4MappingService.create({
                    cncL3Id,
                    cncL4Id,
                    effectiveDate
                });

            res.status(201).json({
                message: "CnC L3 L4 mapping created successfully.",
                data
            });

        } catch (err) {

            if (err?.code === "DUPLICATE_MAPPING")
                return res.status(409).json({
                    message: "Duplicate mapping for same CNC L3, CNC L4 and Effective Date not allowed."
                });

            if (err?.code === "MAX_LIMIT")
                return res.status(409).json({
                    message: "Only two effective dated records allowed for same CNC L3 and CNC L4."
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
                await opsCncL3L4MappingService.update(id, req.body);

            if (!data)
                return res.status(404).json({
                    message: "CnC L3 L4 mapping not found"
                });

            res.json({
                message: "CnC L3 L4 mapping updated successfully",
                data
            });

        } catch (err) {

            if (err?.code === "DUPLICATE_MAPPING")
                return res.status(409).json({
                    message: "Duplicate mapping for same CNC L3, CNC L4 and Effective Date not allowed."
                });

            if (err?.code === "MAX_LIMIT")
                return res.status(409).json({
                    message: "Only two effective dated records allowed for same CNC L3 and CNC L4."
                });

            if (err?.code === "INVALID_DATE_SEQUENCE")
                return res.status(400).json({
                    message: "Effective date must be greater than existing effective date."
                });

            next(err);
        }
    };

    getCnCL3List = async (req, res, next) => {
        try {
            const data = await opsCncL3L4MappingService.getCnCL3List();
            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

    getCnCL4List = async (req, res, next) => {
        try {
            const data = await opsCncL3L4MappingService.getCnCL4List();
            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

}

export const opsCncL3L4MappingController =
    new OpsCncL3L4MappingController();
