import { exec } from "child_process";
import { promisify } from "util";
import { existsSync, readFileSync } from "fs";

const execAsync = promisify(exec);

export interface ClientCheckResult {
  installed: boolean;
  command?: string;
  installCommand?: string;
}

/**
 * Check if a database client tool is installed
 */
export async function checkClientInstalled(
  dbType: string
): Promise<ClientCheckResult> {
  const clientCommands: Record<string, string> = {
    MYSQL: "mysql",
    POSTGRES: "psql",
    MONGODB: "mongosh",
    REDIS: "redis-cli",
    CASSANDRA: "cqlsh",
    ELASTICSEARCH: "curl",
    INFLUXDB: "influx",
    NEO4J: "cypher-shell",
    SQLITE: "sqlite3",
    H2: "java",
  };

  const command = clientCommands[dbType];
  if (!command) {
    return { installed: false };
  }

  try {
    // Check if command exists and is executable
    await execAsync(`which ${command} || command -v ${command}`);
    return { installed: true, command };
  } catch {
    return { installed: false, command };
  }
}

/**
 * Get install command for a database client (Alpine Linux)
 */
export function getInstallCommand(dbType: string): string | null {
  const installCommands: Record<string, string | null> = {
    MYSQL: "apk add --no-cache mysql-client",
    POSTGRES: "apk add --no-cache postgresql-client",
    MONGODB: "apk add --no-cache mongodb-tools",
    REDIS: "apk add --no-cache redis",
    CASSANDRA: "apk add --no-cache cassandra-tools",
    ELASTICSEARCH: "apk add --no-cache curl", // Usually pre-installed
    INFLUXDB: null, // Requires manual download
    NEO4J: null, // Requires manual download
    SQLITE: "apk add --no-cache sqlite",
    H2: "apk add --no-cache openjdk17-jre", // Java for H2
  };

  return installCommands[dbType] || null;
}

/**
 * Check if we're running in a Docker container
 */
function isDockerContainer(): boolean {
  // Check for Docker-specific files/environment
  try {
    return existsSync('/.dockerenv') || 
           (existsSync('/proc/self/cgroup') && 
            readFileSync('/proc/self/cgroup', 'utf8').includes('docker'));
  } catch {
    return process.env.DOCKER === "true" || 
           process.env.IN_DOCKER === "true" ||
           process.env.NODE_ENV === "production";
  }
}

/**
 * Check if running as root user
 */
function isRootUser(): boolean {
  try {
    return process.getuid ? process.getuid() === 0 : false;
  } catch {
    return false;
  }
}

/**
 * Install a database client tool (requires root/sudo)
 * 
 * SECURITY NOTE: Runtime package installation is disabled for security reasons.
 * - In Docker containers, packages should be installed during build (Dockerfile)
 * - Runtime installation requires root privileges which is a security risk
 * - This function only checks and provides instructions, it does NOT install packages
 */
export async function installClient(dbType: string): Promise<{
  success: boolean;
  message: string;
  canInstall: boolean;
}> {
  const checkResult = await checkClientInstalled(dbType);
  
  if (checkResult.installed) {
    return {
      success: true,
      message: `${checkResult.command} is already installed`,
      canInstall: false,
    };
  }

  const installCmd = getInstallCommand(dbType);
  
  if (!installCmd) {
    return {
      success: false,
      message: `Cannot auto-install client for ${dbType}. This client requires manual installation.`,
      canInstall: false,
    };
  }

  // SECURITY: Disable runtime package installation
  // Always require packages to be installed in Dockerfile during build
  const inDocker = isDockerContainer();
  const isRoot = isRootUser();
  
  if (inDocker) {
    return {
      success: false,
      message: `Client for ${dbType} is not installed. For security reasons, packages cannot be installed at runtime in Docker containers. Please add "${installCmd}" to your Dockerfile and rebuild the image.`,
      canInstall: false,
    };
  }

  // Even outside Docker, we should be cautious about runtime installation
  // Only allow if explicitly enabled via environment variable
  const allowRuntimeInstall = process.env.ALLOW_RUNTIME_CLIENT_INSTALL === "true";
  
  if (!allowRuntimeInstall) {
    return {
      success: false,
      message: `Client for ${dbType} is not installed. Runtime package installation is disabled for security. Please install "${checkResult.command}" manually or set ALLOW_RUNTIME_CLIENT_INSTALL=true (not recommended).`,
      canInstall: false,
    };
  }

  // Only proceed if explicitly allowed (development/testing only)
  if (!isRoot) {
    return {
      success: false,
      message: `Client for ${dbType} is not installed. Installation requires root privileges. Please install "${checkResult.command}" manually or add "${installCmd}" to your Dockerfile.`,
      canInstall: false,
    };
  }

  // This should never be reached in production, but kept for development/testing
  try {
    await execAsync(installCmd, { timeout: 60000 });
    return {
      success: true,
      message: `Successfully installed client for ${dbType}`,
      canInstall: true,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to install client: ${error.message || "Permission denied or package not found"}. Please add "${installCmd}" to your Dockerfile.`,
      canInstall: false,
    };
  }
}

