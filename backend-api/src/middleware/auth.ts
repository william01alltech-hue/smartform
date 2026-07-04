import { Request, Response, NextFunction } from 'express';
import { db } from '../db';

/**
 * 中介軟體：驗證 token 是否存在，並檢查其角色。
 * 若傳入 requiredRole，僅在 token 具備該角色時通過，否則回傳 403。
 */
export function verifyToken(requiredRole?: 'master' | 'member') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = (req.headers.authorization || req.body.token) as string | undefined;
    if (!token) {
      return res.status(401).json({ error: 'Token required' });
    }
    const tokenInfo = await db.getToken(token);
    if (!tokenInfo) {
      return res.status(404).json({ error: 'Invalid token' });
    }
    if (requiredRole && tokenInfo.role !== requiredRole) {
      return res.status(403).json({ error: `Only ${requiredRole} can access this endpoint` });
    }
    // 把 tokenInfo 放到 req 方便後續使用
    (req as any).tokenInfo = tokenInfo;
    next();
  };
}
