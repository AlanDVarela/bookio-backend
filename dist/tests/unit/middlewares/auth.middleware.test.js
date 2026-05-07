"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
jest.mock('../../../src/config/firebase.config', () => ({
    admin: { auth: () => ({ verifyIdToken: jest.fn() }) },
}));
jest.mock('../../../src/database/prisma', () => ({
    prisma: { user: { findUnique: jest.fn() } },
}));
const auth_middleware_1 = require("../../../src/app/middlewares/auth.middleware");
function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}
describe('authenticateJWT', () => {
    it('should return 401 when no Authorization header is present', async () => {
        const req = { headers: {} };
        const res = mockRes();
        const next = jest.fn();
        await (0, auth_middleware_1.authenticateJWT)(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });
    it('should return 401 when Authorization header does not start with Bearer', async () => {
        const req = { headers: { authorization: 'Basic abc123' } };
        const res = mockRes();
        const next = jest.fn();
        await (0, auth_middleware_1.authenticateJWT)(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });
});
describe('requireRole', () => {
    it('should return 403 when user role does not match', () => {
        const middleware = (0, auth_middleware_1.requireRole)('BUSINESS_OWNER');
        const req = { user: { id: 'user-1', role: 'CLIENT' } };
        const res = mockRes();
        const next = jest.fn();
        middleware(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });
    it('should call next() when user role matches', () => {
        const middleware = (0, auth_middleware_1.requireRole)('BUSINESS_OWNER');
        const req = { user: { id: 'user-1', role: 'BUSINESS_OWNER' } };
        const res = mockRes();
        const next = jest.fn();
        middleware(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });
    it('should return 403 when user is not set on request', () => {
        const middleware = (0, auth_middleware_1.requireRole)('CLIENT');
        const req = {};
        const res = mockRes();
        const next = jest.fn();
        middleware(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });
});
