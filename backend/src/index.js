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

//CNC Forms
import cnclevel1 from './routes/cnc-l1-definition-routes.js';
import cncL2 from "./routes/cnc-l2-definition-routes.js";
import cncL3 from "./routes/cnc-l3-definition-routes.js";
import cncL4 from "./routes/cnc-l4-definition-routes.js";
import cncL5 from "./routes/cnc-l5-definition-routes.js";
import cncL6 from "./routes/cnc-l6-definition-routes.js";

//CNC Binding Forms
import Bindingcnclevel1 from './routes/ops-cnc-l1-branch-mapping-routes.js';
import Bindingcnclevel1level2 from './routes/opsCncL1L2MappingRoutes.js';
import Bindingcnclevel2level3 from './routes/opsCncL2L3MappingRoutes.js';
import Bindingcnclevel3level4 from './routes/opsCncL3L4MappingRoutes.js';
import Bindingcnclevel4level5 from './routes/opsCncL4L5MappingRoutes.js';
import Bindingcnclevel5level6 from './routes/opsCncL5L6MappingRoutes.js';


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
app.use("/cnc-level5", cncL5);
app.use("/cnc-level6", cncL6);

app.use("/cnc-l1-branch-mapping", Bindingcnclevel1);
app.use("/cnc-l1-l2-mapping", Bindingcnclevel1level2);
app.use("/cnc-l2-l3-mapping", Bindingcnclevel2level3);
app.use("/cnc-l3-l4-mapping", Bindingcnclevel3level4);
app.use("/cnc-l4-l5-mapping", Bindingcnclevel4level5);
app.use("/cnc-l5-l6-mapping", Bindingcnclevel5level6);


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
