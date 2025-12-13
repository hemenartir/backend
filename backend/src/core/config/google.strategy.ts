import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { prisma } from '../../prismaClient';

// Gerekli .env değişkenlerini kontrol et
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.API_URL) {
  throw new Error("Google OAuth için gerekli çevre değişkenleri (CLIENT_ID, CLIENT_SECRET, API_URL) ayarlanmamış.");
}

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    // Bu URL, Adım 3'te Google'a girdiğimiz URL ile BİREBİR AYNI olmalıdır.
    callbackURL: `${process.env.API_URL}/api/v1/auth/google/callback`,
    scope: ['profile', 'email'],
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
        // 1. Google'dan temel bilgileri al
        const email = profile.emails?.[0]?.value;
        const googleId = profile.id;
        
        if (!email) {
          return done(new Error('Google profili e-posta içermiyor.'), false);
        }

      // 2. Kullanıcıyı Google ID ile bulmaya çalış
      let user = await prisma.user.findUnique({
        where: { googleId: googleId },
      });

      // 3. Google ID ile bulunamadıysa, e-posta ile ara
      if (!user) {
        user = await prisma.user.findUnique({ where: { email } });

        if (user) {
          // E-posta ile bulundu (muhtemelen şifreyle kayıt olmuş)
          // Hesabı birleştir: Mevcut kullanıcıya googleId'yi ekle
          user = await prisma.user.update({
            where: { email: email },
            data: { googleId: googleId },
          });
        } else {
          // 4. Kullanıcı hiç yok: Yeni kullanıcı oluştur
          // Şemamızda 'username' zorunlu ve unique.
          // Google bize 'username' vermez, e-postadan türetelim.
          
        let baseUsername = email.split('@')[0];
          // 1. Geçersiz/boş 'baseUsername' kontrolü
            // (Örn: email "@gmail.com" ise baseUsername = "")
            // Eğer 'baseUsername' boşsa veya çok kısaysa,
            // kullanıcıya ÖZEL ve BENZERSİZ olan Google ID'sini kullanalım.
        if (!baseUsername || baseUsername.length < 3) {
                baseUsername = `user_${profile.id}`; // Örn: "user_109283748291"
        }

            // 2. (İsteğe bağlı) Geçersiz karakterleri temizle
            // Sadece harf, rakam ve alt çizgiye izin verelim (şemanıza göre ayarlayın)
        baseUsername = baseUsername.replace(/[^a-zA-Z0-9_]/g, '');

          let finalUsername = baseUsername;
          let userCreated = false;

          while (!userCreated) {
              try {
                  user = await prisma.user.create({
                      data: {
                          email: email,
                          username: finalUsername, // Türetilen username
                          googleId: googleId,
                          // passwordHash null olacak (şemamız izin veriyor: String?)
                          // status varsayılan olarak 'Active' olacak
                      },
                  });
                  userCreated = true; // Başarılı, döngüden çık
              } catch (e: any) {
                  // Prisma P2002 hatası (Unique constraint failed)
                  if (e.code === 'P2002' && e.meta?.target.includes('username')) {
                      // Username zaten alınmış, sonuna rastgele sayı ekle
                      finalUsername = baseUsername + '_' + Math.floor(Math.random() * 1000);
                  } else {
                      // Başka bir hata, döngüden çık ve hatayı fırlat
                      throw e;
                  }
              }
          }
        }
      }

      // Passport'a kullanıcıyı ver (bu kullanıcı 'req.user' olacak)
      return done(null, user || false);

    } catch (error) {
      return done(error as Error, false);
    }
  }
));

// Not: Session kullanmayacağımız için serialize/deserializeUser
// fonksiyonlarına (şimdilik) ihtiyacımız yok.

// Passport'un kullanıcıyı session'a NASIL kaydedeceğini belirler.
// Sadece kullanıcı ID'sini kaydetmek yeterlidir.
passport.serializeUser((user, done) => {
  // 'user' objesi, Google Stratejisinden 'done(null, user)' ile gelendir.
  // Tipini 'any' olarak belirtmek, 'id' özelliğine erişmemizi sağlar.
  done(null, (user as any).id);
});

// Passport'un kullanıcıyı session'dan NASIL geri alacağını belirler.
// ID'yi kullanarak veritabanından tam kullanıcı profilini çekeriz.
passport.deserializeUser(async (id: number, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    
    // HATA BURADAYDI:
    // Eğer 'user' null ise, 'false' veya 'undefined' döndürmeliyiz.
    
    // Düzeltilmiş Hali:
    return done(null, user || false);
    
  } catch (error) {
    // Bir veritabanı hatası oluşursa
    return done(error, false);
  }
});