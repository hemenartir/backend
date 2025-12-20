import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: { id: number };
}

// Toggle: If exists, remove it. If not, add it.
export const toggleWatchlist = async (req: Request, res: Response) => {
  const { itemId } = req.body;
  const user = (req as AuthRequest).user;
  const userId = user?.id;
  
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    // 1. Check if already watching
    const existing = await prisma.watchlist.findUnique({
      where: {
        userId_itemId: { // Composite unique key from your schema
          userId: userId,
          itemId: Number(itemId)
        }
      }
    });

    if (existing) {
      // 2. Remove
      await prisma.watchlist.delete({
        where: {
          userId_itemId: { userId: userId, itemId: Number(itemId) }
        }
      });
      return res.json({ watching: false });
    } else {
      // 3. Add
      await prisma.watchlist.create({
        data: {
          userId: userId,
          itemId: Number(itemId)
        }
      });
      return res.json({ watching: true });
    }

  } catch (error) {
    res.status(500).json({ error: "Failed to update watchlist" });
  }
};

export const getMyWatchlist = async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  const userId = user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const watchlist = await prisma.watchlist.findMany({
      where: { userId: userId },
      orderBy: { addedAt: 'desc' }, // En son eklenen en üstte
      include: {
        item: {
          include: {
            assets: true, // Resimler
            // 🟢 Kullanıcının bu ürüne yaptığı teklifleri kontrol et
            bids: {
                where: { userId: userId },
                select: { id: true } // Sadece var mı yok mu diye bakacağız
            },
            seller: {
                select: { username: true }
            }
          }
        }
      }
    });

    // Veriyi Frontend'in anlayacağı temiz bir formata sokalım
    const formattedList = watchlist.map((record : any) => {
      const item = record.item;
      const userHasBid = item.bids.length > 0; // Teklif dizisi boş değilse teklif vermiştir
      const isWinning = item.highBidderId === userId; // En yüksek teklif bende mi?

      return {
        ...item,
        currentPrice: item.currentPrice.toString(), // Decimal fix
        startingPrice: item.startingPrice.toString(), // Decimal fix
        // 🟢 Frontend için kritik flagler:
        userHasBid: userHasBid, 
        isWinning: isWinning,
        // Watchlist sayfasında olduğumuz için bu kesin true
        isWatched: true 
      };
    });

    res.json(formattedList);

  } catch (error) {
    console.error("Watchlist Error:", error);
    res.status(500).json({ error: "Failed to fetch watchlist" });
  }
};