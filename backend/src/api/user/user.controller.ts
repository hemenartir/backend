import { Request, Response } from 'express';
import { prisma } from '../../prismaClient';
// Düzeltme 1: Enum'u import et
import { User as PrismaUser, AccountStatus } from '../../generated/prisma';
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