import { Router } from 'express';
import authRoutes from './auth/auth.routes';
import userRoutes from './user/user.routes';
import auctionsRoutes from './auctions/auctions.routes';
import bidsRoutes from './bids/bids.routes';
import uploadRoutes from './upload/upload.routes';

// Buraya items ve bids rotaları da gelecek
// import itemRoutes from './items/items.routes';

const router = Router();

// /api/v1/auth
router.use('/auth', authRoutes);

// /api/v1/users
router.use('/users', userRoutes); // YENİ ROTA

// /api/v1/auctions
router.use('/auctions', auctionsRoutes);

// /api/v1/bids
router.use('bids', bidsRoutes);

router.use('upload', uploadRoutes)

// /api/v1/uploads

export default router;