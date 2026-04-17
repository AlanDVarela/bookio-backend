import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { env } from '../../config/env.config';

//Publicar eventos a SNS

const client = new SNSClient({ region: env.AWS_REGION });

export async function publishEvent(subject: string, message: any): Promise<void> {
  if (!env.SNS_TOPIC_ARN) {
    console.warn("SNS_TOPIC_ARN is not defined. Skipping event publish.");
    return;
  }

  try {
    await client.send(
      new PublishCommand({
        TopicArn: env.SNS_TOPIC_ARN,
        Subject: subject,
        Message: JSON.stringify(message),
      })
    );
    console.log(`Event ${subject} published to SNS.`);
  } catch (error) {
    console.error(`Failed to publish event ${subject} to SNS:`, error);
  }
}
