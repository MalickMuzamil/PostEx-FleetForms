import { logger } from "../loggers/winston.js";

export const notFound = (req, res) => {
    res.status(404).json({
        message: `Route not found: ${req.method} ${req.originalUrl}`,
    });
};

export const errorHandler = (err, req, res, next) => {
    logger.error(err);

    const status = err.statusCode || err.status || 500;

    res.status(status).json({
        message: err.message || "Internal Server Error",
        ...(process.env.NODE_ENV === "development" && err.stack ? { stack: err.stack } : {}),
    });
};