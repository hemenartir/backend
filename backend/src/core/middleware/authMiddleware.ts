import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../../prismaClient';

// ... declare global interface ...

const JWT_SECRET = process.env.JWT_SECRET || 'gizli-anahtar';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    // 🔍 DEBUG LOGS START
    console.log("------------------------------------------------");
    console.log("INCOMING HEADER:", authHeader);
    // 🔍 DEBUG LOGS END

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Yetkilendirme başarısız: Token bulunamadı.' });
    }

    const parts = authHeader.split(' '); 
    
    // 🔍 DEBUG PARTS
    console.log("SPLIT PARTS LENGTH:", parts.length);
    console.log("PARTS:", parts);
    // 🔍 DEBUG END

    // This is where your error happens:
    if (parts.length !== 2 || !parts[1]) {
       return res.status(401).json({ error: 'Yetkilendirme başarısız: Token formatı hatalı.' });
    }

    const token = parts[1];
    const payload = jwt.verify(token, JWT_SECRET) as any; // Cast to any to access properties safely

    // 🔍 DEBUG PAYLOAD
    console.log("DECODED PAYLOAD:", payload);

    // ⚠️ CRITICAL FIX: Your Login Controller sends 'id', but Middleware checks 'userId'
    // Let's support BOTH to be safe.
    const userIdFromToken = payload.userId || payload.id;

    if (!userIdFromToken) {
      return res.status(401).json({ error: 'Geçersiz token içeriği (ID yok).' });
    };
    
    const user = await prisma.user.findUnique({
      where: { id: userIdFromToken }, // Use the extracted variable
    });

    if (!user) {
      return res.status(401).json({ error: 'Yetkilendirme başarısız: Kullanıcı bulunamadı.' });
    }

    if (user.status !== 'Active') {
      return res.status(401).json({ error: 'Yetkilendirme başarısız: Hesap aktif değil.' });
    }

    req.user = user;
    next(); 

  } catch (error) {
    console.log("Middleware Error:", error); // Log the actual error
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Oturum süresi doldu. Lütfen tekrar giriş yapın.' });
    }
    return res.status(401).json({ error: 'Geçersiz token.' });
  }
};

export const optionalAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  // 🔍 DEBUG 1: Header Geliyor mu?
  console.log(">>> OPTIONAL AUTH HEADER:", authHeader ? "VAR" : "YOK");

  // Header yoksa veya Bearer değilse direkt misafir olarak devam et
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log(">>> Misafir: Header yok veya Bearer değil.");
    return next();
  }

  const token = authHeader.split(' ')[1];
  // 🔍 DEBUG 2: Token Ayrıştı mı?
  console.log(">>> Token Var:", !!token);
  if (!token) return next();

  try {
    // 🟢 Callback yerine Try-Catch kullanıyoruz.
    // Bu yöntem TypeScript overload hatasını kesin olarak çözer.
    const user = jwt.verify(token, JWT_SECRET) as any;
console.log(">>> Token Çözüldü, User ID:", user.userId || user.id);
    if (user) {
      // User bilgisini request'e ekle
      (req as any).user = {
        ...user,
        id: user.userId || user.id
      };
    }
  } catch (error) {
    console.log(">>> Token Doğrulama Hatası (Optional):", error);
    // Token geçersizse veya süresi dolmuşsa HATA VERME,
    // sessizce catch bloğuna düşer ve misafir olarak devam eder.
    // console.log("Optional Auth: Token geçersiz, misafir devam ediyor.");
  }

  // Her durumda (başarılı olsa da olmasa da) bir sonraki adıma geç
  next();
};