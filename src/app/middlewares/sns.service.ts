import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { env } from '../../config/env.config';

const client = new SNSClient({
  region: env.AWS_REGION,
  credentials: env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
    ? {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      sessionToken: env.AWS_SESSION_TOKEN,
    }
    : undefined,
});

interface AppointmentEvent {
  appointmentId: string;
  businessId: string;
  clientId: string;
  startDatetime: string;
}

// Función para formatear el mensaje bonito
function formatMessage(subject: string, data: any): string {
  if (
    data?.appointmentId &&
    data?.businessId &&
    data?.clientId &&
    data?.startDatetime
  ) {
    const fecha = new Date(data.startDatetime).toLocaleString('es-MX');

    return `
📅 ${subject}

ID de la cita: ${data.appointmentId}
Negocio: ${data.businessId}
Cliente: ${data.clientId}
Fecha y hora: ${fecha}
    `;
  }


  return JSON.stringify(data, null, 2);
}

// Publicar evento
export async function publishEvent(
  subject: string,
  message: unknown
): Promise<void> {
  if (!env.SNS_TOPIC_ARN) {
    console.warn('SNS_TOPIC_ARN is not defined. Skipping event publish.');
    return;
  }

  try {
    const formattedMessage = formatMessage(subject, message);

    await client.send(
      new PublishCommand({
        TopicArn: env.SNS_TOPIC_ARN,
        Subject: subject,
        Message: formattedMessage,
      })
    );

    console.log(`Event ${subject} published to SNS.`);
  } catch (error) {
    console.error(`Failed to publish event ${subject} to SNS:`, error);
  }
}