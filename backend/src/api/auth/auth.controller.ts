import { Request, Response } from 'express';
import { prisma } from '../../prismaClient'; // Burayı değiştirdik
import { AccountStatus } from '../../generated/prisma';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';


// Prisma'yı bir kez burada başlatıp controller içinde kullanabiliriz
//const prisma = new PrismaClient();
// JWT için gizli anahtar (Bunu .env'ye taşımalısın!)
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET || 'gizli-anahtar';

export const registerUser = async (req: Request, res: Response) => {
  try {
    const { email, password, username } = req.body;

    // 1. Kullanıcı mevcut mu?
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        // Kullanici aktif mi?
        if(existingUser.status !== AccountStatus.Active){
                return res.status(403).json({ error: 'Bu hesap devre dışı bırakılmıştır.' });
        }
        return res.status(400).json({ error: 'Bu email zaten kayıtlı.' });
    }

    // 2. Şifreyi hash'le
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Yeni kullanıcıyı veritabanına kaydet
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword, // Hash'lenmiş şifreyi kaydet
        username,
      },
    });

    // 4. (Opsiyonel) Kullanıcıya token ver (direkt giriş yapsın)
    // Şimdilik sadece başarılı mesajı dönelim
    res.status(201).json({ message: 'Kullanıcı başarıyla oluşturuldu.', userId: user.id });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
};

export const loginUser = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // 1. Kullanıcıyı bul
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Geçersiz email veya şifre.' });
    }
    
    // 2. Şifreyi doğrula
    // user.password'ın null olabileceği uyarısını kaldırmak için
    if (!user.passwordHash) {
        return res.status(401).json({ error: 'Bu kullanıcı için şifre ayarlanmamış.' });
    }
        
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Geçersiz email veya şifre.' });
    }

    // 3. JWT Token oluştur
    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '1h' } // Token 1 saat geçerli
    );

    res.status(200).json({ "token": token, "user": {"id": user.id, "email": user.email} });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
};

export const loginWithGoogleMobile = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
      
      if (!googleClientId) {
          throw new Error("GOOGLE_CLIENT_ID is not defined in .env");
      }
    // 1. Verify the Google Token
    const ticket = await client.verifyIdToken({
      idToken: token,
      // IMPORTANT: This must be your WEB Client ID (from Google Console)
      // The mobile app generates the token FOR the web client.
      audience: googleClientId, 
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.email) {
      return res.status(400).json({ message: "Invalid Google Token" });
    }

    const { email, sub: googleId } = payload;

    // --- REUSED PRISMA LOGIC START ---
    
    // 2. Try to find user by Google ID
    let user = await prisma.user.findUnique({
      where: { googleId: googleId },
    });

    // 3. If not found, try by Email
    if (!user) {
      user = await prisma.user.findUnique({ where: { email } });

      if (user) {
        // Link account
        user = await prisma.user.update({
          where: { email: email },
          data: { googleId: googleId },
        });
      } else {
        // 4. Create New User
        let baseUsername = email.split('@')[0];
        if (!baseUsername || baseUsername.length < 3) {
           baseUsername = `user_${googleId.substring(0, 8)}`;
        }
        baseUsername = baseUsername.replace(/[^a-zA-Z0-9_]/g, '');

        let finalUsername = baseUsername;
        let userCreated = false;

        while (!userCreated) {
          try {
            user = await prisma.user.create({
              data: {
                email: email,
                username: finalUsername,
                googleId: googleId,
                status: 'Active', 
              },
            });
            userCreated = true;
          } catch (e: any) {
            if (e.code === 'P2002' && e.meta?.target.includes('username')) {
              finalUsername = baseUsername + '_' + Math.floor(Math.random() * 1000);
            } else {
              throw e;
            }
          }
        }
      }
    }
    // --- REUSED PRISMA LOGIC END ---

    // 5. Generate JWT for your App
    const appToken = jwt.sign(
      { id: user!.id, email: user!.email },
      JWT_SECRET,
      { expiresIn: '7d' } // Long lived token for mobile
    );

    // 6. Return JSON (No redirects!)
    return res.status(200).json({
      message: "Login successful",
      token: appToken,
      user: {
        id: user!.id,
        email: user!.email,
        username: user!.username,
        verified: true // Google users are always email verified
      }
    });

  } catch (error) {
    console.error("Mobile Google Auth Error:", error);
    return res.status(401).json({ message: "Authentication failed", error: error });
  }
};

export const getMe = (req: Request, res: Response) => {
  // authMiddleware zaten kullanıcıyı bulup req.user içine koydu
  // Typescript hatası almamak için 'as any' kullanıyoruz veya interface extend edilebilir
  const user = (req as any).user;

  if (!user) {
    return res.status(401).json({ error: "Oturum bulunamadı." });
  }

  // Güvenlik: Password hash'i ve hassas ID'leri client'a gönderme
  const { passwordHash, googleId, appleId, ...safeUser } = user;

  res.json({ 
    message: "Oturum geçerli", 
    user: safeUser 
  });
};