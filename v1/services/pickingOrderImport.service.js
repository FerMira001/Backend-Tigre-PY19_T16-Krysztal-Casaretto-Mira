
import path from "node:path";
import Product from "../models/product.model.js";
import { createError } from "../utils/error.utils.js";
import {
    normalizeHeader,
    readSpreadsheet
} from "../utils/spreadsheet.utils.js";
import {
    createPickingOrderSchema,
    pickingOrderExcelRowSchema
} from "../validators/pickingOrder.validator.js";
import {
    createPickingOrder,
    resolvePickingOrderExcelItems
} from "./pickingOrder.service.js";


// CU25: columnas esperadas en el archivo Excel o CSV

const PICKING_ORDER_COLUMNS = [
    {
        field: "sapCode",
        header: "Código SAP",
        aliases: ["codigo", "material"],
        required: true
    },
    {
        field: "description",
        header: "Descripción",
        aliases: ["desc. material"],
        required: false
    },
    {
        field: "quantity",
        header: "Cantidad",
        aliases: [
            "cantidad a recoger",
            "cantidad a reponer"
        ],
        required: true
    }
];


// Identificar las columnas del Excel
const findColumnIndexes = (headerCells) => {

    const headers = headerCells.map(normalizeHeader);
    const indexes = {};
    const missingColumns = [];

    for (const column of PICKING_ORDER_COLUMNS) {

        const acceptedNames = [
            column.header,
            ...column.aliases
        ].map(normalizeHeader);

        const index = headers.findIndex(
            (header) => acceptedNames.includes(header)
        );

        if (index !== -1) {
            indexes[column.field] = index;
        } else if (column.required) {
            missingColumns.push(column.header);
        }
    }

    if (missingColumns.length > 0) {
        throw createError(
            400,
            `El archivo no contiene las columnas obligatorias: ${missingColumns.join(", ")}`
        );
    }

    return indexes;
};


// Extraer y validar los productos del archivo
const extractPickingOrderRows = (
    rows,
    headerIndex,
    columnIndexes
) => {

    const products = [];

    for (
        let index = headerIndex + 1;
        index < rows.length;
        index++
    ) {

        const cells = rows[index];

        // Ignorar filas completamente vacías
        if (
            !Array.isArray(cells) ||
            cells.every((cell) => !String(cell ?? "").trim())
        ) {
            continue;
        }

        const row = {
            sapCode: cells[columnIndexes.sapCode] ?? "",
            description: columnIndexes.description !== undefined
                ? cells[columnIndexes.description] ?? ""
                : "",
            quantity: cells[columnIndexes.quantity] ?? ""
        };

        const { value, error } = pickingOrderExcelRowSchema.validate(
            row,
            { abortEarly: false }
        );

        if (error) {

            const messages = error.details
                .map((detail) => detail.message)
                .join("; ");

            throw createError(
                400,
                `Error en la fila ${index + 1}: ${messages}`
            );
        }

        products.push(value);
    }

    if (products.length === 0) {
        throw createError(
            400,
            "El archivo no contiene productos para importar"
        );
    }

    return products;
};


// CU25: leer y validar el archivo Excel o CSV
// Esta función es compartida por la vista previa y la importación
const readPickingOrderFile = async (file) => {

    if (!file) {
        throw createError(
            400,
            "Adjuntá un archivo Excel (.xlsx) o CSV en el campo file"
        );
    }

    const extension = path.extname(
        file.originalname
    ).toLowerCase();

    const rows = await readSpreadsheet(
        file.buffer,
        extension
    );

    if (!Array.isArray(rows) || rows.length === 0) {
        throw createError(
            400,
            "El archivo está vacío"
        );
    }

    // Buscar la primera fila con contenido
    const headerIndex = rows.findIndex(
        (cells) =>
            Array.isArray(cells) &&
            cells.some((cell) => String(cell ?? "").trim())
    );

    if (headerIndex === -1) {
        throw createError(
            400,
            "El archivo está vacío"
        );
    }

    // Identificar las columnas obligatorias
    const columnIndexes = findColumnIndexes(
        rows[headerIndex]
    );

    // Obtener y validar las filas de productos
    return extractPickingOrderRows(
        rows,
        headerIndex,
        columnIndexes
    );
};


// CU25: convertir los operarios seleccionados en el formulario
const parseAssignedOperators = (assignedOperators) => {

    if (Array.isArray(assignedOperators)) {
        return assignedOperators;
    }

    if (typeof assignedOperators === "string") {

        try {
            const parsed = JSON.parse(assignedOperators);

            if (Array.isArray(parsed)) {
                return parsed;
            }

        } catch {
            return assignedOperators
                .split(",")
                .map((id) => id.trim())
                .filter(Boolean);
        }
    }

    return assignedOperators;
};


// CU25: vista previa de una orden importada desde Excel
// No crea una orden ni modifica el stock
export const previewPickingOrderImport = async (file) => {

    // Leer el archivo y validar sus columnas y cantidades
    const excelRows = await readPickingOrderFile(file);

    // Identificar los productos del catálogo mediante código SAP
    const items = await resolvePickingOrderExcelItems(
        excelRows
    );

    const productIds = items.map((item) => item.product);

    // Obtener el nombre de cada producto desde nuestro catálogo
    const catalogProducts = await Product.find({
        _id: { $in: productIds }
    }).select("_id sapCode description");

    const productsById = new Map(
        catalogProducts.map((product) => [
            String(product._id),
            product
        ])
    );

    const products = items.map((item) => {

        const product = productsById.get(
            String(item.product)
        );

        return {
            product: item.product,
            sapCode: product.sapCode,
            description: product.description,
            quantity: item.quantity
        };
    });

    return {
        products,
        totalProducts: products.length,
        totalUnits: products.reduce(
            (total, product) => total + product.quantity,
            0
        )
    };
};


// CU25: importar una orden de picking o reposición desde Excel
export const importPickingOrder = async (
    file,
    data,
    createdBy
) => {

    // Leer y validar los productos y cantidades del Excel
    const excelRows = await readPickingOrderFile(file);

    // Identificar los productos existentes en el catálogo
    const items = await resolvePickingOrderExcelItems(
        excelRows
    );

    // Los demás datos provienen del formulario,
    // no del archivo Excel
    const {
        warehouse,
        operationType,
        customerName = null,
        deliveryDate = null,
        sapReference = null,
        assignedOperators
    } = data;

    const orderData = {
        warehouse,
        operationType,
        items,
        assignedOperators: parseAssignedOperators(
            assignedOperators
        ),
        customerName: customerName || null,
        deliveryDate: deliveryDate || null,
        sapReference: sapReference || null,
        source: "excel"
    };

    // Convertir los ObjectId de MongoDB a strings
    // antes de validar y crear la orden importada.
    orderData.items = orderData.items.map((item) => ({
        ...item,
        product: String(item.product?._id ?? item.product)
    }));

    // Validar la información completa de la orden
    const { value, error } = createPickingOrderSchema.validate(
        orderData,
        { abortEarly: false }
    );

    if (error) {

        const messages = error.details
            .map((detail) => detail.message)
            .join("; ");

        throw createError(
            400,
            `No se pudo importar la orden: ${messages}`
        );
    }

    // Crear la orden con los productos del Excel
    // y los datos seleccionados por el administrativo
    // No se modifica el stock
    return await createPickingOrder(
        value,
        createdBy
    );
};
