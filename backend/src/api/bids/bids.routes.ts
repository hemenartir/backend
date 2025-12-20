import { Router } from 'express';
import { authMiddleware } from '../../core/middleware/authMiddleware';
import {placeBid} from './bids.controller'

const router = Router();

router.post('/', authMiddleware, placeBid);

export default router;