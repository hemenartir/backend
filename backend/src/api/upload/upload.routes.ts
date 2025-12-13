import { Router } from 'express';
import { upload } from '../../core/middleware/fileUpload';
import { uploadImage } from './upload.controller';
import { authMiddleware } from '../../core/middleware/authMiddleware';

const router = Router();

// 'image' is the key name expected in the form-data
router.post('/upload', authMiddleware, upload.single('image'), uploadImage);

export default router;