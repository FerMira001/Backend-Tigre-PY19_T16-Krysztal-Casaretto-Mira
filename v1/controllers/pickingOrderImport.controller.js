
import {
    importPickingOrder,
    previewPickingOrderImport
} from "../services/pickingOrderImport.service.js";


// CU25: mostrar una vista previa de los productos del Excel
// No crea una orden ni modifica el stock
export const previewPickingOrderImportController = async (
    req,
    res,
    next
) => {

    try {

        const preview = await previewPickingOrderImport(
            req.file
        );

        return res.status(200).json({
            message: "Archivo procesado correctamente",
            data: preview
        });

    } catch (error) {
        next(error);
    }
};


// CU25: importar una orden de picking o reposición
// Se ejecuta cuando el administrativo confirma la creación
export const importPickingOrderController = async (
    req,
    res,
    next
) => {

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
