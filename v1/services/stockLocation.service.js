
import mongoose from "mongoose";
import StockLocation from "../models/stockLocation.model.js";
import Warehouse from "../models/warehouse.model.js";
import Product from "../models/product.model.js";
import { ELEMENT_TYPES } from "../utils/enums.utils.js";
import { createError } from "../utils/error.utils.js";

export const getProductStockLocations = async (warehouseId, productId) => {

    // Buscar la planta
    const warehouse = await Warehouse.findById(warehouseId);

    if (!warehouse) {
        throw createError(404, "Planta no encontrada");
    }

    // Buscar todas las ubicaciones registradas para el producto
    const stock = await StockLocation.find({
        warehouse: warehouseId,
        product: productId
    });

    return stock.map((item) => {

        // Obtener la estantería o zona de piso
        const element = warehouse.elements.id(item.elementId);

        if (!element) {
            throw createError(409, "La ubicación registrada ya no existe");
        }

        let locationName = element.name;

        // Si es una posición de estantería, buscar su nivel
        if (item.positionId) {

            const level = element.levels?.find(
                (level) => level.positions.id(item.positionId)
            );

            const position = level?.positions.id(item.positionId);

            if (!position) {
                throw createError(409, "La posición registrada ya no existe");
            }

            locationName = `${element.name} - ${level.label} - ${position.label}`;
        }

        return {
            stockLocationId: item._id,
            product: item.product,
            elementId: item.elementId,
            positionId: item.positionId,
            location: locationName,
            quantity: item.quantity
        };
    });
};

// RN37: una posición está ocupada si tiene al menos un producto con stock
const withStock = (warehouseId) => ({ warehouse: warehouseId, quantity: { $gt: 0 } });

const countActivePositions = (element) =>
    (element.levels ?? []).reduce((total, level) => total + level.positions.filter((position) => position.active).length, 0);

const loadElements = async (warehouseId) => {
    const warehouse = await Warehouse.findById(warehouseId).select("elements");
    if (!warehouse) throw createError(404, "Planta no encontrada");
    return warehouse.elements;
};

// CU03 paso 5: posiciones ocupadas y productos de cada estantería o zona de piso.
// El acceso del usuario a la planta se valida antes, en el service de plantas
export const getWarehouseOccupancy = async (warehouseId) => {
    const elements = await loadElements(warehouseId);
    const groups = await StockLocation.aggregate([
        { $match: withStock(new mongoose.Types.ObjectId(String(warehouseId))) },
        { $group: { _id: "$elementId", positions: { $addToSet: "$positionId" }, products: { $addToSet: "$product" } } },
    ]);
    const byElement = new Map(groups.map((group) => [String(group._id), group]));

    return elements.map((element) => {
        const group = byElement.get(String(element._id));
        const isRack = element.type === ELEMENT_TYPES.RACK;
        return {
            elementId: element._id,
            occupiedPositions: isRack ? (group?.positions.filter(Boolean).length ?? 0) : null,
            totalPositions: isRack ? countActivePositions(element) : null,
            productCount: group?.products.length ?? 0,
        };
    });
};

// CU08 pasos 2 y 3: productos con stock en una estantería (todas sus posiciones) o en una zona de piso
export const listElementStock = async (warehouseId, elementId) => {
    if (!mongoose.isValidObjectId(elementId)) throw createError(400, "Id inválido");

    const elements = await loadElements(warehouseId);
    if (!elements.id(elementId)) throw createError(404, "Elemento no encontrado");

    return StockLocation.find({ ...withStock(warehouseId), elementId })
        .select("positionId product quantity updatedAt")
        .populate("product", "sapCode description category")
        .sort({ positionId: 1, product: 1 });
};

// Validar producto y cantidad antes de agregar o disminuir stock
const validateStockOperation = async (productId, quantity) => {

    if (!mongoose.isValidObjectId(productId)) {
        throw createError(400, "Debe seleccionar un producto válido");
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
        throw createError(400, "La cantidad debe ser un número entero mayor a cero");
    }

    const productExists = await Product.exists({ _id: productId });

    if (!productExists) {
        throw createError(404, "El producto no existe");
    }
};

//CU21 y CU22: agregar y eliminar stock de una ubicacion especifica del mapa

export const addStockLocationToElementService = async ({ wharehouseId, elementId, positionId, productId, quantity }) => {
    const warehouse = await Warehouse.findById(wharehouseId);
    if (!warehouse) throw createError(404, "Planta no encontrada");

    const element = warehouse.elements.id(elementId);
    if (!element) throw createError(404, "Elemento no encontrado");

    if (element.type === ELEMENT_TYPES.RACK && !positionId) {
        throw createError(400, "Se requiere positionId para estanterías");
    }

    if (element.type === ELEMENT_TYPES.FLOOR && positionId) {
        throw createError(400, "No se permite positionId para zonas de piso");
    }

    await validateStockOperation(productId, quantity);

    const stockLocation = await StockLocation.findOneAndUpdate( //esta consulta busca un stockLocation que tenga el mismo warehouse, elementId, positionId y productId.
        { warehouse: wharehouseId, elementId, positionId: positionId || null, product: productId },// si lo encuentra le suma la cantidad, si no lo encuentra crea uno nuevo
        { $inc: { quantity } },
        { new: true, upsert: true }//el upsert: true indica que si no encuentra un documento que cumpla con la condición, lo crea. El new: true indica que devuelve el documento actualizado.
    );

    return stockLocation;
    
}

export const removeStockLocationToElementService = async ({ wharehouseId, elementId, positionId, productId, quantity }) => {
    const warehouse = await Warehouse.findById(wharehouseId);
    if (!warehouse) throw createError(404, "Planta no encontrada");

    const element = warehouse.elements.id(elementId);
    if (!element) throw createError(404, "Elemento no encontrado");

    if (element.type === ELEMENT_TYPES.RACK && !positionId) {
        throw createError(400, "Se requiere positionId para estanterías");
    }

    if (element.type === ELEMENT_TYPES.FLOOR && positionId) {
        throw createError(400, "No se permite positionId para zonas de piso");
    }

    await validateStockOperation(productId, quantity);

    const baseFilter = { warehouse: wharehouseId, elementId, positionId: positionId || null, product: productId };

    const stockLocation = await StockLocation.findOneAndUpdate(
        { ...baseFilter, quantity: { $gte: quantity } },//gte = grater tahn or equal, es decir, que la cantidad actual sea mayor o igual a la cantidad que se quiere restar
        { $inc: { quantity: -quantity } }, //incrementamos en negativo para restar la cantidad
        { new: true }
    );

    if (!stockLocation) {
        // El update atomico no matcheo: o no existe el registro o no alcanza el stock
        const existing = await StockLocation.findOne(baseFilter).select("quantity");
        if (!existing) {
            throw createError(404, "No hay stock de ese producto en esta ubicación");
        }
        throw createError(409, `Stock insuficiente: disponible ${existing.quantity}, solicitado ${quantity}`);
    }

    return stockLocation;
    
}
