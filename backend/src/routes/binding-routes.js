import { Router } from "express";
import { bindingController } from "../controllers/binding-controller.js";

const router = Router();

router.get("/employees/active", bindingController.getActiveEmployees);
router.get("/branches", bindingController.getBranches);

router.get("/", bindingController.getAllBindings);
router.get("/search", bindingController.searchBindings);

router.post("/", bindingController.createBinding);

router.delete("/:id", bindingController.deleteBinding);
router.put("/:id", bindingController.updateBinding);

export default router;