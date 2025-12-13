import { PrismaClient } from './generated/prisma';

// Prisma Client'ın tek bir global örneğini oluştur
// ve bunu dışa aktar.
export const prisma = new PrismaClient({
  // Geliştirme yaparken hangi sorguların çalıştığını görmek için
  // loglamayı açabilirsiniz (opsiyonel):
  // log: ['query', 'info', 'warn', 'error'],
});

// Redis'ten farklı olarak Prisma'nın .connect() metodunu
// burada çağırmamıza gerek yok.
// İlk sorguyu (lazy) yaptığında otomatik olarak bağlanır.