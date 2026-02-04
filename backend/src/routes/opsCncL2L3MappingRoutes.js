import express from "express";
import { opsCncL2L3MappingController }
    from "../controllers/OpsCncL2L3MappingController.js";

const router = express.Router();

/* ===== CRUD ===== */

router.get("/", opsCncL2L3MappingController.getAll);
router.post("/", opsCncL2L3MappingController.create);
router.put("/:id", opsCncL2L3MappingController.update);

/* ===== DROPDOWNS ===== */

router.get("/cnc-l2", opsCncL2L3MappingController.getCnCL2List);
router.get("/cnc-l3", opsCncL2L3MappingController.getCnCL3List);

export default router;
