import { Router } from 'express';
import { authMiddleware } from '../../core/middleware/authMiddleware';


const router = Router();
const bidsController = require('./bids.controller');

router.post('/bids', authMiddleware, bidsController.placeBid);

export default router;