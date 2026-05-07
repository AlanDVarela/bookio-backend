"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadSettings = void 0;
const multer_1 = __importDefault(require("multer"));
//Middleware para aceptar solo imagenes de < 5 mb y las guarda en memoria como buffer
const storage = multer_1.default.memoryStorage();
const fileFilter = (req, file, cb) => {
    let isImage = file.mimetype.startsWith('image/');
    // Si el cliente no envió el Content-Type correcto, suele llegar como application/octet-stream.
    // En ese caso, verificamos la extensión del archivo original.
    if (!isImage && file.mimetype === 'application/octet-stream') {
        const ext = file.originalname.toLowerCase();
        if (ext.match(/\.(jpg|jpeg|png|gif|webp|heic|heif)$/)) {
            isImage = true;
            // Corregimos el mimetype para que cuando se suba a S3, el navegador sepa que es una imagen
            if (ext.endsWith('.png'))
                file.mimetype = 'image/png';
            else if (ext.endsWith('.webp'))
                file.mimetype = 'image/webp';
            else if (ext.endsWith('.gif'))
                file.mimetype = 'image/gif';
            else
                file.mimetype = 'image/jpeg'; // fallback seguro para jpg/heic
        }
    }
    if (isImage) {
        cb(null, true);
    }
    else {
        console.error(`[Upload Error]: Mimetype no soportado: ${file.mimetype} (Archivo: ${file.originalname})`);
        cb(new Error(`Formato no soportado (${file.mimetype}). Sólo imágenes son válidas.`));
    }
};
exports.uploadSettings = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
});
