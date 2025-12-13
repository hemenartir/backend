import { Request, Response } from 'express';

export const uploadImage = (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  // Construct the public URL
  // NOTE: Android Emulator cannot see 'localhost'. Use your machine's IP.
  const baseUrl = process.env.API_BASE_URL || 'http://0.0.0.0:3000';
  const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;

  res.json({ url: fileUrl });
};