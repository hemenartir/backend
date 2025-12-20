import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { SocketService } from '../../core/socket/socket.service';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: { id: number };
}

export const placeBid = async (req: Request, res: Response) => {
  // 1. Get Data
  const { itemId, amount } = req.body;
  const user = (req as AuthRequest).user;
  
  if (!user) {
      return res.status(401).json({ message: 'User not authenticated' });
  }
  const userId = user.id;

  try {
    // Transaction sonucu bize hem güncel veriyi hem de gönderilecek bildirim listesini dönecek
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      
      // 2. LOCK THE ITEM ROW (title ekledik!)
      const items = await tx.$queryRaw<any[]>`
        SELECT id, title, "currentPrice", "endTime", "status", "sellerId", "highBidderId"
        FROM "Item" 
        WHERE id = ${Number(itemId)} 
        FOR UPDATE
      `;

      const item = items[0];
      if (!item) throw new Error("Item not found");

      // Önceki teklif vereni sakla (Outbid bildirimi için)
      const previousBidderId = item.highBidderId;

      // 3. VALIDATION LOGIC
      const now = new Date();
      
      if (item.status !== 'Active') throw new Error("Item is not active");
      if (now > new Date(item.endTime)) throw new Error("Auction has ended");
      if (item.sellerId === userId) throw new Error("You cannot bid on your own item");
      if (Number(amount) <= Number(item.currentPrice)) {
        throw new Error(`Bid must be higher than current price: ${item.currentPrice}`);
      }

      // 4. DATABASE UPDATES
      
      // A. Create Bid
      const newBid = await tx.bid.create({
        data: {
          bidAmount: amount,
          userId: userId,
          itemId: Number(itemId)
        }
      });

      // B. Update Item
      const updatedItem = await tx.item.update({
        where: { id: Number(itemId) },
        data: { 
          currentPrice: amount,
          highBidderId: userId 
        }
      });

      // C. Watchlist logic
      await tx.watchlist.upsert({
        where: { userId_itemId: { userId: userId, itemId: Number(itemId) } },
        update: {},
        create: { userId: userId, itemId: Number(itemId) }
      });

      // 5. CREATE NOTIFICATIONS (Database Records)
      const notificationsToSend = [];

      // SENARYO 1: Önceki Teklif Vereni Uyar (Outbid)
      // Eğer bir önceki teklif veren varsa VE o kişi şu anki teklif veren değilse
      if (previousBidderId && previousBidderId !== userId) {
        const outbidNotif = await tx.notification.create({
          data: {
            userId: previousBidderId,
            itemId: item.id,
            type: 'Outbid', // Frontend'de buna göre üzgün yüz ikonu koyabilirsin :(
            message: `Dikkat! "${item.title}" ürünündeki teklifin geçildi. Yeni fiyat: ${amount} TL`,
            isRead: false
          }
        });
        notificationsToSend.push({ userId: previousBidderId, data: outbidNotif });
      }

      // SENARYO 2: Satıcıyı Uyar (NewBid)
      // Satıcı kendi ürününe teklif geldiğini görsün
      const sellerNotif = await tx.notification.create({
        data: {
          userId: item.sellerId,
          itemId: item.id,
          type: 'NewBid', // Frontend'de para ikonu 💰
          message: `Yeni Teklif! "${item.title}" ürününüze ${amount} TL teklif geldi.`,
          isRead: false
        }
      });
      notificationsToSend.push({ userId: item.sellerId, data: sellerNotif });
      
      return { newBid, updatedItem, notificationsToSend };
    });

    // ---------------------------------------------------------
    // TRANSACTION DIŞI (Socket Emit İşlemleri)
    // ---------------------------------------------------------

    // 1. Müzayede Odasındaki Herkese Fiyatı Güncelle
    SocketService.getIO()
      .to(`auction:${itemId}`)
      .emit('price_update', {
        itemId: Number(itemId),
        newPrice: result.updatedItem.currentPrice.toString(),
        highBidderId: userId,
        timestamp: new Date()
      });

    // 2. Ana Sayfadaki (Feed) Herkese Fiyatı Güncelle
    SocketService.getIO().emit('feed_update', { 
        itemId: Number(itemId), 
        newPrice: result.updatedItem.currentPrice.toString() 
    });

    // 3. Kişiye Özel Bildirimleri Gönder (Outbid & Seller)
    // result.notificationsToSend dizisindeki herkesi döngüyle uyar
    result.notificationsToSend.forEach((notifPacket : any) => {
        SocketService.sendNotification(notifPacket.userId, {
            id: notifPacket.data.id,
            type: notifPacket.data.type,
            message: notifPacket.data.message,
            itemId: notifPacket.data.itemId,
            isRead: notifPacket.data.isRead,
            createdAt: notifPacket.data.createdAt
        });
    });

    // 6. RESPONSE
    res.status(200).json({
      success: true,
      price: result.updatedItem.currentPrice,
      bidId: result.newBid.id.toString() 
    });

  } catch (error: any) {
    console.error(error);
    res.status(400).json({ error: error.message });
  }
};