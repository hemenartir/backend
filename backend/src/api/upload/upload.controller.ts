import { Request, Response } from 'express';

export const uploadImages = (req: Request, res: Response) => {
  // Multer puts files in req.files when using .array()
  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    return res.status(400).json({ error: "No files uploaded" });
  }

  const protocol = req.protocol; 
  const host = req.get('host'); 
  const baseUrl = `${protocol}://${host}`;

  // Map over all files and create URLs for them
  const fileUrls = files.map(file => {
    return `${baseUrl}/uploads/${file.filename}`;
  });

  // Return the array of URLs
  res.json({ urls: fileUrls });
};