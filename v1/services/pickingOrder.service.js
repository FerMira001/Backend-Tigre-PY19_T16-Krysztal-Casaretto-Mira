
import mongoose from "mongoose";
import PickingOrder from "../models/pickingOrder.model.js";
import Product from "../models/product.model.js";
import Usuario from "../models/usuario.model.js";
import Warehouse from "../models/warehouse.model.js";
import { ROLES } from "../utils/enums.utils.js";
import { createError } from "../utils/error.utils.js";
import { pickingOrderExcelRowSchema } from "../validators/pickingOrder.validator.js";


// CU25: crear una orden de trabajo de picking o reposición
// Esta función será utilizada tanto por la carga manual como por la importación desde Excel
export const createPickingOrder = async (data, createdBy) => {

    const { warehouse, operationType, items, assignedOperators, source = "manual", sapReference = null } = data;

    // Verificar que se hayan seleccionado productos y operarios
    if (
        !Array.isArray(items) || items.length === 0 ||
        !Array.isArray(assignedOperators) || assignedOperators.length === 0
    ) {
        throw createError(400, "Debe seleccionar al menos un producto y un operario");
    }

    // Validar los identificadores
    const productIds = items.map((item) => item.product);
    const allIds = [warehouse, createdBy, ...productIds, ...assignedOperators];

    if (allIds.some((id) => !mongoose.isValidObjectId(id))) {
        throw createError(400, "Alguno de los identificadores no es válido");
    }

    // Validar las cantidades
    const invalidQuantity = items.some(
        (item) => !Number.isInteger(item.quantity) || item.quantity <= 0
    );

    if (invalidQuantity) {
        throw createError(400, "Las cantidades deben ser números enteros mayores a cero");
    }

    // No permitir productos repetidos
    if (new Set(productIds.map(String)).size !== productIds.length) {
        throw createError(400, "No se puede repetir un producto en la misma orden");
    }

    // No permitir operarios repetidos
    if (new Set(assignedOperators.map(String)).size !== assignedOperators.length) {
        throw createError(400, "No se puede asignar el mismo operario más de una vez");
    }

    // Verificar que la planta exista
    const warehouseExists = await Warehouse.exists({ _id: warehouse });

    if (!warehouseExists) {
        throw createError(404, "La planta no existe");
    }

    // Verificar que todos los productos existan en el catálogo
    const productCount = await Product.countDocuments({
        _id: { $in: productIds }
    });

    if (productCount !== productIds.length) {
        throw createError(400, "Alguno de los productos seleccionados no existe");
    }

    // Verificar que el creador sea un usuario administrativo
    const administrative = await Usuario.exists({
        _id: createdBy,
        rol: ROLES.ADMINISTRATIVE
    });

    if (!administrative) {
        throw createError(403, "Solo un usuario administrativo puede crear órdenes de trabajo");
    }

    // Verificar que todos los usuarios asignados sean operarios
    const operators = await Usuario.find({
        _id: { $in: assignedOperators },
        rol: ROLES.OPERATOR
    }).select("warehouses");

    if (operators.length !== assignedOperators.length) {
        throw createError(400, "Todos los usuarios asignados deben ser operarios existentes");
    }

    // Verificar que los operarios tengan asignada la planta
    const invalidWarehouse = operators.some(
        (operator) => !operator.warehouses.some(
            (id) => String(id) === String(warehouse)
        )
    );

    if (invalidWarehouse) {
        throw createError(400, "Algún operario no tiene asignada esta planta");
    }

    // Crear la orden de trabajo
    // No se modifica el stock en esta etapa
    const pickingOrder = await PickingOrder.create({
        warehouse,
        operationType,
        items,
        assignedOperators,
        createdBy,
        source,
        sapReference,
        status: "pending"
    });

    return pickingOrder;
};


// CU25: preparar los productos de una orden importada desde Excel
// Se reciben filas con código SAP, descripción opcional y cantidad
export const resolvePickingOrderExcelItems = async (rows) => {

    if (!Array.isArray(rows) || rows.length === 0) {
        throw createError(400, "El archivo debe contener al menos un producto");
    }

    // Validar cada fila utilizando el esquema de Joi
    const validatedRows = rows.map((row, index) => {

        const { value, error } = pickingOrderExcelRowSchema.validate(row, {
            abortEarly: false
        });

        if (error) {
            throw createError(
                400,
                `Error en la fila ${index + 2}: ${error.details.map((detail) => detail.message).join("; ")}`
            );
        }

        return value;
    });

    const sapCodes = validatedRows.map((row) => row.sapCode);

    // No permitir códigos SAP repetidos en la misma orden
    if (new Set(sapCodes).size !== sapCodes.length) {
        throw createError(400, "El archivo contiene códigos SAP repetidos");
    }

    // Buscar los productos existentes por su código SAP
    const products = await Product.find({
        sapCode: { $in: sapCodes }
    }).select("_id sapCode");

    const productsBySapCode = new Map(
        products.map((product) => [product.sapCode, product._id])
    );

    // Identificar productos que no existen en el catálogo
    const missingProducts = sapCodes.filter(
        (sapCode) => !productsBySapCode.has(sapCode)
    );

    if (missingProducts.length > 0) {
        throw createError(
            400,
            `Los siguientes productos no existen en el catálogo: ${missingProducts.join(", ")}`
        );
    }

    // Convertir las filas del Excel al formato utilizado por la creación manual
    return validatedRows.map((row) => ({
        product: productsBySapCode.get(row.sapCode),
        quantity: row.quantity
    }));
};


// CU25: consultar todas las órdenes de trabajo
// Se pueden filtrar por planta
export const getPickingOrders = async (warehouseId = null) => {

    const filter = {};

    if (warehouseId) {
        if (!mongoose.isValidObjectId(warehouseId)) {
            throw createError(400, "El identificador de la planta no es válido");
        }

        filter.warehouse = warehouseId;
    }

    return PickingOrder.find(filter)
        .populate("warehouse", "name")
        .populate("items.product", "sapCode description")
        .populate("assignedOperators", "nombreUsuario email")
        .populate("createdBy", "nombreUsuario")
        .sort({ createdAt: -1 });
};


// CU25: consultar las órdenes asignadas a un operario
export const getMyPickingOrders = async (userId) => {

    if (!mongoose.isValidObjectId(userId)) {
        throw createError(400, "El identificador del usuario no es válido");
    }

    return PickingOrder.find({
        assignedOperators: userId
    })
        .populate("warehouse", "name")
        .populate("items.product", "sapCode description")
        .sort({ createdAt: -1 });
};


// CU25: consultar el detalle de una orden de trabajo
export const getPickingOrderDetail = async (pickingOrderId, user) => {

    if (!mongoose.isValidObjectId(pickingOrderId)) {
        throw createError(400, "El identificador de la orden no es válido");
    }

    const pickingOrder = await PickingOrder.findById(pickingOrderId)
        .populate("warehouse", "name")
        .populate("items.product", "sapCode description")
        .populate("assignedOperators", "nombreUsuario email")
        .populate("createdBy", "nombreUsuario");

    if (!pickingOrder) {
        throw createError(404, "Orden de trabajo no encontrada");
    }

    // Los operarios solamente pueden consultar las órdenes que tienen asignadas
    if (user.rol !== ROLES.ADMINISTRATIVE) {

        const assigned = pickingOrder.assignedOperators.some(
            (operator) => String(operator._id) === String(user.userId)
        );

        if (!assigned) {
            throw createError(403, "No tenés permisos para consultar esta orden");
        }
    }

    return pickingOrder;
};
