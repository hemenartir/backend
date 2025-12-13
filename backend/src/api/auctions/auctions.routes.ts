import { Router } from 'express';
import { authMiddleware } from '../../core/middleware/authMiddleware';

const router = Router();
// Import Controllers
const auctionsController = require('../controllers/auctionController');

// --- AUCTION ROUTES ---

router.get('/auctions', auctionsController.getFeed);
router.post('/auctions', authMiddleware, auctionsController.createAuction);

router.post('/createItem', authMiddleware, auctionsController.createItem);
router.get('/items/:id', auctionsController.getItemDetail);
router.post('/items', authMiddleware, auctionsController.createItem);
export default router;