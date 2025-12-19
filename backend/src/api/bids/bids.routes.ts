import { Router } from 'express';
import { authMiddleware } from '../../core/middleware/authMiddleware';
import {placeBid} from './bids.controller'

const router = Router();

router.post('/bids', authMiddleware, placeBid);

export default router;