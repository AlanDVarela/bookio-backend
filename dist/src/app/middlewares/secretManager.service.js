"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSecret = getSecret;
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
const env_config_1 = require("../../config/env.config");
//Obtener secretos de AWS Secrets Manager
const client = new client_secrets_manager_1.SecretsManagerClient({ region: env_config_1.env.AWS_REGION });
async function getSecret(secretName) {
    try {
        const response = await client.send(new client_secrets_manager_1.GetSecretValueCommand({
            SecretId: secretName,
        }));
        return response.SecretString || null;
    }
    catch (error) {
        console.error(`Error retrieving secret ${secretName}:`, error);
        return null;
    }
}
