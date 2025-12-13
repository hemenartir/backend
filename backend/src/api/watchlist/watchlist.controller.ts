import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: { id: number };
}

// Toggle: If exists, remove it. If not, add it.
export const toggleWatchlist = async (req: AuthRequest, res: Response) => {
  const { itemId } = req.body;
  const userId = req.user?.id;
  
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

export const getMyWatchlist = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const watchlist = await prisma.watchlist.findMany({
    where: { userId: userId },
    include: {
      item: { // Include the actual item details
        include: { assets: true } // Include images
      }
    }
  });

  res.json(watchlist);
};