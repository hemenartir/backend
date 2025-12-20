import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import jwt from 'jsonwebtoken'; // Token doğrulaması için gerekli

// Socket'ten Client'a gidecek eventlerin tipleri
interface ServerToClientEvents {
  // Mevcut eventler
  price_update: (data: { 
    itemId: number;
    newPrice: string;
    highBidderId: number;
    timestamp: Date; 
  }) => void;

  feed_update: (data: {
    itemId: number;
    newPrice: string;
  }) => void;

  // YENİ: Kişiye özel bildirim eventi
  notification: (data: {
    id: number;       // Bildirim ID (DB'deki)
    type: string;     // 'AuctionWon', 'Outbid' vs.
    message: string;
    itemId?: number;
    isRead: boolean;
    createdAt: Date;
  }) => void;
}

// Socket verisi (socket.data içinde tutulacaklar)
interface SocketData {
  user?: {
    id: number;
    email: string;
  };
}

export class SocketService {
  // Generic tipleri güncelledik: <ClientEvents, ServerEvents, InterEvents, SocketData>
  private static io: Server<any, ServerToClientEvents, any, SocketData>;

  public static async init(httpServer: HttpServer): Promise<void> {
    const pubClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    this.io = new Server(httpServer, {
      cors: { origin: "*" },
      adapter: createAdapter(pubClient, subClient)
    });

    // --- MIDDLEWARE: KİMLİK DOĞRULAMA ---
    // Kullanıcı bağlanmadan önce token kontrolü yapıyoruz
    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token; // Frontend'den { auth: { token: "..." } } gelmeli

      if (!token) {
        // Token yoksa bağlantıyı reddetmiyoruz (Misafir kullanıcılar sadece izleyebilir)
        // Ama user odasına giremezler.
        return next();
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
        socket.data.user = { id: decoded.id, email: decoded.email }; // Socket objesine user bilgisini gömüyoruz
        next();
      } catch (err) {
        // Token geçersizse hata fırlatabiliriz veya misafir moduna alabiliriz.
        console.error("Socket Auth Error:", err);
        next(new Error("Authentication error"));
      }
    });

    this.io.on('connection', (socket: Socket) => {
      console.log(`Socket connected: ${socket.id} (User: ${socket.data.user?.id || 'Guest'})`);
      
      // 1. Kullanıcıyı kendi ÖZEL odasına al (Örn: "user:5")
      if (socket.data.user) {
        const userRoom = `user:${socket.data.user.id}`;
        socket.join(userRoom);
        console.log(`User ${socket.data.user.id} joined personal room: ${userRoom}`);
      }

      // 2. Müzayede odasına katılma (Mevcut mantık)
      socket.on('join_auction', (auctionId: string) => {
        socket.join(`auction:${auctionId}`);
      });
    });
  }

  public static getIO() {
    if (!this.io) {
      throw new Error("Socket.io not initialized!");
    }
    return this.io;
  }

  /**
   * YENİ: Belirli bir kullanıcıya bildirim gönderir.
   */
  public static sendNotification(userId: number, notificationData: any) {
    if (!this.io) return;
    
    // Sadece o kullanıcının odasına emit ediyoruz
    this.io.to(`user:${userId}`).emit('notification', notificationData);
  }
}