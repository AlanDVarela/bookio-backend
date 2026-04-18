import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { env } from '../../config/env.config';

//Obtener secretos de AWS Secrets Manager

const client = new SecretsManagerClient({ region: env.AWS_REGION });

export async function getSecret(secretName: string): Promise<string | null> {
  try {
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: secretName,
      })
    );
    return response.SecretString || null;
  } catch (error) {
    console.error(`Error retrieving secret ${secretName}:`, error);
    return null;
  }
}
