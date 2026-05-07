"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const firebase_config_1 = require("../../config/firebase.config");
const auth_service_1 = require("./auth.service");
const authService = new auth_service_1.AuthService();
class AuthController {
    async register(req, res) {
        const { idToken, role, name, phone } = req.body;
        if (!idToken || !role) {
            res.status(400).json({ error: 'idToken and role are required' });
            return;
        }
        if (role !== 'CLIENT' && role !== 'BUSINESS_OWNER') {
            res.status(400).json({ error: 'role must be CLIENT or BUSINESS_OWNER' });
            return;
        }
        try {
            const decoded = await firebase_config_1.admin.auth().verifyIdToken(idToken);
            const { user, created } = await authService.registerUser({
                firebaseUid: decoded.uid,
                email: decoded.email,
                name: name ?? decoded.name ?? decoded.email.split('@')[0],
                role,
                phone,
                avatarUrl: decoded.picture,
            });
            res.status(created ? 201 : 200).json({ user });
        }
        catch (err) {
            if (err.code?.startsWith('auth/')) {
                res.status(401).json({ error: 'Invalid or expired token' });
                return;
            }
            console.error('register error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    async me(req, res) {
        const profile = await authService.getProfile(req.user.id);
        if (!profile) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json({ user: profile });
    }
}
exports.AuthController = AuthController;
