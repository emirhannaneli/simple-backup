/**
 * Resolve environment variables in a string
 * Supports ${VAR_NAME} and $VAR_NAME syntax
 */
export function resolveEnvVars(value: string): string {
  if (!value || typeof value !== "string") {
    return value;
  }

  // Replace ${VAR_NAME} syntax
  value = value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
    const envValue = process.env[varName.trim()];
    return envValue !== undefined ? envValue : match;
  });

  // Replace $VAR_NAME syntax (but not ${VAR_NAME} which we already handled)
  value = value.replace(/\$([A-Z_][A-Z0-9_]*)/g, (match, varName) => {
    const envValue = process.env[varName];
    return envValue !== undefined ? envValue : match;
  });

  return value;
}

/**
 * Resolve environment variables in a headers object
 */
export function resolveHeaders(headers: Record<string, string>): Record<string, string> {
  const resolved: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(headers)) {
    resolved[key] = resolveEnvVars(value);
  }
  
  return resolved;
}


