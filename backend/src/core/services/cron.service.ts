import cron from 'node-cron';
import { PrismaClient, ItemStatus } from '@prisma/client';
import {SocketService} from '../socket/socket.service';

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

  // title alanını da çekiyoruz ki bildirim mesajında ürün adını yazabilelim.
  const endedItems = await prisma.item.findMany({
    where: {
      endTime: { lte: now },
      status: ItemStatus.Active,
    },
    include: {
        // Eğer ürünün sahibine de "Ürününüz satıldı" bildirimi atacaksanız 
        // buraya seller: true eklemeniz gerekebilir.
        seller: true,
    } 
  });

  if (endedItems.length === 0) return;

  console.log(`${endedItems.length} adet süresi dolan ürün işleniyor...`);

  for (const item of endedItems) {
    try {
      await prisma.$transaction(async (tx : any) => {
        
        // SENARYO A: Kazanan Var (AuctionWon)
        if (item.highBidderId) {
            // 1. Ürünü güncelle
            const updateResult = await tx.item.updateMany({
                where: { 
                    id: item.id, 
                    status: ItemStatus.Active 
                },
                data: { status: ItemStatus.WaitingPayment }
            });

            // Eğer güncelleme başarılıysa (yani ürün hala aktiftiyse ve kilitlendiyse)
            if (updateResult.count > 0) {
                // 2. Bildirim Oluştur (AuctionWon)
                const newNotification = await tx.notification.create({
                    data: {
                        userId: item.highBidderId, // Kazanan kullanıcı
                        itemId: item.id,
                        type: 'AuctionWon',
                        message: `Tebrikler! "${item.title}" ürününü ${item.currentPrice} TL teklif ile kazandınız. Ödemenizi tamamlamak için tıklayın.`,
                        isRead: false
                    }
                });

                console.log(`✅ Ürün #${item.id} satıldı ve User #${item.highBidderId} için bildirim oluşturuldu.`);

                // --- SOCKET ILE CANLI BILDIRIM GONDER ---
                // Transaction dışına çıkmasını beklemeye gerek yok, asenkron atabiliriz.
                // Ancak veritabanına yazıldığından emin olduğumuz noktadayız.
                SocketService.sendNotification(item.highBidderId, {
                    id: newNotification.id,
                    type: newNotification.type,
                    message: newNotification.message,
                    itemId: newNotification.itemId,
                    isRead: newNotification.isRead,
                    createdAt: newNotification.createdAt
                });
            }
        } 
        // SENARYO B: Kazanan Yok (Unsold)
        else {
            await tx.item.updateMany({
                where: { 
                    id: item.id, 
                    status: ItemStatus.Active 
                },
                data: { status: ItemStatus.Unsold }
            });
            console.log(`⛔ Ürün #${item.id} satılmadı.`);
        }
      });

    } catch (error) {
      console.error(`Ürün #${item.id} işlenirken hata:`, error);
    }
  }
};