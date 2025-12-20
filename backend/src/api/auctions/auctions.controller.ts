import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { SocketService } from '../../core/socket/socket.service';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: { id: number };
}

export const createItem = async (req: Request, res: Response) => {
  const { 
    title, 
    description, 
    startingPrice, 
    startTime, 
    endTime, 
    categoryId,
    assets
  } = req.body;
  
  const user = (req as AuthRequest).user;
  
  if (!user) {
    return res.status(401).json({ message: 'User not authenticated' });
  }
  const userId = user.id;

  try {
    const newItem = await prisma.item.create({
      data: {
        title,
        description,
        startingPrice: Number(startingPrice),
        currentPrice: Number(startingPrice),
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        status: 'Active',
        sellerId: userId,
        categoryId: Number(categoryId),
        assets: {
          create: assets.map((asset: { url: string, type: string }) => ({
             assetURL: asset.url,
             assetType: asset.type || 'Image' 
          }))
        }
      },
      // 🟢 DÜZELTME BURADA YAPILDI
      include: {
        assets: true, 
        seller: { // Frontend'in kartı çizebilmesi için satıcı bilgisi ŞART
          select: { username: true, id: true }
        },
        category: true // Kategori rengi/ikonu için gerekebilir
      }
    });

    // Decimal alanları string'e çevirerek göndermek daha güvenlidir (GetFeed ile uyumlu olsun diye)
    const formattedItem = {
        ...newItem,
        currentPrice: newItem.currentPrice.toString(),
        startingPrice: newItem.startingPrice.toString(),
    };

    // 1. Satıcıya Bildirim (DB Kaydı)
    const notification = await prisma.notification.create({
      data: {
        userId: userId,
        itemId: newItem.id,
        type: 'System',
        message: `Ürününüz "${newItem.title}" başarıyla yayınlandı!`,
        isRead: false
      }
    });

    // 2. Satıcıya Anlık Bildirim (Socket)
    SocketService.sendNotification(userId, notification);

    // 3. Ana Sayfaya "Yeni Ürün" Sinyali (formattedItem gönderiyoruz ki frontend seller'ı görsün)
    SocketService.getIO().emit('new_item_listed', formattedItem);

    res.status(201).json(formattedItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create item" });
  }
};

// --- Diğer fonksiyonlar aynı kalabilir ---

export const getItemDetail = async (req: Request, res: Response) => {
  // console.log("İstek Yapan User ID:", (req as any).user?.id);
  const { id } = req.params;
  const userId = (req as AuthRequest).user?.id; 
  
  const item = await prisma.item.findUnique({
    where: { id: Number(id) },
    include: {
      seller: {
        select: { username: true, id: true } 
      },
      assets: true, 
      category: true
    }
  });

    let isWatched = false;
    if (userId) {
      const watchlistRecord = await prisma.watchlist.findUnique({
        where: {
          userId_itemId: {
            userId: userId,
            itemId: Number(id)
          }
        }
      });
      isWatched = !!watchlistRecord; 
    }

  if (!item) return res.status(404).json({ error: "Item not found" });
  
  res.json({ 
        ...item, 
        currentPrice: item.currentPrice.toString(),
        startingPrice: item.startingPrice.toString(),
        isWatched 
    });
};

export const getFeed = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id; 
    
    const items = await prisma.item.findMany({
      where: {
        status: 'Active',           
        endTime: { gt: new Date() } 
      },
      orderBy: {
        startTime: 'desc' 
      },
      include: {
        seller: {
          select: { username: true, id: true } 
        },
        assets: true, 
        category: true 
      }
    });

    let watchedItemIds = new Set<number>(); 
    
    if (userId) {
      const myWatchlist = await prisma.watchlist.findMany({
        where: { userId: userId },
        select: { itemId: true } 
      });
      watchedItemIds = new Set(myWatchlist.map((w: any) => w.itemId));
    }

    const itemsWithStatus = items.map((item : any) => ({
      ...item,
      currentPrice: item.currentPrice.toString(),
      startingPrice: item.startingPrice.toString(),
      isWatched: watchedItemIds.has(item.id) 
    }));

    res.json(itemsWithStatus);

  } catch (error) {
    console.error("Feed Error:", error);
    res.status(500).json({ error: "Failed to load feed" });
  }
};