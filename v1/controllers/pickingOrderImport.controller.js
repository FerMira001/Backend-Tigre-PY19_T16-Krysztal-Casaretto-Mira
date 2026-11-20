
import { importPickingOrder } from "../services/pickingOrderImport.service.js";


// CU25: importar una orden de trabajo de picking o reposición desde un archivo Excel o CSV
export const importPickingOrderController = async (req, res, next) => {
    try {
        const pickingOrder = await importPickingOrder(
            req.file,
            req.body,
            req.user.userId
        );

        return res.status(201).json({
            message: "Orden de trabajo importada correctamente",
            data: pickingOrder
        });

    } catch (error) {
        next(error);
    }
};
