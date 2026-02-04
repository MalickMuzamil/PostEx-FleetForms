import express from "express";
import { opsCncL3L4MappingController }
    from "../controllers/OpsCncL3L4MappingController.js";

const router = express.Router();

/* ===== CRUD ===== */

router.get("/", opsCncL3L4MappingController.getAll);
router.post("/", opsCncL3L4MappingController.create);
router.put("/:id", opsCncL3L4MappingController.update);

/* ===== DROPDOWNS ===== */

router.get("/cnc-l3", opsCncL3L4MappingController.getCnCL3List);
router.get("/cnc-l4", opsCncL3L4MappingController.getCnCL4List);

export default router;
