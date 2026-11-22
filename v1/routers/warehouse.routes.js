import express from "express";
import { authorize } from "../middlewares/authorize.middleware.js";
import { createWarehouse, getWarehouse, listWarehouses, updateWarehouse, addStockLocationToElement, removeStockLocationToElement} from "../controllers/warehouse.controller.js";
import { getWarehouseOccupancy, getProductStockSummary, getWarehouseStockSummary  } from "../controllers/stockLocation.controller.js";
import warehouseElementRouter from "./warehouseElement.routes.js";
import { ROLES } from "../utils/enums.utils.js";

const router = express.Router({ mergeParams: true });

router.get("/", listWarehouses);
router.get("/:id", getWarehouse);
router.get("/:id/occupancy", getWarehouseOccupancy);
router.get("/:id/products/:productId/stock", authorize(ROLES.ADMINISTRATIVE), getProductStockSummary);
router.get("/:id/stock-summary", authorize(ROLES.ADMINISTRATIVE), getWarehouseStockSummary);
router.post("/", authorize(ROLES.ADMINISTRATIVE), createWarehouse);
router.put("/:id", authorize(ROLES.ADMINISTRATIVE), updateWarehouse);
router.use("/:id/elements", warehouseElementRouter);
router.post("/:warehouseId/elements/:elementId/add", addStockLocationToElement);
router.post("/:warehouseId/elements/:elementId/remove", removeStockLocationToElement);

export default router;
