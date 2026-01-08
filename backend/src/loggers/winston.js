import winston from "winston";
import { env } from "../config/env.js";

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack }) =>
    stack ? `${timestamp} [${level}]: ${stack}` : `${timestamp} [${level}]: ${message}`
);

export const logger = winston.createLogger({
    level: env.logLevel,
    format: combine(
        timestamp(),
        errors({ stack: true }),
        env.nodeEnv === "development" ? colorize() : winston.format.uncolorize(),
        logFormat
    ),
    transports: [new winston.transports.Console()],
});
