import http from 'http'; // 🟢 1. HTTP modülünü ekledik
import app from './app';
import { redisClient } from './redisClient'; 
import { prisma } from './prismaClient';     
import { SocketService } from './core/socket/socket.service'; // 🟢 2. Servisimizi import ettik
import { startAuctionCheckCron } from './core/services/cron.service';

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  try {
    // 1. Mevcut Redis bağlantısı
    await redisClient.connect();
    console.log('Redis istemcisine baglanildi.');

    // 🟢 3. Express 'app'ini Node.js HTTP sunucusu ile sarmalıyoruz
    // Socket.io'nun çalışması için saf bir HTTP sunucusuna ihtiyacı vardır.
    const httpServer = http.createServer(app);

    // 🟢 4. Socket Servisini Başlatıyoruz (INIT)
    // Bu satır olmadan "Socket.io not initialized" hatası alırsınız.
    await SocketService.init(httpServer);
    console.log('✅ Socket.io servisi başlatıldı.');

    // 🟢 5. 'app.listen' yerine 'httpServer.listen' kullanıyoruz
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`Sunucu http://localhost:${PORT} adresinde calisiyor...`);
      startAuctionCheckCron();
    });

  } catch (error) {
    console.error('Sunucu baslatilirken hata olustu:', error);
    process.exit(1); 
  }
}

// Kapatma sinyallerini yonet (graceful shutdown)
async function shutdown() {
  console.log('Sunucu kapatiliyor...');
  await redisClient.quit();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', shutdown); // Ctrl+C
process.on('SIGTERM', shutdown); // Docker stop

// Sunucuyu baslat
startServer();