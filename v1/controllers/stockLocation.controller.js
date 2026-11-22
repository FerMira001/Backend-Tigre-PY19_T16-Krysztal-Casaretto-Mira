import * as stockLocationService from "../services/stockLocation.service.js";
import { getWarehouse } from "../services/warehouse.service.js";

// RN14: getWarehouse responde 404 si la planta no existe y 403 si el operario no la tiene asignada
export const getWarehouseOccupancy = async (req, res) => {
    await getWarehouse(req.params.id, req.user);
    const occupancy = await stockLocationService.getWarehouseOccupancy(req.params.id);
    res.status(200).json({ message: "Ocupación de la planta", data: occupancy });
};

export const listElementStock = async (req, res) => {
    await getWarehouse(req.params.id, req.user);
    const stock = await stockLocationService.listElementStock(req.params.id, req.params.elementId);
    res.status(200).json({ message: "Stock del elemento", data: stock });
};

// CU09: consultar el stock de un producto en una planta
export const getProductStockSummary = async (req, res) => {

    const { id: warehouseId, productId } = req.params;

    // Validar que el usuario tenga acceso a la planta
    await getWarehouse(warehouseId, req.user);

    const stock = await stockLocationService.getProductStockSummary(
        warehouseId,
        productId
    );

    res.status(200).json({
        message: "Consulta de stock del producto",
        data: stock
    });
};

// CU09: consultar el resumen general de stock de una planta
export const getWarehouseStockSummary = async (req, res) => {

    const { id: warehouseId } = req.params;

    // Validar que el usuario tenga acceso a la planta
    await getWarehouse(warehouseId, req.user);

    const stock = await stockLocationService.getWarehouseStockSummary(warehouseId);

    res.status(200).json({
        message: "Resumen general de stock de la planta",
        data: stock
    });
};