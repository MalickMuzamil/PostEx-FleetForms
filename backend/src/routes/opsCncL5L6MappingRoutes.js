import express from "express";
import { opsCncL5L6MappingController }
    from "../controllers/OpsCncL5L6MappingController.js";

const router = express.Router();

/* ===== CRUD ===== */

router.get("/", opsCncL5L6MappingController.getAll);
router.post("/", opsCncL5L6MappingController.create);
router.put("/:id", opsCncL5L6MappingController.update);

/* ===== DROPDOWNS ===== */

router.get("/cnc-l5", opsCncL5L6MappingController.getCnCL5List);
router.get("/cnc-l6", opsCncL5L6MappingController.getCnCL6List);

export default router;
