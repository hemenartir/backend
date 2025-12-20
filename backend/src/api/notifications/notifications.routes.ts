import { Router } from 'express';
import { 
  getNotifications, 
  getUnreadCount, 
  markAsRead, 
  markAllAsRead, 
  deleteNotification 
} from './notifications.controller';
import { authMiddleware } from '../../core/middleware/authMiddleware'; // Kendi auth middleware'in

const router = Router();

// Tüm rotalar giriş yapmış kullanıcı gerektirir
router.use(authMiddleware);

router.get('/', getNotifications);               // GET /api/notifications
router.get('/unread-count', getUnreadCount);     // GET /api/notifications/unread-count
router.patch('/mark-all-read', markAllAsRead);   // PATCH /api/notifications/mark-all-read
router.patch('/:id/read', markAsRead);           // PATCH /api/notifications/123/read
router.delete('/:id', deleteNotification);       // DELETE /api/notifications/123

export default router;