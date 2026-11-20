
import {
    createPickingOrder,
    getPickingOrders,
    getMyPickingOrders,
    getPickingOrderDetail
} from "../services/pickingOrder.service.js";


// CU25: crear una orden de trabajo de picking o reposición
export const createPickingOrderController = async (req, res, next) => {
    try {
        const pickingOrder = await createPickingOrder(
            { ...req.body, source: "manual" },
            req.user.userId
        );

        return res.status(201).json({
            message: "Orden de trabajo creada correctamente",
            data: pickingOrder
        });

    } catch (error) {
        next(error);
    }
};


// CU25: consultar las órdenes de trabajo creadas
// Permite filtrar por planta
export const getPickingOrdersController = async (req, res, next) => {
    try {
        const pickingOrders = await getPickingOrders(
            req.query.warehouse
        );

        return res.status(200).json({
            message: "Órdenes de trabajo obtenidas correctamente",
            data: pickingOrders
        });

    } catch (error) {
        next(error);
    }
};


// CU25: consultar las órdenes asignadas al operario autenticado
export const getMyPickingOrdersController = async (req, res, next) => {
    try {
        const pickingOrders = await getMyPickingOrders(
            req.user.userId
        );

        return res.status(200).json({
            message: "Órdenes asignadas obtenidas correctamente",
            data: pickingOrders
        });

    } catch (error) {
        next(error);
    }
};


// CU25: consultar el detalle de una orden de trabajo
export const getPickingOrderDetailController = async (req, res, next) => {
    try {
        const pickingOrder = await getPickingOrderDetail(
            req.params.pickingOrderId,
            req.user
        );

        return res.status(200).json({
            message: "Detalle de la orden obtenido correctamente",
            data: pickingOrder
        });

    } catch (error) {
        next(error);
    }
};
