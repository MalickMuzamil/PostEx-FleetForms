import sql from "mssql";
import { authDbConfig, appDbConfig, hrmDbConfig } from "./db.js";
import { logger } from "../loggers/winston.js";

let authPool;
let appPool;
let hrmPool;

// 🔐 Auth DB (SecurityCatalog)
export const getAuthPool = async () => {
  try {
    if (authPool) return authPool;

    authPool = await new sql.ConnectionPool(authDbConfig).connect();
    await authPool.request().query("SELECT DB_NAME() AS db");
    logger.info("✅ Auth DB connected");

    return authPool;
  } catch (error) {
    logger.error("❌ Auth DB connection failed");
    logger.error(error);
    authPool = null;
    throw error;
  }
};

// 📦 App DB (GoGreen)
export const getPool = async () => {
  try {
    if (appPool) return appPool;

    appPool = await new sql.ConnectionPool(appDbConfig).connect();
    await appPool.request().query("SELECT DB_NAME() AS db");
    logger.info("✅ App DB connected");

    return appPool;
  } catch (error) {
    logger.error("❌ App DB connection failed");
    logger.error(error);
    appPool = null;
    throw error;
  }
};

// 🏢 HRM DB
export const getHrmPool = async () => {
  try {
    if (hrmPool) return hrmPool;

    hrmPool = await new sql.ConnectionPool(hrmDbConfig).connect();
    await hrmPool.request().query("SELECT DB_NAME() AS db");
    logger.info("✅ HRM DB connected");

    return hrmPool;
  } catch (error) {
    logger.error("❌ HRM DB connection failed");
    logger.error(error);
    hrmPool = null;
    throw error;
  }
};
