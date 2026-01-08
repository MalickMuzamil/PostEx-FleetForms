import { env } from "./env.js";

export const dbConfig = {
  user: env.dbUser,
  password: env.dbPassword,
  server: env.dbHost,
  port: env.dbPort,
  database: env.dbName,
  options: {
    encrypt: env.dbEncrypt,                 // cloud = true, local LAN = false
    trustServerCertificate: env.dbTrustCert // LAN/IP setups me true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};
