import { Router } from 'express';
import { registerUser, loginUser } from './auth.controller';
import { validate } from '../../core/middleware/validate'; // Henüz oluşturmadık, şimdi oluşturacağız
import { registerSchema, loginSchema } from './auth.validation';
import passport from 'passport'; // EKLE
import jwt from 'jsonwebtoken'; // EKLE

const JWT_SECRET = process.env.JWT_SECRET!; // .env'den alıyoruz

const router = Router();

// POST /api/v1/auth/register
router.post('/register', validate(registerSchema), registerUser);

// POST /api/v1/auth/login
router.post('/login', validate(loginSchema), loginUser);


/**
 * @desc 1. Adım: Kullanıcıyı Google'a Yönlendirme
 * Kullanıcı (Next.js sitenizden) bu linke tıklar:
 * <a href="http://localhost:3000/api/v1/auth/google">Google ile Giriş Yap</a>
 * @route GET /api/v1/auth/google
 */
router.get(
  '/google',
  passport.authenticate('google', { 
    scope: ['profile', 'email'], 
    session: false // JWT kullanacağız, session'a gerek yok
  })
);

/**
 * @desc 2. Adım: Google'ın Geri Döndüğü Callback
 * Bu, Google Stratejisi'ndeki 'callbackURL' ile AYNI olmalıdır
 * @route GET /api/v1/auth/google/callback
 */
router.get(
  '/google/callback',
  passport.authenticate('google', { 
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=true`, // Hata olursa frontend'e yönlendir
    session: false 
  }),
  (req, res) => {
    // Bu noktada, Google Stratejisi (Adım 5) çalıştı (find or create).
    // 'req.user' objesi Passport tarafından stratejideki 'user' ile dolduruldu.
    
    const user = req.user as any; 

    if (!user) {
      return res.status(401).json({ error: 'Kimlik doğrulama başarısız.' });
    }

    // 3. Adım: Başarılı. Kendi JWT'mizi oluşturup Frontend'e yollayalım.
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 4. Adım: Kullanıcıyı frontend'e, token ile birlikte yönlendir.
    // Frontend (Next.js) bu token'ı URL'den okuyup kaydedecek.
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  }
);

export default router;