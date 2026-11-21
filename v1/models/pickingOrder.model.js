
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

const pickingOrderItemSchema = new mongoose.Schema({

    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },

    quantity: {
        type: Number,
        required: true,
        min: 1,
        validate: {
            validator: Number.isInteger,
            message: "La cantidad debe ser un número entero"
        }
    }

}, { _id: false });


// CU25: generación de órdenes de trabajo de picking y reposición
const pickingOrderSchema = new mongoose.Schema({

    // Identificador interno para reconocer la orden fácilmente
    orderCode: {
        type: String,
        unique: true,
        required: true,
        default: () => `OP-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`
    },

    warehouse: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Warehouse",
        required: true
    },

    operationType: {
        type: String,
        enum: ["picking", "replenishment"],
        required: true
    },

    // Cliente o destinatario del pedido
    // Opcional porque las reposiciones pueden ser internas
    customerName: {
        type: String,
        trim: true,
        maxlength: 150,
        default: null
    },

    // Fecha prevista de entrega del pedido
    deliveryDate: {
        type: Date,
        default: null
    },

    items: {
        type: [pickingOrderItemSchema],
        validate: {
            validator: (items) => items.length > 0,
            message: "La orden debe contener al menos un producto"
        }
    },

    assignedOperators: {
        type: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Usuario"
        }],
        validate: {
            validator: (operators) => operators.length > 0,
            message: "Debe haber al menos un operario asignado"
        }
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Usuario",
        required: true
    },

    status: {
        type: String,
        enum: ["pending", "in_progress", "completed"],
        default: "pending"
    },

    source: {
        type: String,
        enum: ["manual", "excel"],
        required: true
    },

    // Referencia del pedido original de SAP, cuando corresponda
    sapReference: {
        type: String,
        trim: true,
        default: null
    }

}, { timestamps: true });

export default mongoose.model("PickingOrder", pickingOrderSchema);
