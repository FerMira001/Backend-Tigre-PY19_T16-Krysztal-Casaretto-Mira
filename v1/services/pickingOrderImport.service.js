
import path from "node:path";
import { createError } from "../utils/error.utils.js";
import { normalizeHeader, readSpreadsheet } from "../utils/spreadsheet.utils.js";
import { pickingOrderExcelRowSchema, createPickingOrderSchema } from "../validators/pickingOrder.validator.js";
import { createPickingOrder, resolvePickingOrderExcelItems } from "./pickingOrder.service.js";


// CU25: columnas utilizadas para importar órdenes de picking y reposición
// Formato provisional hasta confirmar el archivo exportado desde SAP
const PICKING_ORDER_COLUMNS = [
    {
        field: "sapCode",
        header: "Código SAP",
        aliases: ["codigo sap", "codigo", "material"]
    },
    {
        field: "description",
        header: "Descripción",
        aliases: ["descripcion", "desc. material"],
        optional: true
    },
    {
        field: "quantity",
        header: "Cantidad",
        aliases: ["cantidad a recoger", "cantidad a reponer"]
    }
];


// Identificar las columnas del archivo
const findColumnIndexes = (headerCells) => {
    const headers = headerCells.map(normalizeHeader);
    const indexes = {};
    const missing = [];

    for (const { field, header, aliases, optional } of PICKING_ORDER_COLUMNS) {
        const validNames = [header, ...aliases].map(normalizeHeader);
        const index = headers.findIndex((name) => validNames.includes(name));

        if (index !== -1) {
            indexes[field] = index;
        } else if (!optional) {
            missing.push(header);
        }
    }

    if (missing.length > 0) {
        throw createError(
            400,
            `Faltan columnas obligatorias: ${missing.join(", ")}`
        );
    }

    return indexes;
};


// Convertir las filas del archivo en productos y cantidades
const extractPickingOrderRows = (rows) => {

    const headerIndex = rows.findIndex(
        (cells) => cells.some((cell) => String(cell ?? "").trim() !== "")
    );

    if (headerIndex === -1) {
        throw createError(400, "El archivo está vacío");
    }

    const columnIndexes = findColumnIndexes(rows[headerIndex]);
    const items = [];

    for (let index = headerIndex + 1; index < rows.length; index++) {
        const cells = rows[index];

        // Ignorar filas completamente vacías
        if (cells.every((cell) => String(cell ?? "").trim() === "")) {
            continue;
        }

        const row = {
            sapCode: cells[columnIndexes.sapCode] ?? "",
            description: columnIndexes.description !== undefined
                ? cells[columnIndexes.description] ?? ""
                : "",
            quantity: cells[columnIndexes.quantity] ?? ""
        };

        // Validar cada fila con Joi
        const { value, error } = pickingOrderExcelRowSchema.validate(row, {
            abortEarly: false
        });

        if (error) {
            throw createError(
                400,
                `Error en la fila ${index + 1}: ${error.details.map(({ message }) => message).join("; ")}`
            );
        }

        items.push(value);
    }

    if (items.length === 0) {
        throw createError(400, "El archivo no contiene productos");
    }

    return items;
};


// Permite recibir los operarios como un arreglo o un JSON enviado desde FormData
const parseAssignedOperators = (value) => {

    if (Array.isArray(value)) {
        return value;
    }

    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);

            if (Array.isArray(parsed)) {
                return parsed;
            }
        } catch {
            // Si no es JSON, se interpreta como un único operario
        }

        return [value];
    }

    return value;
};


// CU25: importar una orden de trabajo de picking o reposición desde Excel o CSV
export const importPickingOrder = async (file, data, createdBy) => {

    if (!file) {
        throw createError(
            400,
            "Adjuntá un archivo Excel (.xlsx) o CSV en el campo file"
        );
    }

    // Leer el archivo reutilizando el código existente del proyecto
    const extension = path.extname(file.originalname).toLowerCase();
    const rows = await readSpreadsheet(file.buffer, extension);

    // Obtener productos y cantidades de las filas
    const excelRows = extractPickingOrderRows(rows);

    // Buscar cada código SAP en el catálogo
    const resolvedItems = await resolvePickingOrderExcelItems(excelRows);

    // Preparar los datos para crear una orden
    const orderData = {
        warehouse: data.warehouse,
        operationType: data.operationType,
        assignedOperators: parseAssignedOperators(data.assignedOperators),
        items: resolvedItems.map(({ product, quantity }) => ({
            product: String(product),
            quantity
        })),
        source: "excel",
        sapReference: data.sapReference || null
    };

    // Validar la estructura de la orden utilizando Joi
    const { value, error } = createPickingOrderSchema.validate(orderData, {
        abortEarly: false
    });

    if (error) {
        throw createError(
            400,
            "Los datos de la orden no son válidos",
            error.details.map(({ path, message }) => ({
                field: path.join("."),
                message
            }))
        );
    }

    // Crear la orden utilizando el mismo servicio que la carga manual
    return createPickingOrder(value, createdBy);
};
