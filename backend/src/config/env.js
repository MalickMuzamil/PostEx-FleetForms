import dotenv from "dotenv";
dotenv.config();

export const env = {
    port: Number(process.env.PORT || 5000),
    nodeEnv: process.env.NODE_ENV || "development",
    corsOrigin: process.env.CORS_ORIGIN || "*",
    logLevel: process.env.LOG_LEVEL || "info",

    // SQL Server
    dbHost: process.env.DB_HOST,
    dbPort: Number(process.env.DB_PORT || 1433),
    dbUser: process.env.DB_USER,
    dbPassword: process.env.DB_PASSWORD,
    dbName: process.env.DB_NAME || "master",
    dbEncrypt: process.env.DB_ENCRYPT === "true",
    dbTrustCert: process.env.DB_TRUST_CERT === "true",
};