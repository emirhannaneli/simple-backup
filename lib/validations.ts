import { z } from "zod";
import { isValidCron } from "cron-validator";

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const datasourceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["MYSQL", "POSTGRES", "MONGODB", "REDIS", "CASSANDRA", "ELASTICSEARCH", "INFLUXDB", "NEO4J", "SQLITE", "H2"]),
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  databaseName: z.string().min(1, "Database name/path is required"),
}).refine((data) => {
  // SQLite and H2 (file-based) don't require host/port
  if (data.type === "SQLITE") {
    return true; // No host/port needed
  }
  // H2 file-based doesn't need host/port, but server-based does
  if (data.type === "H2" && data.databaseName?.startsWith("jdbc:h2:file:")) {
    return true; // File-based H2
  }
  // Redis doesn't require username/password (optional)
  if (data.type === "REDIS") {
    return data.host && data.port; // Host and port required
  }
  // All other types require host and port
  return data.host && data.port;
}, {
  message: "Host and port are required for this database type",
  path: ["host"],
}).refine((data) => {
  // Most databases require username, except Redis (optional) and SQLite (not applicable)
  if (data.type === "SQLITE" || data.type === "REDIS") {
    return true;
  }
  // H2 file-based doesn't require username
  if (data.type === "H2" && data.databaseName?.startsWith("jdbc:h2:file:")) {
    return true;
  }
  return !!data.username;
}, {
  message: "Username is required for this database type",
  path: ["username"],
}).refine((data) => {
  // Most databases require password, except Redis (optional) and SQLite (not applicable)
  if (data.type === "SQLITE" || data.type === "REDIS") {
    return true;
  }
  // H2 file-based doesn't require password
  if (data.type === "H2" && data.databaseName?.startsWith("jdbc:h2:file:")) {
    return true;
  }
  return !!data.password;
}, {
  message: "Password is required for this database type",
  path: ["password"],
});

export const jobSchema = z.object({
  title: z.string().min(1, "Title is required"),
  datasourceId: z.string().min(1, "Datasource is required"),
  cronExpression: z.string().refine(
    (val) => isValidCron(val),
    "Invalid cron expression"
  ),
  destinationPath: z.string().min(1, "Destination path is required"),
  isActive: z.boolean().default(true),
});

export const apiKeySchema = z.object({
  name: z.string().min(1, "Name is required"),
});

export const webhookSchema = z.object({
  url: z.string().url("Invalid URL"),
  method: z.enum(["GET", "POST", "PUT", "PATCH"]).default("POST"),
  events: z.array(z.enum(["JOB_SUCCESS", "JOB_FAILURE"])).min(1, "At least one event is required"),
  headers: z.record(z.string(), z.string()).optional(), // Key-value pairs for custom headers
  isActive: z.boolean().default(true),
});

export const userSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["ADMIN", "USER"]).default("USER"),
});

