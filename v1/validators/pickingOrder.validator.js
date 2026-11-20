
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

// CU25: creación de órdenes de picking y reposición
export const createPickingOrderSchema = Joi.object({

    warehouse: objectIdSchema,

    operationType: Joi.string()
        .valid("picking", "replenishment")
        .required()
        .messages({
            "any.only": "El tipo de operación debe ser picking o reposición",
            "any.required": "Debe seleccionar un tipo de operación"
        }),

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

// CU25: validación de cada fila del Excel de órdenes de picking y reposición
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
