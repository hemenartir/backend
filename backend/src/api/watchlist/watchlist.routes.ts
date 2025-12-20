import { Router } from 'express';
import { authMiddleware } from '../../core/middleware/authMiddleware';
import {toggleWatchlist, getMyWatchlist} from './watchlist.controller';

const router = Router();


router.post('/toggle', authMiddleware, toggleWatchlist);
router.get('/', authMiddleware, getMyWatchlist);

export default router;