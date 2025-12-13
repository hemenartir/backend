import { Router } from 'express';
import { deactivateMyAccount } from './user.controller';
import { authMiddleware } from '../../core/middleware/authMiddleware';

const router = Router();

/**
 * @route DELETE /api/v1/users/me
 * 'authMiddleware' bu rotayı korur.
 * Sadece geçerli bir token'a sahip 'Active' kullanıcılar bu rotaya erişebilir.
 */
router.delete('/me', authMiddleware, deactivateMyAccount);

export default router;