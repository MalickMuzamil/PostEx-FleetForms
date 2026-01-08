import { Router } from "express";
import { branchGeneralEmpBindingController } from "../controllers/branch-general-emp-binding-controller.js";

const router = Router();

// ✅ Lookups
router.get("/employees/active", (req, res, next) =>
    branchGeneralEmpBindingController.listActiveEmployees(req, res, next)
);

router.get("/branches", (req, res, next) =>
    branchGeneralEmpBindingController.listBranches(req, res, next)
);

// ✅ Bindings CRUD
router.get("/", (req, res, next) =>
    branchGeneralEmpBindingController.listBindings(req, res, next)
);

router.post("/", (req, res, next) =>
    branchGeneralEmpBindingController.create(req, res, next)
);

router.put("/:id", (req, res, next) =>
    branchGeneralEmpBindingController.update(req, res, next)
);

router.delete("/:id", (req, res, next) =>
    branchGeneralEmpBindingController.remove(req, res, next)
);

export default router;
