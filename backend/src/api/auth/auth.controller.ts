import { Request, Response } from 'express';
import { prisma } from '../../prismaClient'; // Burayı değiştirdik
import { AccountStatus } from '../../generated/prisma';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Prisma'yı bir kez burada başlatıp controller içinde kullanabiliriz
//const prisma = new PrismaClient();
// JWT için gizli anahtar (Bunu .env'ye taşımalısın!)
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
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '1h' } // Token 1 saat geçerli
    );

    res.status(200).json({ token });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
};