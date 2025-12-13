import { prisma } from "./prisma";
import { resolveHeaders } from "./env-resolver";

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

      // Parse custom headers if available
      const customHeaders: Record<string, string> = {};
      if (webhook.headers) {
        try {
          const parsedHeaders = JSON.parse(webhook.headers) as Record<string, string>;
          Object.assign(customHeaders, parsedHeaders);
        } catch (error) {
          console.warn(`Failed to parse headers for webhook ${webhook.id}:`, error);
        }
      }

      // Resolve environment variables in headers
      const resolvedHeaders = resolveHeaders(customHeaders);

      // Merge custom headers with default headers
      // Custom headers can override default Content-Type
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...resolvedHeaders,
      };

      const response = await fetch(webhook.url, {
        method: webhook.method,
        headers,
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

