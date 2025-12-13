import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../../prismaClient'; // Global prisma istemcimiz
import { User } from '../../generated/prisma'; // Prisma'nın oluşturduğu User tipi

// Express'in Request tipine 'user' özelliğini ekliyoruz
declare global {
  namespace Express {
    interface Request {
      user?: User; // req.user'ın tipini User olarak tanımla
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'gizli-anahtar';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    // 1. Token var mı ve formatı doğru mu?
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Yetkilendirme başarısız: Token bulunamadı.' });
    }

    // 2. Token'ı ayır
    const parts = authHeader.split(' '); // örn: ['Bearer', 'eyJh...']

    // 3. (YENİ KONTROL) Token'ın ikinci kısmı (değeri) var mı?
    // Eğer dizi 2 elemanlı değilse veya ikinci eleman boşsa, format hatalıdır.
    if (parts.length !== 2 || !parts[1]) {
       return res.status(401).json({ error: 'Yetkilendirme başarısız: Token formatı hatalı.' });
    }

    // 4. Token'ı değişkene ata
    const token = parts[1]; // TypeScript artık 'token'ın 'string' olduğunu biliyor.

    const payload = jwt.verify(token, JWT_SECRET);
    
    // 3. Payload'ın (token içeriğinin) beklediğimiz gibi olup olmadığını KONTROL EDELİM
    if (typeof payload !== 'object' || payload === null || !('userId' in payload)) {
      return res.status(401).json({ error: 'Geçersiz token içeriği (payload).' });
    };
    
    // 3. Token'daki kullanıcı ID'si veritabanında var mı?
    const user = await prisma.user.findUnique({
      where: { id: (payload as any).userId },
    });

    if (!user) {
      return res.status(401).json({ error: 'Yetkilendirme başarısız: Kullanıcı bulunamadı.' });
    }

    // 4. (Soft Delete İyileştirmesi) Kullanıcı deaktif mi?
    if (user.status !== 'Active') {
      return res.status(401).json({ error: 'Yetkilendirme başarısız: Hesap aktif değil.' });
    }

    // 5. Her şey yolunda, kullanıcıyı req objesine ekle
    req.user = user;
    next(); // Bir sonraki işleme (controller'a) geç

  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Oturum süresi doldu. Lütfen tekrar giriş yapın.' });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Geçersiz token.' });
    }
    return res.status(500).json({ error: 'Sunucu hatası.' });
  }
};