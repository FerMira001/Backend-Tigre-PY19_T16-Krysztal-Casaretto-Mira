
import express from "express";
import { authorize } from "../middlewares/authorize.middleware.js";
import { validateBody } from "../middlewares/validateBody.middleware.js";
import { uploadCatalogFile } from "../middlewares/upload.middleware.js";
import { ROLES } from "../utils/enums.utils.js";
import { createPickingOrderSchema } from "../validators/pickingOrder.validator.js";

import {
    createPickingOrderController,
    getPickingOrdersController,
    getMyPickingOrdersController,
    getPickingOrderDetailController
} from "../controllers/pickingOrder.controller.js";

import {
    importPickingOrderController
} from "../controllers/pickingOrderImport.controller.js";

const router = express.Router({ mergeParams: true });


// CU25: crear una orden de trabajo de picking o reposición manualmente
router.post(
    "/",
    authorize(ROLES.ADMINISTRATIVE),
    validateBody(createPickingOrderSchema),
    createPickingOrderController
);


// CU25: importar una orden de picking o reposición desde Excel o CSV
router.post(
    "/import",
    authorize(ROLES.ADMINISTRATIVE),
    uploadCatalogFile,
    importPickingOrderController
);


// CU25: consultar las órdenes asignadas al operario autenticado
router.get(
    "/my-orders",
    authorize(ROLES.OPERATOR),
    getMyPickingOrdersController
);


// CU25: consultar todas las órdenes de trabajo
router.get(
    "/",
    authorize(ROLES.ADMINISTRATIVE),
    getPickingOrdersController
);


// CU25: consultar el detalle de una orden de trabajo
router.get(
    "/:pickingOrderId",
    authorize(ROLES.ADMINISTRATIVE, ROLES.OPERATOR),
    getPickingOrderDetailController
);


export default router;
