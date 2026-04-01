import { describe, it, expect } from "vitest";
import { loginSchema, datasourceSchema, jobSchema, apiKeySchema, webhookSchema } from "./validations";

describe("Validation Schemas", () => {
  describe("loginSchema", () => {
    it("should validate correct login data", () => {
      const data = { username: "admin", password: "password123" };
      expect(loginSchema.safeParse(data).success).toBe(true);
    });

    it("should fail validation for empty username", () => {
      const data = { username: "", password: "password123" };
      expect(loginSchema.safeParse(data).success).toBe(false);
    });
  });

  describe("datasourceSchema", () => {
    it("should validate SQLITE without host/port", () => {
      const data = {
        name: "Test SQLite",
        type: "SQLITE",
        databaseName: "/data/test.db"
      };
      expect(datasourceSchema.safeParse(data).success).toBe(true);
    });

    it("should fail MYSQL without host/port", () => {
      const data = {
        name: "Test MySQL",
        type: "MYSQL",
        databaseName: "mydb",
        username: "root",
        password: "password"
      };
      expect(datasourceSchema.safeParse(data).success).toBe(false);
    });

    it("should validate REDIS with host/port but without username/password", () => {
      const data = {
        name: "Test Redis",
        type: "REDIS",
        host: "localhost",
        port: 6379,
        databaseName: "0"
      };
      expect(datasourceSchema.safeParse(data).success).toBe(true);
    });
  });

  describe("jobSchema", () => {
    it("should validate correct job data", () => {
      const data = {
        title: "Daily Backup",
        datasourceIds: ["id1"],
        cronExpression: "0 0 * * *",
        destinationPath: "/backups",
        timezone: "UTC",
        isActive: true
      };
      expect(jobSchema.safeParse(data).success).toBe(true);
    });

    it("should fail validation for invalid cron expression", () => {
      const data = {
        title: "Invalid Cron",
        datasourceIds: ["id1"],
        cronExpression: "invalid-cron",
        destinationPath: "/backups"
      };
      expect(jobSchema.safeParse(data).success).toBe(false);
    });
  });

  describe("webhookSchema", () => {
    it("should validate correct webhook data", () => {
      const data = {
        name: "Slack Webhook",
        url: "https://hooks.slack.com/services/...",
        method: "POST",
        events: ["JOB_SUCCESS"]
      };
      expect(webhookSchema.safeParse(data).success).toBe(true);
    });

    it("should fail validation for invalid URL", () => {
      const data = {
        name: "Invalid URL",
        url: "not-a-url",
        events: ["JOB_FAILURE"]
      };
      expect(webhookSchema.safeParse(data).success).toBe(false);
    });

    it("should validate with valid JSON payload", () => {
      const data = {
        name: "Custom Payload",
        url: "https://example.com",
        events: ["JOB_SUCCESS"],
        payload: JSON.stringify({ key: "value" })
      };
      expect(webhookSchema.safeParse(data).success).toBe(true);
    });

    it("should fail with invalid JSON payload", () => {
      const data = {
        name: "Invalid JSON",
        url: "https://example.com",
        events: ["JOB_SUCCESS"],
        payload: "{ invalid json }"
      };
      expect(webhookSchema.safeParse(data).success).toBe(false);
    });
  });
});
