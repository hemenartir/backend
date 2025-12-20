import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

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
  // 2. Fail fast if user is missing (Runtime safety)
  if (!user) {
    return res.status(401).json({ message: 'User not authenticated' });
  }
  const userId = user.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const newItem = await prisma.item.create({
      data: {
        title,
        description,
        startingPrice: Number(startingPrice), // Ensure number
        currentPrice: Number(startingPrice),
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        status: 'Active',
        sellerId: userId,
        categoryId: Number(categoryId),
        
        // --- NEW LOGIC ---
        // 'assets' should be an array like: [{ url: '...', type: 'Image' }]
        assets: {
          create: assets.map((asset: { url: string, type: string }) => ({
             assetURL: asset.url,
             assetType: asset.type || 'Image' 
          }))
        }
      },
      include: {
        assets: true // Return the created assets in the response
      }
    });

    res.status(201).json(newItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create item" });
  }
};

export const getItemDetail = async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const item = await prisma.item.findUnique({
    where: { id: Number(id) },
    include: {
      seller: {
        select: { username: true, id: true } // Only return safe data
      },
      assets: true, // Images
      category: true
    }
  });

  if (!item) return res.status(404).json({ error: "Item not found" });
  res.json(item);
};

// ... existing imports

export const getFeed = async (req: Request, res: Response) => {
  try {
    // 1. Fetch items from database
    const items = await prisma.item.findMany({
      where: {
        status: 'Active',           // Only show active auctions
        endTime: { gt: new Date() } // Ensure auction hasn't ended yet
      },
      orderBy: {
        startTime: 'desc' // Show newest items first
      },
      include: {
        seller: {
          select: { username: true, id: true } // Show who is selling it
        },
        assets: true, // Get images
        category: true // Get category info
      }
    });

    res.json(items);
    console.log(items);
  } catch (error) {
    console.error("Feed Error:", error);
    res.status(500).json({ error: "Failed to load feed" });
  }
};