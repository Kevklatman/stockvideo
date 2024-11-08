// src/middleware/raw-body.middleware.ts
import { Request, Response, NextFunction } from 'express';

export const preserveRawBody = (req: Request, res: Response, next: NextFunction) => {
  let data = '';
  
  req.setEncoding('utf8');
  
  req.on('data', (chunk) => {
    data += chunk;
  });

  req.on('end', () => {
    req.rawBody = Buffer.from(data);
    next();
  });
};