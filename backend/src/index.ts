import app from './app';
import { redisClient } from './redisClient'; // Redis'i kendi dosyasından
import { prisma } from './prismaClient';     // Prisma'yı kendi dosyasından

const PORT= Number(process.env.PORT) || 3000;

async function startServer() {
  try {
    // Redis'e baglan
    await redisClient.connect();
    console.log('Redis istemcisine baglanildi.');

    // Prisma'ya (veritabanina) baglanmayi beklemiyoruz,
    // ilk sorguda "lazy" olarak baglanir.

    // Express sunucusunu baslat
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Sunucu http://localhost:${PORT} adresinde calisiyor...`);
    });

  } catch (error) {
    console.error('Sunucu baslatilirken hata olustu:', error);
    process.exit(1); // Hata durumunda uygulamayi kapat
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