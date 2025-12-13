import { createClient } from 'redis';

// 1. Çevre değişkenini kontrol et (Daha önce yaşadığımız 'undefined' hatasını önlemek için)
const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error("REDIS_URL çevre değişkeni ayarlanmamış. Lütfen .env dosyasını kontrol edin.");
}

// 2. Redis istemcisini oluştur ve dışa aktar
export const redisClient = createClient({
  url: redisUrl
});

// 3. Hata dinleyicisini buraya ekle
redisClient.on('error', (err) => console.log('Redis Client Error', err));

// ÖNEMLİ NOT:
// .connect() fonksiyonunu burada ÇAĞIRMIYORUZ.
// Bağlantı, uygulamanın ana giriş noktası olan index.ts'te yapılmalı.
// Bu dosya sadece istemciyi "hazırlar".