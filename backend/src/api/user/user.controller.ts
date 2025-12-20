import { Request, Response } from 'express';
import { prisma } from '../../prismaClient';
// Düzeltme 1: Enum'u import et
import { User as PrismaUser, AccountStatus } from '@prisma/client';
// (Not: PrismaUser tipi global olarak authMiddleware'de tanımlandığı için
// burada ekstra bir import'a gerek kalmayabilir, ama hata alırsak ekleriz)

/**
 * @desc Kendi hesabını deaktive et (Soft Delete)
 * @route DELETE /api/v1/users/me
 * @access Private (authMiddleware tarafından korunuyor)
 */
export const deactivateMyAccount = async (req: Request, res: Response) => {
  try {
    // req.user objesi authMiddleware'den geliyor.
    // Düzeltme 2: req.user'ın 'id'sini güvenle al
    // (Bu satırın çalışması, authMiddleware.ts'deki 'PrismaUser' düzeltmesine bağlıdır)
    const user = req.user as PrismaUser;
    const userId = user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Yetkisiz kullanıcı.' });
    }

    // Kullanıcıyı silmek yerine 'status' alanını güncelliyoruz
    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        status: AccountStatus.Deactivated, 
      },
    });

    res.status(200).json({ message: 'Hesap başarıyla devre dışı bırakıldı.' });

  } catch (error) {
    console.error('Hesap deaktive etme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
};

/**
 * @desc  Giriş yapmış kullanıcının profil bilgilerini getir
 * @route GET /api/v1/users/me
 * @access Private
 */
export const getMyProfile = async (req: Request, res: Response) => {
  try {
    const user = req.user as any; // authMiddleware'den geliyor
    const userId = user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Yetkisiz erişim.' });
    }

    const userProfile = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        registrationDate: true,
        // Şimdilik avatar yoksa null döner, frontend'de placeholder gösteririz
        // Eğer veritabanında 'avatar' sütunu yoksa, şemaya eklemek gerekebilir
        // Şimdilik varsayılan alanları dönüyoruz.
      }
    });

    if (!userProfile) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    }

    res.status(200).json(userProfile);
  } catch (error) {
    console.error('Profil getirme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
};

// Yardımcı: BigInt serialization hatasını önlemek için
const bigIntToString = (obj: any) => {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
};

// 1. SATTIKLARIM (Selling Auctions)
export const getMySellingItems = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;

    const items = await prisma.item.findMany({
      where: { sellerId: userId },
      include: {
        assets: { take: 1 }, // Sadece kapak resmi yeterli
        bids: { 
            orderBy: { bidAmount: 'desc' },
            take: 1 // En yüksek teklifi görelim
        },
        _count: { select: { bids: true } } // Toplam teklif sayısı
      },
      orderBy: { startTime: 'desc' }
    });
    const formattedItems = items.map(item => ({
        ...item,
        currentPrice: item.currentPrice.toString(),
        startingPrice: item.startingPrice.toString(),
        // BigInt hatası varsa onu da string yap
        id: item.id.toString() 
    }));
    res.json(formattedItems);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Sattıklarım getirilemedi.' });
  }
};

// 2. ALDIKLARIM (Purchased Items)
// Şemana göre Payment tablosunda 'buyerId' var. Ödemesi yapılmış ürünleri buradan çekeriz.
export const getMyPurchases = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;

    const payments = await prisma.payment.findMany({
      where: { 
        buyerId: userId,
        status: 'Completed' // Sadece tamamlanan ödemeler
      },
      include: {
        item: {
          include: { assets: { take: 1 } }
        }
      },
      orderBy: { paymentDate: 'desc' }
    });

    // Frontend'e sadece Item listesi gibi dönmek daha kolay olabilir
    const purchasedItems = payments.map(p => ({
      ...p.item,
      paidAmount: p.amount,
      paymentDate: p.paymentDate,
    }));

    res.json(bigIntToString(purchasedItems));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Aldıklarım getirilemedi.' });
  }
};

// 3. CÜZDAN / İŞLEM GEÇMİŞİ (Wallet)
// Şemanda "WalletBalance" yok, bu yüzden işlem geçmişini ve toplam harcama/kazancı hesaplayacağız.
export const getMyWalletStats = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;

    // A. Yaptığım Ödemeler (Harcamalar)
    const paymentsMade = await prisma.payment.findMany({
      where: { buyerId: userId },
      orderBy: { paymentDate: 'desc' }
    });

    // B. Aldığım Ödemeler (Kazançlar)
    const paymentsReceived = await prisma.payment.findMany({
      where: { sellerId: userId, status: 'Completed' },
      orderBy: { paymentDate: 'desc' }
    });

    // İstatistikler
    const totalSpent = paymentsMade.reduce((acc, curr) => acc + Number(curr.amount), 0);
    const totalEarned = paymentsReceived.reduce((acc, curr) => acc + Number(curr.amount), 0);

    res.json(bigIntToString({
      totalSpent,
      totalEarned,
      history: [...paymentsMade, ...paymentsReceived].sort((a: any, b: any) => 
        new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
      )
    }));

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Cüzdan bilgisi getirilemedi.' });
  }
};