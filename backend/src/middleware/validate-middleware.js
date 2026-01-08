export const validateBody = (schemaFn) => (req, res, next) => {
    try {
        const error = schemaFn(req.body);
        if (error) {
            const err = new Error(error);
            err.statusCode = 400;
            throw err;
        }
        next();
    } catch (e) {
        next(e);
    }
};
