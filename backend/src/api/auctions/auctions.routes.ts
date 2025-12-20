import { Router } from 'express';
import { authMiddleware, optionalAuthMiddleware } from '../../core/middleware/authMiddleware';
// FIX 1: Use named imports directly. It's safer and gives you autocomplete.
import { createItem, getItemDetail, getFeed } from './auctions.controller';

const router = Router();

// --- AUCTION ROUTES ---

router.get('/feed', optionalAuthMiddleware, getFeed);
// router.post('/auctions', authMiddleware, createAuction); 

// ✅ These exist, so we use them directly.
router.post('/createItem', authMiddleware, createItem);
//router.get('/items/:id', getItemDetail);
// 3. DETAY ROTASI (BURAYI TEST EDİYORUZ)
// router.get('/:id', 
//   // A) Inline Debug Middleware (Konsola bir şey yazmak zorunda)
//   (req, res, next) => {
//     console.log("🔥 ROTA YAKALANDI! Middleware sırası başladı.");
//     console.log("🔥 URL:", req.originalUrl);
//     next();
//   },
//   // B) Bizim Middleware
//   optionalAuthMiddleware, 
//   // C) Controller
//   getItemDetail
// );

router.get('/:id',optionalAuthMiddleware, getItemDetail);

// This seems like a duplicate of '/createItem', keeping it if you want RESTful naming
router.post('/items', authMiddleware, createItem); 

export default router;