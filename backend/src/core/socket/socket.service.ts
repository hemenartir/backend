import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';


interface ServerToClientEvents {
  price_update: (data: { 
    itemId: number;        // <--- Added this
    newPrice: string;      // <--- Changed to string (safer for Decimals)
    highBidderId: number;  // <--- Renamed from 'bidderId' to match your controller
    timestamp: Date; 
  }) => void;
}
export class SocketService {
  private static io: Server<any, ServerToClientEvents>;

  public static async init(httpServer: HttpServer): Promise<void> {
    const pubClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    this.io = new Server(httpServer, {
      cors: { origin: "*" },
      adapter: createAdapter(pubClient, subClient)
    });

    this.io.on('connection', (socket: Socket) => {
      console.log(`User connected: ${socket.id}`);
      
      socket.on('join_auction', (auctionId: string) => {
        socket.join(`auction:${auctionId}`);
      });
    });
  }

  // Helper to get the IO instance anywhere in your app
  public static getIO() {
    if (!this.io) {
      throw new Error("Socket.io not initialized!");
    }
    return this.io;
  }
}