"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.authenticateJWT = void 0;
const firebase_config_1 = require("../../config/firebase.config");
const prisma_1 = require("../../database/prisma");
const authenticateJWT = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized: No token provided' });
        return;
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = await firebase_config_1.admin.auth().verifyIdToken(token);
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: decoded.uid },
            select: { id: true, role: true },
        });
        if (!user) {
            res.status(401).json({ error: 'Unauthorized: User not registered' });
            return;
        }
        req.user = { id: user.id, role: user.role };
        next();
    }
    catch (err) {
        if (err.code?.startsWith('auth/')) {
            res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
            return;
        }
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.authenticateJWT = authenticateJWT;
const requireRole = (role) => {
    return (req, res, next) => {
        if (!req.user || req.user.role !== role) {
            res.status(403).json({ error: `Forbidden: Requires ${role} role` });
            return;
        }
        next();
    };
};
exports.requireRole = requireRole;
