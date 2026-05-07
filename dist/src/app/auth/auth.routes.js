"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
const controller = new auth_controller_1.AuthController();
// Called once after Firebase sign-up (email/password or Google) to persist the user in our DB
router.post('/register', (req, res) => controller.register(req, res));
// Returns the current user's profile (requires valid Firebase token)
router.get('/me', auth_middleware_1.authenticateJWT, (req, res) => controller.me(req, res));
exports.default = router;
