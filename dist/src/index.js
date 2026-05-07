"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const secrets_config_1 = require("./config/secrets.config");
const env_config_1 = require("./config/env.config");
const routes_1 = __importDefault(require("./app/routes"));
const prisma_1 = require("./database/prisma");
const sqs_worker_1 = require("./workers/sqs.worker");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: [
        "http://localhost:5173",
        "http://localhost:5000",
        "http://bookio-static-website.s3-website-us-east-1.amazonaws.com",
        "https://bookio-static-website.s3.us-east-1.amazonaws.com",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
}));
app.use(express_1.default.json());
app.use('/api/v1', routes_1.default);
app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'OK' });
});
// Exportar para tests (Jest importa el módulo sin ejecutar el IIFE de abajo)
exports.default = app;
if (process.env.NODE_ENV !== 'test') {
    (async () => {
        // 1. En producción carga las vars desde Secrets Manager antes de usarlas.
        //    En desarrollo es un no-op; usa el .env directamente.
        await (0, secrets_config_1.loadSecretsIntoEnv)();
        // 2. Ahora que process.env tiene DATABASE_URL (del .env o de Secrets Manager),
        //    Prisma se inicializa de forma lazy en la primera llamada a $connect().
        await prisma_1.prisma.$connect();
        console.log('Database connected successfully');
        (0, sqs_worker_1.startSQSWorker)();
        app.listen(env_config_1.env.PORT, () => {
            console.log(`[Server] Bookio Backend running on port ${env_config_1.env.PORT}`);
        });
    })().catch((err) => {
        console.error('[Startup] Fatal error:', err);
        process.exit(1);
    });
}
