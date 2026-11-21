
import express from "express";

import { authorize } from "../middlewares/authorize.middleware.js";
import { validateBody } from "../middlewares/validateBody.middleware.js";
import { uploadCatalogFile } from "../middlewares/upload.middleware.js";

import { ROLES } from "../utils/enums.utils.js";

import {
    createPickingOrderSchema
} from "../validators/pickingOrder.validator.js";

import {
    createPickingOrderController,
    getPickingOrdersController,
    getMyPickingOrdersController,
    getPickingOrderDetailController
} from "../controllers/pickingOrder.controller.js";

import {
    importPickingOrderController,
    previewPickingOrderImportController
} from "../controllers/pickingOrderImport.controller.js";


const router = express.Router({ mergeParams: true });


// CU25: crear una orden manualmente
// Solo personal administrativo
router.post(
    "/",
    authorize(ROLES.ADMINISTRATIVE),
    validateBody(createPickingOrderSchema),
    createPickingOrderController
);


// CU25: vista previa del Excel antes de crear una orden
// Solo personal administrativo
// No guarda información ni modifica el stock
router.post(
    "/preview",
    authorize(ROLES.ADMINISTRATIVE),
    uploadCatalogFile,
    previewPickingOrderImportController
);


// CU25: importar una orden desde Excel o CSV
// Solo personal administrativo
router.post(
    "/import",
    authorize(ROLES.ADMINISTRATIVE),
    uploadCatalogFile,
    importPickingOrderController
);


// CU25: consultar las órdenes asignadas al operario
router.get(
    "/my-orders",
    authorize(ROLES.OPERATOR),
    getMyPickingOrdersController
);


// CU25: consultar todas las órdenes
// Solo personal administrativo
router.get(
    "/",
    authorize(ROLES.ADMINISTRATIVE),
    getPickingOrdersController
);


// CU25: consultar el detalle de una orden
// Personal administrativo u operario asignado
router.get(
    "/:pickingOrderId",
    authorize(ROLES.ADMINISTRATIVE, ROLES.OPERATOR),
    getPickingOrderDetailController
);


export default router;
