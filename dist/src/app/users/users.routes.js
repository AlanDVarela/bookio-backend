"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const users_controller_1 = require("./users.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const router = (0, express_1.Router)();
const usersController = new users_controller_1.UsersController();
// GET - Consultas
router.get('/', auth_middleware_1.authenticateJWT, usersController.getAll);
router.get('/:id', auth_middleware_1.authenticateJWT, usersController.getById);
// PUT - Actualización de perfil 
router.put('/profile', auth_middleware_1.authenticateJWT, usersController.updateProfile);
// PATCH 
router.patch('/:id/avatar', auth_middleware_1.authenticateJWT, upload_middleware_1.uploadSettings.single('photo'), usersController.uploadAvatar);
// DELETE - Eliminar cuenta
router.delete('/:id', auth_middleware_1.authenticateJWT, usersController.deleteAccount);
exports.default = router;
