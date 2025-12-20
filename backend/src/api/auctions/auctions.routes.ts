import { Router } from 'express';
import { authMiddleware } from '../../core/middleware/authMiddleware';
// FIX 1: Use named imports directly. It's safer and gives you autocomplete.
import { createItem, getItemDetail, getFeed } from './auctions.controller';

const router = Router();

// --- AUCTION ROUTES ---

 router.get('/feed', getFeed);
// router.post('/auctions', authMiddleware, createAuction); 

// ✅ These exist, so we use them directly.
router.post('/createItem', authMiddleware, createItem);
//router.get('/items/:id', getItemDetail);
router.get('/:id', getItemDetail);

// This seems like a duplicate of '/createItem', keeping it if you want RESTful naming
router.post('/items', authMiddleware, createItem); 

export default router;