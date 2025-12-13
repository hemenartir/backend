import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client'; // or your generated path
import { SocketService } from '../../core/socket/socket.service';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: { id: number }; // Populated by authMiddleware
}

export const placeBid = async (req: AuthRequest, res: Response) => {
  // 1. Get Data
  const { itemId, amount } = req.body;
  const userId = req.user?.id; // <--- THIS IS HOW WE KNOW THE USER

  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const result = await prisma.$transaction(async (tx: {
            $queryRaw: any; bid: {
                create: (arg0: {
                    data: {
                        bidAmount: any; // Prisma handles Decimal conversion
                        userId: number; itemId: number;
                    };
                }) => any;
            }; item: { update: (arg0: { where: { id: number; }; data: { currentPrice: any; highBidderId: number; }; }) => any; };
        }) => {
      // 2. LOCK THE ITEM ROW
      // We use raw SQL to lock the row ("Item") to prevent race conditions.
      const items = await tx.$queryRaw<any[]>`
        SELECT id, "currentPrice", "endTime", "status", "sellerId"
        FROM "Item" 
        WHERE id = ${Number(itemId)} 
        FOR UPDATE
      `;

      const item = items[0];
      if (!item) throw new Error("Item not found");

      // 3. VALIDATION LOGIC
      const now = new Date();
      
      // Check Status (Using your Enum)
      if (item.status !== 'Active') {
        throw new Error("Item is not active");
      }
      
      // Check Time
      if (now > new Date(item.endTime)) {
        throw new Error("Auction has ended");
      }

      // Check Self-Bidding (Optional: Prevent seller from bidding on own item)
      if (item.sellerId === userId) {
        throw new Error("You cannot bid on your own item");
      }

      // Check Price (Decimal handling)
      // We convert to Number for comparison, but store as Decimal/String
      if (Number(amount) <= Number(item.currentPrice)) {
        throw new Error(`Bid must be higher than current price: ${item.currentPrice}`);
      }

      // 4. DATABASE UPDATES
      
      // A. Create the Bid Record
      const newBid = await tx.bid.create({
        data: {
          bidAmount: amount, // Prisma handles Decimal conversion
          userId: userId,
          itemId: Number(itemId)
        }
      });

      // B. Update the Item (Price + HighBidder)
      // Your schema has 'highBidderId', so we update that too!
      const updatedItem = await tx.item.update({
        where: { id: Number(itemId) },
        data: { 
          currentPrice: amount,
          highBidderId: userId 
        }
      });

      return { newBid, updatedItem };
    });

    // 5. REAL-TIME UPDATE (Redis/Socket)
    // Emit event: "Item #123 price is now $150 by User #5"
    SocketService.getIO()
      .to(`auction:${itemId}`)
      .emit('price_update', {
        itemId: Number(itemId),
        newPrice: result.updatedItem.currentPrice.toString(), // Send as string to be safe
        highBidderId: userId,
        timestamp: new Date()
      });

    // 6. RESPONSE
    // We explicitly convert BigInt to string in response if not using the helper above
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