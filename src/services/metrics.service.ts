import { CloudWatchClient, PutMetricDataCommand, StandardUnit } from '@aws-sdk/client-cloudwatch';
import { env } from '../config/env.config';

const client = new CloudWatchClient({ region: env.AWS_REGION });

const publish = (
  namespace: string,
  name: string,
  value: number,
  unit: StandardUnit,
  dimensions: Record<string, string> = {},
) => {
  if (process.env.NODE_ENV !== 'production') return;

  const command = new PutMetricDataCommand({
    Namespace: namespace,
    MetricData: [{
      MetricName: name,
      Value: value,
      Unit: unit,
      Timestamp: new Date(),
      Dimensions: Object.entries(dimensions).map(([Name, Value]) => ({ Name, Value })),
    }],
  });

  client.send(command).catch(() => {});
};

export const trackRequest = (route: string, method: string, statusCode: number, durationMs: number) => {
  publish('Bookio/API', 'RequestCount', 1, StandardUnit.Count, { Route: route, Method: method });
  publish('Bookio/API', 'ResponseTime', durationMs, StandardUnit.Milliseconds, { Route: route });

  if (statusCode >= 400 && statusCode < 500) {
    publish('Bookio/API', 'Error4xx', 1, StandardUnit.Count, { Route: route });
  } else if (statusCode >= 500) {
    publish('Bookio/API', 'Error5xx', 1, StandardUnit.Count, { Route: route });
  }
};

export const trackAppointmentCreated = () => {
  publish('Bookio/Business', 'AppointmentsCreated', 1, StandardUnit.Count);
};

export const trackUserRegistered = () => {
  publish('Bookio/Business', 'UsersRegistered', 1, StandardUnit.Count);
};
