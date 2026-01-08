import sql from "mssql";
import { dbConfig } from "./db.js";
import { logger } from "../loggers/winston.js";

let pool;

export const getPool = async () => {
  try {
    if (pool) return pool;

    pool = await sql.connect(dbConfig);

    // quick test
    await pool.request().query("SELECT 1 AS ok");
    logger.info("✅ SQL Server connected");

    return pool;
  } catch (error) {
    logger.error("❌ SQL Server connection failed");
    logger.error(error);
    pool = null;
    throw error;
  }
};
