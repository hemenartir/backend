import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Örnekteki gibi Tip Güvenliği için Interface
interface AuthRequest extends Request {
  user?: { id: number };
}

// 1. Bildirimleri Listele
export const getNotifications = async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  
  // Fail fast check (Runtime safety)
  if (!user) {
    return res.status(401).json({ message: 'User not authenticated' });
  }
  const userId = user.id;

  try {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }, // En yeniden eskiye
      take: 20, // Son 20 bildirim
      include: {
        item: {
            select: {
                title: true, // Bildirimde ürün adını göstermek istersen
                assets: {
                    take: 1, // Yanında küçük bir resim (thumbnail) göstermek istersen
                    select: { assetURL: true }
                }
            }
        }
      }
    });

    res.json(notifications);
  } catch (error) {
    console.error("Get Notifications Error:", error);
    res.status(500).json({ error: "Failed to load notifications" });
  }
};

// 2. Okunmamış Bildirim Sayısını Getir (Badge için)
export const getUnreadCount = async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  if (!user) return res.status(401).json({ message: 'User not authenticated' });
  const userId = user.id;

  try {
    const count = await prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    res.json({ count });
  } catch (error) {
    console.error("Count Error:", error);
    res.status(500).json({ error: "Failed to get count" });
  }
};

// 3. Tek Bir Bildirimi Okundu İşaretle
export const markAsRead = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as AuthRequest).user;
  if (!user) return res.status(401).json({ message: 'User not authenticated' });
  const userId = user.id;

  try {
    // updateMany kullanıyoruz çünkü 'where' içinde hem ID hem UserID kontrolü 
    // yapmak istiyoruz (Güvenlik: Başkasının bildirimini okuyamasın).
    const result = await prisma.notification.updateMany({
      where: {
        id: Number(id),
        userId: userId, 
      },
      data: { isRead: true },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Mark Read Error:", error);
    res.status(500).json({ error: "Failed to update notification" });
  }
};

// 4. Tüm Bildirimleri Okundu İşaretle
export const markAllAsRead = async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  if (!user) return res.status(401).json({ message: 'User not authenticated' });
  const userId = user.id;

  try {
    await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error("Mark All Read Error:", error);
    res.status(500).json({ error: "Failed to update notifications" });
  }
};

// 5. Bildirimi Sil
export const deleteNotification = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as AuthRequest).user;
  if (!user) return res.status(401).json({ message: 'User not authenticated' });
  const userId = user.id;

  try {
    const result = await prisma.notification.deleteMany({
      where: {
        id: Number(id),
        userId: userId, // Sadece kendine ait olanı silebilir
      },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({ error: "Failed to delete notification" });
  }
};