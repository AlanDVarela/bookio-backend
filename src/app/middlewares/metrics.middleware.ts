import { Request, Response, NextFunction } from 'express';
import { trackRequest } from '../../services/metrics.service';

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const route = req.baseUrl + (req.route?.path ?? req.path);
    trackRequest(route, req.method, res.statusCode, Date.now() - start);
  });

  next();
};
