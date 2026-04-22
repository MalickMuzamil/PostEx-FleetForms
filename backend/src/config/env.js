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

    // ✅ Separate DB names
    appDbName: process.env.APP_DB_NAME || "GoGreen",
    authDbName: process.env.AUTH_DB_NAME || "SecurityCatalog",
    hrmDbName: process.env.HRM_DB_NAME || "HRM",

    // ⏱️ Timeouts (in milliseconds)
    dbRequestTimeout: Number(process.env.DB_REQUEST_TIMEOUT || 300000), // 5 min - for bulk operations
    dbConnectionTimeout: Number(process.env.DB_CONNECTION_TIMEOUT || 60000), // 1 min - connection establishment

    dbEncrypt: process.env.DB_ENCRYPT === "true",
    dbTrustCert: process.env.DB_TRUST_CERT === "true",
};