import sql from "mssql";
import { authDbConfig, appDbConfig } from "./db.js";
import { logger } from "../loggers/winston.js";

let authPool;
let appPool;

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
