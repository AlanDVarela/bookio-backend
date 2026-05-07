"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reviews_controller_1 = require("./reviews.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
const controller = new reviews_controller_1.ReviewsController();
// crear review
router.post('/', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRole)('CLIENT'), controller.createReview);
// obtener reviews
router.get('/business/:businessId', controller.getBusinessReviews);
exports.default = router;
