import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";

import { logger } from "./loggers/winston.js";
import { errorHandler } from "./middleware/error-middleware.js";
import { getPool } from "./config/sql-config.js";
import authRoutes from "./routes/auth-routes.js";

// import employeesRoutes from "./routes/employees.routes.js";
// import branchesRoutes from "./routes/branches.routes.js";
import bindingRoutes from "./routes/binding-routes.js";
import branchGeneralEmpBindingRoutes from "./routes/branch-general-emp-binding-routes.js";
import branchDashboardBindingRoutes from "./routes/binding-dashboard-routes.js";
import subBranchRoutes from "./routes/sub-branch-definition-routes.js";
import deliveryRouteRoutes from "./routes/delivery-route-definition-routes.js";
import deliveryRouteBindingRoutes from "./routes/delivery-route-binding-routes.js";
import branchesRoutes from "./routes/branches-routes.js";
import subBranchAssignmentDefinitionRoute from "./routes/sub-branch-assignment-definition-routes.js";
import cnclevel1 from './routes/cnc-l1-definition-routes.js';
import cncL2 from "./routes/cnc-l2-definition-routes.js";
import cncL3 from "./routes/cnc-l3-definition-routes.js";
import cncL4 from "./routes/cnc-l4-definition-routes.js"

dotenv.config();

const app = express();

// security + basics
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "1mb" }));

// rate limit
app.use(
    rateLimit({
        windowMs: 60 * 1000,
        limit: 120,
        standardHeaders: true,
        legacyHeaders: false,
    })
);

// logs
app.use(
    morgan("dev", {
        stream: { write: (message) => logger.info(message.trim()) },
    })
);

// health
app.get("/health", (req, res) => res.json({ ok: true }));

// routes
app.use("/auth", authRoutes);
app.use("/bindings", bindingRoutes);
app.use("/branch-general-emp-binding", branchGeneralEmpBindingRoutes);
app.use("/branch-dashboard-binding", branchDashboardBindingRoutes);
app.use("/sub-branches", subBranchRoutes);
app.use("/delivery-routes", deliveryRouteRoutes);
app.use("/delivery-route-bindings", deliveryRouteBindingRoutes);
app.use("/branches", branchesRoutes);
app.use("/sub-branch-assignment-definition", subBranchAssignmentDefinitionRoute);
app.use("/cnc-level1", cnclevel1);
app.use("/cnc-level2", cncL2);
app.use("/cnc-level3", cncL3);
app.use("/cnc-level4", cncL4);


// error handler (last)
app.use(errorHandler);

const PORT = Number(process.env.PORT || 5000);

// start after DB connect
(async () => {
    try {
        await getPool();
        logger.info("✅ MSSQL connected");

        app.listen(PORT, () => {
            logger.info(`🚀 Server running on port ${PORT}`);
        });
    } catch (err) {
        logger.error("❌ DB connection failed");
        logger.error(err);
        process.exit(1);
    }
})();
