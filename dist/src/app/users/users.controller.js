"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersController = void 0;
const users_service_1 = require("./users.service");
const usersService = new users_service_1.UsersService();
class UsersController {
    async getAll(req, res) {
        try {
            const users = await usersService.getAllUsers();
            res.status(200).json({ users });
        }
        catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
    async getById(req, res) {
        try {
            const id = req.params.id;
            const user = await usersService.getUserById(id);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            res.status(200).json({ user });
        }
        catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
    async uploadAvatar(req, res) {
        try {
            const { id } = req.params;
            if (req.user?.id !== id) {
                return res.status(403).json({ error: 'Forbidden' });
            }
            if (!req.file) {
                return res.status(400).json({ error: 'No image file provided' });
            }
            const { uploadUserPhoto } = require('../middlewares/s3.service');
            const avatarUrl = await uploadUserPhoto(req.file.buffer, req.file.mimetype);
            const user = await usersService.updateAvatar(id, avatarUrl);
            return res.status(200).json({ message: 'Avatar updated correctly', avatar_url: user.avatar_url });
        }
        catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal Server Error uploading avatar' });
        }
    }
    async updateProfile(req, res) {
        try {
            const userId = req.user.id;
            const { name, phone } = req.body;
            if (!name && !phone) {
                return res.status(400).json({ error: 'No data provided to update' });
            }
            const updatedUser = await usersService.updateProfile(userId, { name, phone });
            res.status(200).json({
                message: 'Profile updated successfully',
                user: updatedUser
            });
        }
        catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error updating profile' });
        }
    }
    async deleteAccount(req, res) {
        try {
            const { id } = req.params;
            if (req.user?.id !== id) {
                return res.status(403).json({ error: 'You can only delete your own account' });
            }
            await usersService.deleteUser(id);
            res.status(200).json({ message: 'User deleted successfully' });
        }
        catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error deleting user' });
        }
    }
}
exports.UsersController = UsersController;
