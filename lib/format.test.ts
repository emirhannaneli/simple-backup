import { describe, it, expect } from "vitest";
import { formatBytes, formatDuration } from "./format";

describe("Formatting Utilities", () => {
  describe("formatBytes", () => {
    it("should format bytes correctly", () => {
      expect(formatBytes(0)).toBe("0 Bytes");
      expect(formatBytes(1024)).toBe("1 KB");
      expect(formatBytes(1024 * 1024)).toBe("1 MB");
      expect(formatBytes(1024 * 1024 * 1024)).toBe("1 GB");
      expect(formatBytes(1234567)).toBe("1.18 MB");
    });
  });

  describe("formatDuration", () => {
    it("should format duration correctly", () => {
      expect(formatDuration(500)).toBe("500ms");
      expect(formatDuration(1500)).toBe("1.5s");
      expect(formatDuration(60000)).toBe("1m 0s");
    });
  });
});
