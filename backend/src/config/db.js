import { env } from "./env.js";

const baseConfig = {
  user: env.dbUser,
  password: env.dbPassword,
  server: env.dbHost,
  port: env.dbPort,
  options: {
    encrypt: env.dbEncrypt,
    trustServerCertificate: env.dbTrustCert,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

export const authDbConfig = {
  ...baseConfig,
  database: env.authDbName || "SecurityCatalog",
};

export const appDbConfig = {
  ...baseConfig,
  database: env.appDbName || "GoGreen",
};
