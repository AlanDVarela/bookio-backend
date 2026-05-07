import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from '@aws-sdk/client-sqs';
import { sendAppointmentEmail, AppointmentEmailData } from '../services/email.service';
import { env } from '../config/env.config';

const sqs = new SQSClient({ region: env.AWS_REGION });

// Mensaje que se publica en SQS al crear/cambiar estado de una cita
export interface AppointmentQueueMessage extends AppointmentEmailData {
  appointmentId: string;
}

let isRunning = false;

const processMessage = async (body: string, receiptHandle: string) => {
  const data: AppointmentQueueMessage = JSON.parse(body);

  await sendAppointmentEmail(data);

  // Eliminar mensaje de la cola solo después de procesarlo exitosamente
  await sqs.send(
    new DeleteMessageCommand({
      QueueUrl: env.SQS_QUEUE_URL,
      ReceiptHandle: receiptHandle,
    }),
  );
};

const poll = async () => {
  if (!isRunning) return;

  try {
    // Long polling: espera hasta 20s si no hay mensajes (reduce costo de requests)
    const result = await sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: env.SQS_QUEUE_URL,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 20,
      }),
    );

    if (result.Messages?.length) {
      await Promise.allSettled(
        result.Messages.map((msg) =>
          processMessage(msg.Body!, msg.ReceiptHandle!).catch((err) =>
            console.error(`[SQS] Error procesando mensaje ${msg.MessageId}:`, err),
          ),
        ),
      );
    }
  } catch (err) {
    // No detener el worker por errores transitorios (ej: credenciales rotando)
    console.error('[SQS] Error en poll:', err);
    await new Promise((r) => setTimeout(r, 5000));
  }

  // Continuar inmediatamente (long polling ya maneja la espera)
  setImmediate(poll);
};

export const startSQSWorker = () => {
  if (!env.SQS_QUEUE_URL) {
    console.warn('[SQS] SQS_QUEUE_URL no configurada — worker de citas deshabilitado');
    return;
  }
  isRunning = true;
  console.log('[SQS] Worker de citas iniciado:', env.SQS_QUEUE_URL);
  poll();
};

export const stopSQSWorker = () => {
  isRunning = false;
};
