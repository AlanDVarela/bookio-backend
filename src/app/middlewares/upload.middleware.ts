import multer from 'multer';

// Memory storage to keep buffer in memory and send it to S3 directly
const storage = multer.memoryStorage();

// Only accept common image files
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Formato no soportado. Sólo imágenes son válidas.'));
  }
};

export const uploadSettings = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});
