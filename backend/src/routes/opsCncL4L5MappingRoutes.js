import express from "express";
import { opsCncL4L5MappingController }
    from "../controllers/OpsCncL4L5MappingController.js";

const router = express.Router();

/* ===== CRUD ===== */

router.get("/", opsCncL4L5MappingController.getAll);
router.post("/", opsCncL4L5MappingController.create);
router.put("/:id", opsCncL4L5MappingController.update);

/* ===== DROPDOWNS ===== */

router.get("/cnc-l4", opsCncL4L5MappingController.getCnCL4List);
router.get("/cnc-l5", opsCncL4L5MappingController.getCnCL5List);

export default router;