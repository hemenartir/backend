import { Router } from 'express';
import { deactivateMyAccount, getMyProfile, getMyPurchases, getMySellingItems, getMyWalletStats } from './user.controller';
import { authMiddleware } from '../../core/middleware/authMiddleware';

const router = Router();

/**
 * @route DELETE /api/v1/users/me
 * 'authMiddleware' bu rotayı korur.
 * Sadece geçerli bir token'a sahip 'Active' kullanıcılar bu rotaya erişebilir.
 */
router.delete('/me', authMiddleware, deactivateMyAccount);

router.get('/me', authMiddleware, getMyProfile);

router.get('/me/selling', authMiddleware, getMySellingItems);

router.get('/me/purchases', authMiddleware, getMyPurchases);

router.get('/me/wallet', authMiddleware, getMyWalletStats);

export default router;