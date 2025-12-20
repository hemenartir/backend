import express, { Request, Response } from 'express';
import { redisClient } from './redisClient'; 
import apiRoutes from './api/routes'; 
import passport from 'passport'; 
import './core/config/google.strategy'; 
import path from 'path';
import fs from 'fs';

const app = express();

// ============================================================
// 1. STATİK DOSYA AYARI (EN ÜSTTE OLMALI)
// ============================================================
// Debug logunda çalıştığını kanıtladığımız "process.cwd()" mantığını kullanıyoruz.
const uploadsPath = path.join(process.cwd(), 'uploads');

console.log("------------------------------------------------");
console.log("📂 Static Dosya Yolu Ayarlandı:", uploadsPath);
console.log("------------------------------------------------");

// Express'e: "/uploads" isteği gelirse, bu klasöre bak diyoruz.
app.use('/uploads', express.static(uploadsPath));

// ============================================================
// 2. DEBUG ENDPOINT (Test için kalabilir)
// ============================================================
app.get('/test-image/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadsPath, filename); // Yukarıdaki doğru yolu kullanır

    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send(`Dosya bulunamadı: ${filePath}`);
    }
});

// ============================================================
// 3. DİĞER MIDDLEWARE'LER
// ============================================================
app.use(express.json()); 
app.use(passport.initialize());

// ❌ SİLİNDİ: app.use('/uploads', express.static(path.join(__dirname, './uploads')));
// (Bu satır dist klasörüne baktığı için hataya sebep oluyordu)

// Redis Hata Dinleyicisi
redisClient.on('error', (err) => console.log('Redis Client Error', err));

// ============================================================
// 4. ROTALAR
// ============================================================

app.get('/', (req: Request, res: Response) => {
  res.status(200).json({ message: 'API Calisiyor!' });
});

app.use('/api/v1', apiRoutes);

app.get('/redis-test', async (req: Request, res: Response) => {
  try {
    await redisClient.set('test_key', 'Merhaba Redis!');
    const value = await redisClient.get('test_key');
    res.status(200).json({ value });
  } catch (error) {
    res.status(500).json({ error: 'Redis hatasi' });
  }
});

export default app;