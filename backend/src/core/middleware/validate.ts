import { Request, Response, NextFunction } from 'express';
import { ZodObject } from 'zod';

// Bu fonksiyon, bir Zod şemasını alıp bir Express middleware'ine dönüştürür
export const validate = (schema: ZodObject) => 
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    await schema.parseAsync({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    return next(); // Doğrulama başarılı, sonraki adıma geç
  } catch (error) {
    return res.status(400).json(error); // Doğrulama hatası
  }
};