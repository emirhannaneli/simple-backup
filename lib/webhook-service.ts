import { prisma } from "./prisma";

export type WebhookEvent = "JOB_SUCCESS" | "JOB_FAILURE";

export interface WebhookPayload {
  event: WebhookEvent;
  jobId: string;
  jobName: string;
  timestamp: string;
  details: {
    file?: string;
    size?: string;
    error?: string;
  };
}

export async function triggerWebhooks(
  event: WebhookEvent,
  jobId: string,
  jobName: string,
  details: WebhookPayload["details"]
): Promise<void> {
  const webhooks = await prisma.webhook.findMany({
    where: {
      isActive: true,
    },
  });

  const payload: WebhookPayload = {
    event,
    jobId,
    jobName,
    timestamp: new Date().toISOString(),
    details,
  };

  const promises = webhooks.map(async (webhook) => {
    try {
      const events = JSON.parse(webhook.events) as string[];
      
      if (!events.includes(event)) {
        return;
      }

      const response = await fetch(webhook.url, {
        method: webhook.method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error(`Webhook failed for ${webhook.url}: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`Error triggering webhook ${webhook.url}:`, error);
    }
  });

  await Promise.allSettled(promises);
}

