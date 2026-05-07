"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopSQSWorker = exports.startSQSWorker = void 0;
const client_sqs_1 = require("@aws-sdk/client-sqs");
const email_service_1 = require("../services/email.service");
const env_config_1 = require("../config/env.config");
const sqs = new client_sqs_1.SQSClient({ region: env_config_1.env.AWS_REGION });
let isRunning = false;
const processMessage = async (body, receiptHandle) => {
    const data = JSON.parse(body);
    await (0, email_service_1.sendAppointmentEmail)(data);
    // Eliminar mensaje de la cola solo después de procesarlo exitosamente
    await sqs.send(new client_sqs_1.DeleteMessageCommand({
        QueueUrl: env_config_1.env.SQS_QUEUE_URL,
        ReceiptHandle: receiptHandle,
    }));
};
const poll = async () => {
    if (!isRunning)
        return;
    try {
        // Long polling: espera hasta 20s si no hay mensajes (reduce costo de requests)
        const result = await sqs.send(new client_sqs_1.ReceiveMessageCommand({
            QueueUrl: env_config_1.env.SQS_QUEUE_URL,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 20,
        }));
        if (result.Messages?.length) {
            await Promise.allSettled(result.Messages.map((msg) => processMessage(msg.Body, msg.ReceiptHandle).catch((err) => console.error(`[SQS] Error procesando mensaje ${msg.MessageId}:`, err))));
        }
    }
    catch (err) {
        // No detener el worker por errores transitorios (ej: credenciales rotando)
        console.error('[SQS] Error en poll:', err);
        await new Promise((r) => setTimeout(r, 5000));
    }
    // Continuar inmediatamente (long polling ya maneja la espera)
    setImmediate(poll);
};
const startSQSWorker = () => {
    if (!env_config_1.env.SQS_QUEUE_URL) {
        console.warn('[SQS] SQS_QUEUE_URL no configurada — worker de citas deshabilitado');
        return;
    }
    isRunning = true;
    console.log('[SQS] Worker de citas iniciado:', env_config_1.env.SQS_QUEUE_URL);
    poll();
};
exports.startSQSWorker = startSQSWorker;
const stopSQSWorker = () => {
    isRunning = false;
};
exports.stopSQSWorker = stopSQSWorker;
