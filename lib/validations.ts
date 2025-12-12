import { z } from "zod";
import { isValidCron } from "cron-validator";

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const datasourceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["MYSQL", "POSTGRES", "MONGODB"]),
  host: z.string().min(1, "Host is required"),
  port: z.number().int().min(1).max(65535),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  databaseName: z.string().min(1, "Database name is required"),
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
  isActive: z.boolean().default(true),
});

export const userSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["ADMIN", "USER"]).default("USER"),
});

