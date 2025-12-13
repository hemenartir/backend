import { Router } from 'express';
import { authMiddleware } from '../../core/middleware/authMiddleware';


const router = Router();
const watchlistController = require('./watchlist.controller')

router.post('/watchlist/toggle', authMiddleware, watchlistController.toggleWatchlist);
router.get('/watchlist', authMiddleware, watchlistController.getMyWatchlist);

export default router;