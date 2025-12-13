import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: { id: number };
}

export const createItem = async (req: AuthRequest, res: Response) => {
  const { 
    title, 
    description, 
    startingPrice, 
    startTime, 
    endTime, 
    categoryId 
  } = req.body;

  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const newItem = await prisma.item.create({
      data: {
        title,
        description,
        startingPrice: startingPrice,
        currentPrice: startingPrice, // currentPrice starts equal to startingPrice
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        status: 'Active', // Default from Enum
        sellerId: userId, // Relation
        categoryId: Number(categoryId) // Relation
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