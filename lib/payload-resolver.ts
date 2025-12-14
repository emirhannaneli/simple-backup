/**
 * Resolves variables in a webhook payload template
 * Supports variables like ${jobId}, ${event}, ${jobName}, ${file}, ${size}, ${error}, ${timestamp}
 * 
 * Variables can be used in:
 * - String values: "Job ID: ${jobId}"
 * - Object keys: { "${jobId}_backup": "data" }
 * - Anywhere in the JSON structure
 */

export interface PayloadVariables {
  jobId: string;
  event: string;
  jobName: string;
  file?: string | null;
  size?: string | null;
  error?: string | null;
  timestamp?: string;
}

/**
 * Resolves variables in a string value
 * Supports ${VAR_NAME} syntax
 */
function resolveStringValue(value: string, variables: PayloadVariables): string {
  return value.replace(/\$\{(\w+)\}/g, (match, varName) => {
    const varKey = varName as keyof PayloadVariables;
    if (varKey in variables) {
      const varValue = variables[varKey];
      // If value is null or undefined, return empty string instead of the variable placeholder
      if (varValue === null || varValue === undefined) {
        return "";
      }
      return String(varValue);
    }
    // If variable not found, return the placeholder as-is
    return match;
  });
}

/**
 * Recursively resolves variables in a JSON object
 */
function resolveObject(obj: any, variables: PayloadVariables): any {
  if (typeof obj === "string") {
    const resolved = resolveStringValue(obj, variables);
    // If the resolved string is empty and original was a variable placeholder, return null
    // This handles cases like "${size}" when size is null -> becomes "" -> should be null
    if (resolved === "" && obj.match(/^\$\{\w+\}$/)) {
      return null;
    }
    return resolved;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => resolveObject(item, variables));
  }
  
  if (obj !== null && typeof obj === "object") {
    const resolved: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Resolve variables in keys as well
      const resolvedKey = resolveStringValue(key, variables);
      const resolvedValue = resolveObject(value, variables);
      resolved[resolvedKey] = resolvedValue;
    }
    return resolved;
  }
  
  return obj;
}

/**
 * Resolves variables in a payload template string
 * @param payloadTemplate JSON string template with variables
 * @param variables Variables to replace
 * @returns Resolved payload object
 */
export function resolvePayload(
  payloadTemplate: string | null | undefined,
  variables: PayloadVariables
): any {
  // If no custom payload, return null (will use default)
  if (!payloadTemplate || payloadTemplate.trim() === "") {
    return null;
  }

  try {
    // Parse the JSON template
    const template = JSON.parse(payloadTemplate);
    
    // Resolve all variables in the template
    return resolveObject(template, variables);
  } catch (error) {
    console.error("Failed to parse or resolve payload template:", error);
    throw new Error(`Invalid payload template: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Get default payload structure
 */
export function getDefaultPayload(variables: PayloadVariables): any {
  return {
    event_type: "backup-webhook",
    client_payload: {
      jobId: variables.jobId,
      event: variables.event,
      details: {
        file: variables.file || null,
        size: variables.size || null,
        error: variables.error || null,
      },
    },
  };
}

