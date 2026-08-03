import { Request, Response, NextFunction } from 'express';

export function verifySuperAdmin(req: Request, res: Response, next: NextFunction): void {
  const superAdminToken = process.env.SUPER_ADMIN_TOKEN;
  if (!superAdminToken) {
    console.error('SUPER_ADMIN_TOKEN is not configured on the server.');
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  // Check query param first
  let token = req.query.token as string;

  // Then check Authorization header
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (token === superAdminToken) {
    next();
  } else {
    res.status(403).json({ error: 'Forbidden: Invalid super admin token' });
  }
}
