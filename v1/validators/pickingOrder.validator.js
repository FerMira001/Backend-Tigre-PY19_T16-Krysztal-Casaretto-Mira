
import Joi from "joi";

const objectIdSchema = Joi.string().hex().length(24).required();

const pickingOrderItemSchema = Joi.object({
    product: objectIdSchema,

    quantity: Joi.number()
        .integer()
        .min(1)
        .required()
        .messages({
            "number.base": "La cantidad debe ser un número",
            "number.integer": "La cantidad debe ser un número entero",
            "number.min": "La cantidad debe ser mayor a cero",
            "any.required": "La cantidad es obligatoria"
        })
});

// Obtener la fecha actual del servidor
const todayLocalISO = () => {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

// Validar que la fecha sea válida y no sea anterior a hoy
const deliveryDateSchema = Joi.date()
    .iso()
    .allow(null, "")
    .optional()
    .custom((value, helpers) => {
        if (!value) return value;

        const deliveryDay = value.toISOString().slice(0, 10);

        if (deliveryDay < todayLocalISO()) {
            return helpers.message(
                "La fecha de entrega no puede ser anterior a hoy"
            );
        }

        return value;
    })
    .messages({
        "date.base": "La fecha de entrega no es válida",
        "date.format": "La fecha de entrega debe tener un formato válido"
    });

// CU25: creación manual o por Excel
export const createPickingOrderSchema = Joi.object({

    warehouse: objectIdSchema,

    operationType: Joi.string()
        .valid("picking", "replenishment")
        .required()
        .messages({
            "any.only": "El tipo de operación debe ser picking o reposición",
            "any.required": "Debe seleccionar un tipo de operación"
        }),

    customerName: Joi.string()
        .trim()
        .max(150)
        .allow("", null)
        .optional()
        .messages({
            "string.max": "El nombre del cliente no puede superar los 150 caracteres"
        }),

    deliveryDate: deliveryDateSchema,

    items: Joi.array()
        .items(pickingOrderItemSchema)
        .min(1)
        .unique("product")
        .required()
        .messages({
            "array.min": "La orden debe contener al menos un producto",
            "array.unique": "No se puede repetir un producto en la misma orden",
            "any.required": "Debe seleccionar al menos un producto"
        }),

    assignedOperators: Joi.array()
        .items(objectIdSchema)
        .min(1)
        .unique()
        .required()
        .messages({
            "array.min": "Debe asignar al menos un operario",
            "array.unique": "No se puede asignar el mismo operario más de una vez",
            "any.required": "Debe asignar al menos un operario"
        }),

    source: Joi.string()
        .valid("manual", "excel")
        .default("manual"),

    sapReference: Joi.string()
        .trim()
        .max(80)
        .allow("", null)
        .optional()
});

// Validación de filas del Excel
export const pickingOrderExcelRowSchema = Joi.object({

    sapCode: Joi.string()
        .trim()
        .max(40)
        .required()
        .messages({
            "string.empty": "Falta el código SAP",
            "any.required": "Falta el código SAP"
        }),

    description: Joi.string()
        .trim()
        .max(200)
        .allow("", null)
        .optional(),

    quantity: Joi.number()
        .integer()
        .min(1)
        .required()
        .messages({
            "number.base": "La cantidad debe ser un número",
            "number.integer": "La cantidad debe ser un número entero",
            "number.min": "La cantidad debe ser mayor a cero",
            "any.required": "Falta la cantidad"
        })
});
