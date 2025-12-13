import express, { Request, Response } from 'express';
import { redisClient } from './redisClient'; // Redis'i ayrı bir dosyaya alabiliriz
import apiRoutes from './api/routes'; // Ana API rotamızı import ediyoruz
import passport from 'passport'; // EKLE
import './core/config/google.strategy'; // EKLE (Stratejimizin çalışması için)
// --- KURUMLAR ---
const app = express();
app.use(express.json()); // JSON body parser
app.use(passport.initialize());
// Redis'i app.ts'den ayırmak iyi bir fikir olabilir
// simdilik burada
redisClient.on('error', (err) => console.log('Redis Client Error', err));


// --- ANA MANTIK ---

// Basit bir test rotasi
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({ message: 'API Calisiyor!' });
});

// !!! YENİ EKLEDİĞİMİZ BÖLÜM !!!
// Gelen tüm istekleri /api/v1 için apiRoutes'a yönlendir
app.use('/api/v1', apiRoutes);


// Ornek: Redis Test (Bunu silebilir veya bırakabilirsiniz)
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