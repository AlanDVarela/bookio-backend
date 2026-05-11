import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { AppointmentQueueMessage } from '../workers/sqs.worker';
import { sendAppointmentEmail } from './email.service';
import { env } from '../config/env.config';

const sqs = new SQSClient({ region: env.AWS_REGION });

export const publishAppointmentEvent = async (msg: AppointmentQueueMessage): Promise<void> => {
  if (process.env.NODE_ENV !== 'production') {
    await sendAppointmentEmail(msg);
    return;
  }

  if (!env.SQS_QUEUE_URL) {
    console.warn('[Queue] SQS_QUEUE_URL no configurada — correo no enviado');
    return;
  }

  await sqs.send(
    new SendMessageCommand({
      QueueUrl: env.SQS_QUEUE_URL,
      MessageBody: JSON.stringify(msg),
    }),
  );
};
