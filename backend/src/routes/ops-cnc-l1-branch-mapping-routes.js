import { Router } from "express";
import { opsCncL1BranchMappingController }
    from "../controllers/ops-cnc-l1-branch-mapping-controller.js";

const router = Router();

/* ========================
   Mapping CRUD
======================== */

router.get("/", opsCncL1BranchMappingController.getAll);

router.post("/", opsCncL1BranchMappingController.create);

router.put("/:id", opsCncL1BranchMappingController.update);

/* ========================
   Dropdown Data
======================== */

router.get("/branches", opsCncL1BranchMappingController.getBranches);

router.get("/cnc-l1", opsCncL1BranchMappingController.getCnCL1List);

export default router;
