import express from "express";
import { opsCncL1L2MappingController }
    from "../controllers/OpsCncL1L2MappingController.js";

const router = express.Router();

/* ============================
   CRUD – Mapping
============================ */

router.get(
    "/",
    opsCncL1L2MappingController.getAll
);

router.post(
    "/",
    opsCncL1L2MappingController.create
);

router.put(
    "/:id",
    opsCncL1L2MappingController.update
);

/* ============================
   DROPDOWNS
============================ */

router.get(
    "/cnc-l1",
    opsCncL1L2MappingController.getCnCL1List
);

router.get(
    "/cnc-l2",
    opsCncL1L2MappingController.getCnCL2List
);

export default router;
