import { Request, Response, NextFunction } from 'express';

jest.mock('../../../src/config/firebase.config', () => ({
  admin: { auth: () => ({ verifyIdToken: jest.fn() }) },
}));

jest.mock('../../../src/database/prisma', () => ({
  prisma: { user: { findUnique: jest.fn() } },
}));

import { authenticateJWT, requireRole, AuthenticatedRequest } from '../../../src/app/middlewares/auth.middleware';

function mockRes(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('authenticateJWT', () => {
  it('should return 401 when no Authorization header is present', async () => {
    const req = { headers: {} } as AuthenticatedRequest;
    const res = mockRes();
    const next = jest.fn() as NextFunction;
    await authenticateJWT(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when Authorization header does not start with Bearer', async () => {
    const req = { headers: { authorization: 'Basic abc123' } } as AuthenticatedRequest;
    const res = mockRes();
    const next = jest.fn() as NextFunction;
    await authenticateJWT(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireRole', () => {
  it('should return 403 when user role does not match', () => {
    const middleware = requireRole('BUSINESS_OWNER');
    const req = { user: { id: 'user-1', role: 'CLIENT' as const } } as AuthenticatedRequest;
    const res = mockRes();
    const next = jest.fn() as NextFunction;
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next() when user role matches', () => {
    const middleware = requireRole('BUSINESS_OWNER');
    const req = { user: { id: 'user-1', role: 'BUSINESS_OWNER' as const } } as AuthenticatedRequest;
    const res = mockRes();
    const next = jest.fn() as NextFunction;
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 403 when user is not set on request', () => {
    const middleware = requireRole('CLIENT');
    const req = {} as AuthenticatedRequest;
    const res = mockRes();
    const next = jest.fn() as NextFunction;
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
