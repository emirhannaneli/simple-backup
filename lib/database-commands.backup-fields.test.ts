import { describe, it, expect } from "vitest";
import { getMissingBackupConnectionFields, type DatabaseConnection } from "./database-commands";

describe("getMissingBackupConnectionFields", () => {
  it("returns username when missing for PostgreSQL", () => {
    const conn: DatabaseConnection = {
      type: "POSTGRES",
      host: "db",
      port: 5432,
      databaseName: "app",
      password: "secret",
    };
    expect(getMissingBackupConnectionFields(conn)).toEqual(["username"]);
  });

  it("returns empty when PostgreSQL has all required fields", () => {
    const conn: DatabaseConnection = {
      type: "POSTGRES",
      host: "db",
      port: 5432,
      username: "u",
      password: "p",
      databaseName: "app",
    };
    expect(getMissingBackupConnectionFields(conn)).toEqual([]);
  });

  it("returns username when missing for MongoDB", () => {
    const conn: DatabaseConnection = {
      type: "MONGODB",
      host: "mongo",
      port: 27017,
      password: "p",
      databaseName: "mydb",
    };
    expect(getMissingBackupConnectionFields(conn)).toEqual(["username"]);
  });

  it("returns empty for MongoDB with username", () => {
    const conn: DatabaseConnection = {
      type: "MONGODB",
      host: "mongo",
      port: 27017,
      username: "root",
      password: "p",
      databaseName: "mydb",
    };
    expect(getMissingBackupConnectionFields(conn)).toEqual([]);
  });

  it("only requires host and port for Redis", () => {
    expect(
      getMissingBackupConnectionFields({
        type: "REDIS",
        host: "r",
        port: 6379,
        databaseName: "0",
      })
    ).toEqual([]);
  });

  it("flags missing port for Redis", () => {
    expect(
      getMissingBackupConnectionFields({
        type: "REDIS",
        host: "r",
        port: 0,
        databaseName: "0",
      })
    ).toEqual(["port"]);
  });
});
