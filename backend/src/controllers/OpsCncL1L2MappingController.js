import { opsCncL1L2MappingService }
    from "../services/OpsCncL1L2MappingService.js";

class OpsCncL1L2MappingController {

    getAll = async (req, res, next) => {
        try {
            const data = await opsCncL1L2MappingService.getAll();
            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

    create = async (req, res, next) => {
        try {
            const { cncL1Id, cncL2Id, effectiveDate } = req.body;

            if (!cncL1Id || !cncL2Id || !effectiveDate) {
                return res.status(400).json({
                    message: "cncL1Id, cncL2Id and effectiveDate are required."
                });
            }

            const data =
                await opsCncL1L2MappingService.create({
                    cncL1Id,
                    cncL2Id,
                    effectiveDate
                });

            res.status(201).json({
                message: "CnC L1 L2 mapping created successfully.",
                data
            });

        } catch (err) {

            if (err?.code === "DUPLICATE_MAPPING")
                return res.status(409).json({
                    message: "Duplicate mapping for same CNC L1, CNC L2 and Effective Date not allowed."
                });

            if (err?.code === "MAX_LIMIT")
                return res.status(409).json({
                    message: "Only two effective dated records allowed for same CNC L1 and CNC L2."
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
                await opsCncL1L2MappingService.update(id, req.body);

            if (!data)
                return res.status(404).json({
                    message: "CnC L1 L2 mapping not found"
                });

            res.json({
                message: "CnC L1 L2 mapping updated successfully",
                data
            });

        } catch (err) {

            if (err?.code === "DUPLICATE_MAPPING")
                return res.status(409).json({
                    message: "Duplicate mapping for same CNC L1, CNC L2 and Effective Date not allowed."
                });

            if (err?.code === "MAX_LIMIT")
                return res.status(409).json({
                    message: "Only two effective dated records allowed for same CNC L1 and CNC L2."
                });

            if (err?.code === "INVALID_DATE_SEQUENCE")
                return res.status(400).json({
                    message: "Effective date must be greater than existing effective date."
                });

            next(err);
        }
    };

    getCnCL1List = async (req, res, next) => {
        try {
            const data = await opsCncL1L2MappingService.getCnCL1List();
            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

    getCnCL2List = async (req, res, next) => {
        try {
            const data = await opsCncL1L2MappingService.getCnCL2List();
            res.json({ data });
        } catch (err) {
            next(err);
        }
    };

}

export const opsCncL1L2MappingController =
    new OpsCncL1L2MappingController();
