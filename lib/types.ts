import type { Job, Datasource, Backup, ApiKey, Webhook, User } from "@prisma/client";

// Job types
export type JobWithDatasource = Job & {
  datasource: Pick<Datasource, "id" | "name" | "type">;
  _count?: {
    backups: number;
  };
};

export type JobWithBackups = Job & {
  datasource: Datasource;
  backups: Backup[];
};

// Datasource types
export type DatasourceWithCount = Datasource & {
  _count: {
    jobs: number;
  };
};

// Backup types
export type BackupWithJob = Backup & {
  job: Pick<Job, "id" | "title">;
};

// Webhook types
export type WebhookWithEvents = Webhook & {
  events: string[];
};

// API Response types
export interface ApiError {
  error: string;
}

export interface ApiSuccess<T = unknown> {
  [key: string]: T;
}

// Form data types
export interface JobFormData {
  title: string;
  datasourceId: string;
  cronExpression: string;
  destinationPath: string;
  isActive: boolean;
}

export interface DatasourceFormData {
  name: string;
  type: "MYSQL" | "POSTGRES" | "MONGODB";
  host: string;
  port: number;
  username: string;
  password: string;
  databaseName: string;
}

export interface WebhookFormData {
  url: string;
  method: "GET" | "POST" | "PUT" | "PATCH";
  events: ("JOB_SUCCESS" | "JOB_FAILURE")[];
  isActive: boolean;
}

export interface UserFormData {
  username: string;
  password: string;
  role: "ADMIN" | "USER";
}

export interface ApiKeyFormData {
  name: string;
}

