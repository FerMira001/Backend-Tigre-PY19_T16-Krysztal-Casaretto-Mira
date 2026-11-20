
import mongoose from "mongoose";

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

    sapReference: {
        type: String,
        trim: true,
        default: null
    }

}, { timestamps: true });

export default mongoose.model("PickingOrder", pickingOrderSchema);
