import { prisma } from "./prisma";
import { resolveHeaders } from "./env-resolver";

export type WebhookEvent = "JOB_SUCCESS" | "JOB_FAILURE";

export interface WebhookPayload {
  event_type: "backup-webhook";
  client_payload: {
    jobId: string;
    event: WebhookEvent;
    details: {
      file?: string | null;
      size?: string | null;
      error?: string | null;
    };
  };
}

export interface WebhookDetails {
  file?: string | null;
  size?: string | null;
  error?: string | null;
}

export async function triggerWebhooks(
  event: WebhookEvent,
  jobId: string,
  jobName: string,
  details: WebhookDetails
): Promise<void> {
  console.log(`🔔 Triggering webhooks for event: ${event}, jobId: ${jobId}`);
  
  const webhooks = await prisma.webhook.findMany({
    where: {
      isActive: true,
    },
  });

  console.log(`📋 Found ${webhooks.length} active webhook(s)`);

  if (webhooks.length === 0) {
    console.log("⚠️ No active webhooks found, skipping webhook trigger");
    return;
  }

  const payload: WebhookPayload = {
    event_type: "backup-webhook",
    client_payload: {
      jobId,
      event,
      details: {
        file: details.file || null,
        size: details.size || null,
        error: details.error || null,
      },
    },
  };

  console.log(`📤 Webhook payload:`, JSON.stringify(payload, null, 2));

  const promises = webhooks.map(async (webhook) => {
    let events: string[] = [];
    try {
      events = JSON.parse(webhook.events) as string[];
    } catch (error) {
      console.error(`❌ Failed to parse events for webhook ${webhook.id}:`, error);
      return;
    }
    
    console.log(`🔍 Webhook ${webhook.id} (${webhook.url}) subscribed to events:`, events);
    
    if (!events.includes(event)) {
      console.log(`⏭️ Webhook ${webhook.id} skipped - event ${event} not in subscribed events`);
      return;
    }

    console.log(`✅ Webhook ${webhook.id} will be triggered for event: ${event}`);

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

    // Retry logic: try up to 3 times
    const maxRetries = 3;
    let lastStatusCode: number | null = null;
    let lastResponseBody: string | null = null;
    let lastErrorMessage: string | null = null;
    let finalSuccess = false;
    const totalStartTime = Date.now();

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const attemptStartTime = Date.now();
      let attemptSuccess = false;
      let attemptStatusCode: number | null = null;
      let attemptResponseBody: string | null = null;
      let attemptErrorMessage: string | null = null;

      try {
        const response = await fetch(webhook.url, {
          method: webhook.method,
          headers,
          body: JSON.stringify(payload),
        });

        attemptStatusCode = response.status;
        attemptSuccess = response.ok;

        // Try to read response body (limit to 10KB to avoid memory issues)
        try {
          const text = await response.text();
          attemptResponseBody = text.length > 10000 ? text.substring(0, 10000) + "..." : text;
        } catch {
          // Ignore response body read errors
        }

        if (response.ok) {
          // Success - no need to retry
          console.log(`✅ Webhook ${webhook.id} succeeded on attempt ${attempt}/${maxRetries}`);
          attemptSuccess = true;
          finalSuccess = true;
          lastStatusCode = attemptStatusCode;
          lastResponseBody = attemptResponseBody;
          lastErrorMessage = null;
        } else {
          // Failed - will retry if attempts remain
          attemptErrorMessage = `HTTP ${response.status}: ${response.statusText}`;
          lastStatusCode = attemptStatusCode;
          lastResponseBody = attemptResponseBody;
          lastErrorMessage = attemptErrorMessage;
          
          if (attempt < maxRetries) {
            console.warn(`Webhook attempt ${attempt}/${maxRetries} failed for ${webhook.url}: ${attemptErrorMessage}. Retrying...`);
            // Wait before retry (exponential backoff: 1s, 2s)
            await new Promise(resolve => setTimeout(resolve, attempt * 1000));
          } else {
            console.error(`Webhook failed after ${maxRetries} attempts for ${webhook.url}: ${attemptErrorMessage}`);
          }
        }
      } catch (error: any) {
        attemptSuccess = false;
        attemptErrorMessage = error.message || "Unknown error";
        lastErrorMessage = attemptErrorMessage;
        
        if (attempt < maxRetries) {
          console.warn(`Webhook attempt ${attempt}/${maxRetries} error for ${webhook.url}: ${attemptErrorMessage}. Retrying...`);
          // Wait before retry (exponential backoff: 1s, 2s)
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        } else {
          console.error(`Webhook error after ${maxRetries} attempts for ${webhook.url}: ${attemptErrorMessage}`);
        }
      }

      // Log each attempt (including successful ones)
      const attemptDurationMs = Date.now() - attemptStartTime;
      try {
        await prisma.webhookLog.create({
          data: {
            webhookId: webhook.id,
            event,
            jobId,
            jobName,
            statusCode: attemptStatusCode,
            success: attemptSuccess,
            requestBody: JSON.stringify(payload),
            responseBody: attemptResponseBody,
            errorMessage: attemptErrorMessage,
            durationMs: attemptDurationMs,
          },
        });
        if (attemptSuccess) {
          console.log(`📝 Logged successful webhook request for ${webhook.id} (attempt ${attempt})`);
        }
      } catch (logError) {
        console.error(`Failed to log webhook attempt ${attempt} for ${webhook.id}:`, logError);
      }

      // If successful, no need to retry
      if (attemptSuccess) {
        break;
      }
    }

    // Log final result if all attempts failed (already logged individual attempts above)
    // But we can add a summary log if needed
    if (!finalSuccess) {
      const totalDurationMs = Date.now() - totalStartTime;
      console.error(`Webhook failed after ${maxRetries} attempts for ${webhook.url}. Total duration: ${totalDurationMs}ms`);
    }
  });

  const results = await Promise.allSettled(promises);
  
  // Log summary
  const successful = results.filter(r => r.status === "fulfilled").length;
  const failed = results.filter(r => r.status === "rejected").length;
  console.log(`📊 Webhook trigger summary: ${successful} successful, ${failed} failed`);
  
  // Log any rejections
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`❌ Webhook promise ${index} rejected:`, result.reason);
    }
  });
}

