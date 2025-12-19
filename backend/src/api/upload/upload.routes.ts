import { Router } from 'express';
import { upload } from '../../core/middleware/fileUpload';
import { uploadImages } from './upload.controller'; // Renamed controller function
import { authMiddleware } from '../../core/middleware/authMiddleware';

const router = Router();

// Change 'single' to 'array'
// 'images' is the key name expected in FormData
router.post('/upload', authMiddleware, upload.array('images', 7), uploadImages);

export default router;