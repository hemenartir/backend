import cron from 'node-cron';
import { PrismaClient, ItemStatus } from '@prisma/client';
import { SocketService } from '../socket/socket.service'; // Path'i kontrol et

const prisma = new PrismaClient();

let isJobRunning = false;

export const startAuctionCheckCron = () => {
  cron.schedule('* * * * *', async () => {
    if (isJobRunning) {
      console.log('⚠️ Önceki işlem sürdüğü için bu tur atlandı.');
      return;
    }
    isJobRunning = true;
    
    try {
      console.log('⏳ Müzayede kontrolü çalışıyor...');
      await checkAndEndAuctions();
    } catch (error) {
      console.error('❌ Cron hatası:', error);
    } finally {
      isJobRunning = false;
    }
  });
};

const checkAndEndAuctions = async () => {
  const now = new Date();

  const endedItems = await prisma.item.findMany({
    where: {
      endTime: { lte: now },
      status: ItemStatus.Active,
    },
    include: {
        seller: true, // Satıcı bilgilerine (ID'sine) ihtiyacımız var
    } 
  });

  if (endedItems.length === 0) return;

  console.log(`${endedItems.length} adet süresi dolan ürün işleniyor...`);

  for (const item of endedItems) {
    try {
      await prisma.$transaction(async (tx : any) => {
        
        // -------------------------------------------------------
        // SENARYO A: Kazanan Var (AuctionWon)
        // -------------------------------------------------------
        if (item.highBidderId) {
            // 1. Ürünü güncelle
            const updateResult = await tx.item.updateMany({
                where: { id: item.id, status: ItemStatus.Active },
                data: { status: ItemStatus.WaitingPayment }
            });

            if (updateResult.count > 0) {
                
                // --- BİLDİRİM 1: ALICIYA (KAZANAN) ---
                const buyerNotif = await tx.notification.create({
                    data: {
                        userId: item.highBidderId,
                        itemId: item.id,
                        type: 'AuctionWon',
                        message: `Tebrikler! "${item.title}" ürününü ${item.currentPrice} TL ile kazandınız. Ödeme yapın.`,
                        isRead: false
                    }
                });
                
                // --- BİLDİRİM 2: SATICIYA (ÜRÜNÜNÜZ SATILDI) ---
                // Satıcı da ürününün gittiğini bilmeli
                const sellerNotif = await tx.notification.create({
                    data: {
                        userId: item.sellerId, // Satıcının ID'si
                        itemId: item.id,
                        type: 'ItemSold', // Yeni bir tip kullanabilirsin
                        message: `Müjde! "${item.title}" ürününüz ${item.currentPrice} TL'ye satıldı. Ödeme bekleniyor.`,
                        isRead: false
                    }
                });

                console.log(`✅ Ürün #${item.id} satıldı. Alıcı ve Satıcı bilgilendirildi.`);

                // --- SOCKET GÖNDERİMLERİ ---
                SocketService.sendNotification(item.highBidderId, buyerNotif);
                SocketService.sendNotification(item.sellerId, sellerNotif);
                SocketService.getIO().emit('auction_ended', { itemId: item.id });
            }
        } 
        
        // -------------------------------------------------------
        // SENARYO B: Kazanan Yok (Unsold)
        // -------------------------------------------------------
        else {
            const updateResult = await tx.item.updateMany({
                where: { id: item.id, status: ItemStatus.Active },
                data: { status: ItemStatus.Unsold }
            });

            if (updateResult.count > 0) {
                // --- BİLDİRİM: SATICIYA (SATILAMADI) ---
                const unsoldNotif = await tx.notification.create({
                    data: {
                        userId: item.sellerId, // Satıcı
                        itemId: item.id,
                        type: 'AuctionFailed', // veya 'Unsold'
                        message: `Süre doldu: "${item.title}" ürününüz maalesef teklif almadı ve kapandı.`,
                        isRead: false
                    }
                });

                console.log(`⛔ Ürün #${item.id} satılmadı. Satıcı bilgilendirildi.`);

                // --- SOCKET GÖNDERİMİ ---
                SocketService.sendNotification(item.sellerId, unsoldNotif);
                SocketService.getIO().emit('auction_ended', { itemId: item.id });
            }
        }
      });

    } catch (error) {
      console.error(`Ürün #${item.id} işlenirken hata:`, error);
    }
  }
};