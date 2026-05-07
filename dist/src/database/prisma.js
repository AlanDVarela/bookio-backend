"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
// Lazy initialization: el cliente se crea la primera vez que se usa,
// no cuando se importa este módulo. Así loadSecretsIntoEnv() puede
// inyectar DATABASE_URL antes de que Prisma lo lea.
const createClient = () => {
    const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new adapter_pg_1.PrismaPg(pool);
    return new client_1.PrismaClient({ adapter });
};
let _instance;
exports.prisma = new Proxy({}, {
    get(_target, prop) {
        if (!_instance)
            _instance = createClient();
        const value = _instance[prop];
        return typeof value === 'function' ? value.bind(_instance) : value;
    },
});
