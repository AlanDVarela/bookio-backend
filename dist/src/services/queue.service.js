"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishAppointmentEvent = void 0;
const client_sqs_1 = require("@aws-sdk/client-sqs");
const env_config_1 = require("../config/env.config");
const sqs = new client_sqs_1.SQSClient({ region: env_config_1.env.AWS_REGION });
const publishAppointmentEvent = async (msg) => {
    if (!env_config_1.env.SQS_QUEUE_URL) {
        console.warn('[Queue] SQS_QUEUE_URL no configurada — correo no enviado');
        return;
    }
    await sqs.send(new client_sqs_1.SendMessageCommand({
        QueueUrl: env_config_1.env.SQS_QUEUE_URL,
        MessageBody: JSON.stringify(msg),
    }));
};
exports.publishAppointmentEvent = publishAppointmentEvent;
