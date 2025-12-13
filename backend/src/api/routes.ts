import { Router } from 'express';
import authRoutes from './auth/auth.routes';
import userRoutes from './user/user.routes';
// Buraya items ve bids rotaları da gelecek
// import itemRoutes from './items/items.routes';

const router = Router();

// /api/v1/auth
router.use('/auth', authRoutes);

// /api/v1/items
// router.use('/items', itemRoutes);

// /api/v1/users
router.use('/users', userRoutes); // YENİ ROTA

export default router;