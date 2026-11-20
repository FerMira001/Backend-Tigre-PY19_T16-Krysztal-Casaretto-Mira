import * as warehouseService from "../services/warehouse.service.js";
import { addStockLocationToElementService, removeStockLocationToElementService } from "../services/stockLocation.service.js";
import { warehouseSchema } from "../validators/warehouse.validator.js";
import { validateWith } from "../utils/validation.utils.js";

export const listWarehouses = async (req, res) => {
    const warehouses = await warehouseService.listWarehouses(req.user);
    res.status(200).json({ message: "Plantas", data: warehouses });
};

export const getWarehouse = async (req, res) => {
    const warehouse = await warehouseService.getWarehouse(req.params.id, req.user);
    res.status(200).json({ message: "Planta", data: warehouse });
};

export const createWarehouse = async (req, res) => {
    const warehouse = await warehouseService.createWarehouse(validateWith(warehouseSchema, req.body));
    res.status(201).json({ message: "Planta creada", data: warehouse });
};

export const updateWarehouse = async (req, res) => {
    const warehouse = await warehouseService.updateWarehouse(req.params.id, validateWith(warehouseSchema, req.body));
    res.status(200).json({ message: "Planta actualizada", data: warehouse });
};

//CU21 y CU22: agregar y eliminar stock de una ubicacion especifica del mapa

export const addStockLocationToElement = async (req, res) => {
    const { wharehouseId, elementId } = req.params;
    const { positionId, productId, quantity } = req.body;

    const updatedElement = await addStockLocationToElementService({wharehouseId, elementId, positionId, productId, quantity });
    res.status(200).json({ message: "Stock agregado correctamente a la ubicacion", data: updatedElement });
};

export const removeStockLocationToElement = async (req, res) => {
    const { wharehouseId, elementId } = req.params;
    const { positionId, productId, quantity } = req.body;

    const updatedElement = await removeStockLocationToElementService({wharehouseId, elementId, positionId, productId, quantity });
    res.status(200).json({ message: "Stock eliminado correctamente de la ubicacion", data: updatedElement });
}