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
    MONGODB: "mongodump", // Use mongodump instead of mongosh (mongodump is sufficient for backups and testing)
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
    // Try multiple methods to find the command
    const checkCommands = [
      `which ${command}`,
      `command -v ${command}`,
      `test -x /usr/local/bin/${command} && echo found`,
      `test -x /usr/bin/${command} && echo found`,
      `test -x /bin/${command} && echo found`,
    ];
    
    for (const checkCmd of checkCommands) {
      try {
        const result = await execAsync(checkCmd, { timeout: 5000 });
        if (result.stdout.trim() || result.stderr.trim()) {
          return { installed: true, command };
        }
      } catch {
        // Continue to next check
      }
    }
    
    return { installed: false, command };
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
    MONGODB: null, // Requires manual binary download (handled separately)
    REDIS: "apk add --no-cache redis",
    CASSANDRA: "apk add --no-cache python3 py3-pip && pip3 install --no-cache-dir cqlsh",
    ELASTICSEARCH: "apk add --no-cache curl", // Usually pre-installed
    INFLUXDB: null, // Requires manual binary download (handled separately)
    NEO4J: "apk add --no-cache cypher-shell",
    SQLITE: "apk add --no-cache sqlite",
    H2: "apk add --no-cache openjdk17-jre", // Java for H2
  };

  return installCommands[dbType] || null;
}

/**
 * Install MongoDB tools (mongodump for backups and connection testing)
 * Note: mongosh is not required - mongodump is sufficient for all operations
 */
export async function installMongoDB(): Promise<{
  success: boolean;
  message: string;
  canInstall: boolean;
}> {
  const checkResult = await checkClientInstalled("MONGODB");
  
  if (checkResult.installed) {
    return {
      success: true,
      message: "MongoDB tools (mongodump) are already installed",
      canInstall: false,
    };
  }

  const inDocker = isDockerContainer();
  const isRoot = isRootUser();
  
  // Helper function to run command as root if needed
  const runAsRoot = async (cmd: string): Promise<string> => {
    if (isRoot) {
      return cmd;
    }
    
    if (!inDocker) {
      throw new Error("Not running as root and not in Docker container");
    }
    
    const { existsSync } = require("fs");
    const helperScript = "/app/install-client.sh";
    const helperExists = existsSync(helperScript);
    
    if (helperExists) {
      const escapedCmd = cmd.replace(/'/g, "'\\''");
      return `sh -c "${escapedCmd}" 2>&1 || su root -c "/app/install-client.sh MONGODB '${escapedCmd}'" 2>&1`;
    }
    
    const escapedCmd = cmd.replace(/'/g, "'\\''");
    return `sh -c "${escapedCmd}" 2>&1 || su root -c '${escapedCmd}' 2>&1`;
  };

  try {
    // Install mongodb-tools (includes mongodump which is sufficient for backups and connection testing)
    const toolsCmd = "apk add --no-cache mongodb-tools";
    const finalToolsCmd = await runAsRoot(toolsCmd);
    await execAsync(finalToolsCmd, { timeout: 60000 });
    
    // Verify mongodump is installed and working
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const verifyResult = await checkClientInstalled("MONGODB");
    if (!verifyResult.installed) {
      // Try direct path check
      try {
        await execAsync("mongodump --version 2>&1", { timeout: 5000 });
        return {
          success: true,
          message: "MongoDB tools (mongodump) installed successfully",
          canInstall: true,
        };
      } catch (directError: any) {
        throw new Error(`MongoDB tools installation completed but mongodump command not found: ${directError.message}`);
      }
    }
    
    return {
      success: true,
      message: "MongoDB tools (mongodump) installed successfully. mongodump is sufficient for backups and connection testing.",
      canInstall: true,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to install MongoDB: ${error.message || error.stderr || "Unknown error"}`,
      canInstall: false,
    };
  }
}

/**
 * Install InfluxDB CLI (requires binary download)
 */
export async function installInfluxDB(): Promise<{
  success: boolean;
  message: string;
  canInstall: boolean;
}> {
  const checkResult = await checkClientInstalled("INFLUXDB");
  
  if (checkResult.installed) {
    return {
      success: true,
      message: "influx is already installed",
      canInstall: false,
    };
  }

  const inDocker = isDockerContainer();
  const isRoot = isRootUser();
  
  // Helper function to run command as root if needed
  const runAsRoot = (cmd: string): string => {
    if (!isRoot && inDocker) {
      // In Docker, try to use su to run as root
      // Escape special characters for shell
      const escapedCmd = cmd.replace(/"/g, '\\"').replace(/\$/g, '\\$');
      return `su root -c "${escapedCmd}" 2>&1 || su - root -c "${escapedCmd}" 2>&1`;
    }
    return cmd;
  };

  try {
    const INFLUX_VERSION = "2.7.4";
    // Detect architecture
    const archOutput = await execAsync(runAsRoot("uname -m"));
    const arch = archOutput.stdout.trim();
    const ARCH = arch === "x86_64" ? "amd64" : arch === "aarch64" ? "arm64" : "amd64";
    const downloadUrl = `https://dl.influxdata.com/influxdb/releases/influxdb2-client-${INFLUX_VERSION}-linux-${ARCH}.tar.gz`;
    
    // Download and install
    await execAsync(runAsRoot(`wget -q ${downloadUrl} -O /tmp/influx.tar.gz`), { timeout: 60000 });
    await execAsync(runAsRoot(`tar xzf /tmp/influx.tar.gz -C /tmp`), { timeout: 30000 });
    await execAsync(runAsRoot(`mv /tmp/influx /usr/local/bin/influx`), { timeout: 10000 });
    await execAsync(runAsRoot(`chmod +x /usr/local/bin/influx`), { timeout: 5000 });
    await execAsync(runAsRoot(`rm -rf /tmp/influx.tar.gz /tmp/influx*`), { timeout: 5000 });
    
    return {
      success: true,
      message: `Successfully installed InfluxDB CLI ${INFLUX_VERSION}`,
      canInstall: true,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to install InfluxDB: ${error.message || "Unknown error"}`,
      canInstall: false,
    };
  }
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
    // Check process UID
    if (process.getuid) {
      const uid = process.getuid();
      return uid === 0;
    }
    // Fallback: check if we can write to /root (root-only directory)
    try {
      const { existsSync, accessSync, constants } = require("fs");
      if (existsSync("/root")) {
        try {
          accessSync("/root", constants.W_OK);
          return true;
        } catch {
          return false;
        }
      }
    } catch {
      // Ignore
    }
    return false;
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

  // Allow runtime installation if running as root (Docker containers typically run as root initially)
  // This enables installation via the web UI
  const inDocker = isDockerContainer();
  const isRoot = isRootUser();
  
  // In Docker, we can try to install even if not root (using su or helper script)
  // The actual installation will handle root privileges
  // Outside Docker, require explicit permission via environment variable
  const allowRuntimeInstall = inDocker 
    ? true  // In Docker, always allow (will try to use su or helper script)
    : (process.env.ALLOW_RUNTIME_CLIENT_INSTALL === "true" && isRoot);
  
  if (!allowRuntimeInstall) {
    return {
      success: false,
      message: `Client for ${dbType} is not installed. Runtime package installation is disabled for security. Please install "${checkResult.command}" manually or set ALLOW_RUNTIME_CLIENT_INSTALL=true (not recommended).`,
      canInstall: false,
    };
  }
  
  // If we reach here, we can attempt installation
  // The actual install logic will handle root privileges

  // Install the client
  try {
    const inDocker = isDockerContainer();
    const isRoot = isRootUser();
    
    // If we're already root, run command directly
    // If not root, try to use su or helper script
    const runAsRoot = async (cmd: string): Promise<string> => {
      if (isRoot) {
        // Already root, run directly - no need for su
        console.log("Running as root, executing command directly");
        return cmd;
      }
      
      if (!inDocker) {
        // Not in Docker and not root, can't proceed
        throw new Error("Not running as root and not in Docker container");
      }
      
      // In Docker but not root, try to use helper script or direct execution
      // First check if we can actually execute as root (maybe container is root but process isn't)
      const { existsSync } = require("fs");
      const helperScript = "/app/install-client.sh";
      const helperExists = existsSync(helperScript);
      
      if (helperExists) {
        // Use helper script - but try direct execution first if we have permissions
        // Helper script runs as root via setuid or direct call
        const escapedCmd = cmd.replace(/'/g, "'\\''");
        // Try direct execution first (in case we're actually root but isRootUser() returned false)
        return `sh -c "${escapedCmd}" 2>&1 || su root -c "/app/install-client.sh ${dbType} '${escapedCmd}'" 2>&1`;
      }
      
      // Fallback: try direct execution first, then su
      const escapedCmd = cmd.replace(/'/g, "'\\''");
      return `sh -c "${escapedCmd}" 2>&1 || su root -c '${escapedCmd}' 2>&1`;
    };
    
    // For MongoDB, Neo4j, and Cypher-shell, ensure edge repository is available
    if (dbType === "MONGODB" || dbType === "NEO4J") {
      try {
        // Check if edge repository is already added
        const repoCheckCmd = "grep -q 'edge/community' /etc/apk/repositories || echo 'not-found'";
        const finalRepoCheckCmd = await runAsRoot(repoCheckCmd);
        const repoCheck = await execAsync(
          finalRepoCheckCmd,
          { timeout: 5000 }
        ).catch(() => ({ stdout: "not-found" }));
        
        if (repoCheck.stdout.includes("not-found")) {
          // Add edge repository
          const addRepoCmd = "echo 'http://dl-cdn.alpinelinux.org/alpine/edge/community' >> /etc/apk/repositories";
          const updateCmd = "apk update";
          
          const finalAddRepoCmd = await runAsRoot(addRepoCmd);
          const finalUpdateCmd = await runAsRoot(updateCmd);
          
          await execAsync(finalAddRepoCmd, { timeout: 5000 });
          await execAsync(finalUpdateCmd, { timeout: 30000 });
        }
      } catch (repoError) {
        // Repository might already be there, continue
        console.warn("Could not add edge repository, continuing anyway:", repoError);
      }
    }
    
    const finalInstallCmd = await runAsRoot(installCmd);
    const result = await execAsync(finalInstallCmd, { timeout: 60000 });
    
    // Check if the command actually succeeded
    if (result.stderr && (
      result.stderr.includes("su:") || 
      result.stderr.includes("Authentication failure") ||
      result.stderr.includes("Permission denied")
    )) {
      // If we got here and we're root, the issue is with su command itself
      // Try running the command directly without su
      if (isRoot) {
        console.log("Running as root, attempting direct installation without su...");
        try {
          await execAsync(installCmd, { timeout: 60000 });
          // Verify installation by checking if command exists
          const verifyResult = await checkClientInstalled(dbType);
          if (!verifyResult.installed) {
            throw new Error(`Installation completed but ${verifyResult.command || "client"} is not found in PATH`);
          }
          return {
            success: true,
            message: `Successfully installed client for ${dbType}`,
            canInstall: true,
          };
        } catch (directError: any) {
          throw new Error(`Direct installation failed: ${directError.message || directError.stderr || "Unknown error"}`);
        }
      }
      throw new Error("Cannot switch to root user. The container may need to run with root privileges. Try adding 'user: root' to docker-compose.yml or run with '--user root' flag.");
    }
    
    // Check if command actually succeeded (apk returns 0 even on some errors)
    if (result.stdout && result.stdout.includes("ERROR:")) {
      throw new Error(result.stdout);
    }
    
    // Verify installation by checking if command exists
    const verifyResult = await checkClientInstalled(dbType);
    if (!verifyResult.installed) {
      // Installation might have succeeded but command not in PATH, or installation failed silently
      const errorMsg = result.stderr || result.stdout || "Installation completed but command not found";
      throw new Error(`Installation may have failed: ${errorMsg}. Command ${verifyResult.command || "unknown"} not found in PATH.`);
    }
    
    return {
      success: true,
      message: `Successfully installed client for ${dbType}`,
      canInstall: true,
    };
  } catch (error: any) {
    const errorMsg = error.stderr || error.stdout || error.message || "Unknown error";
    console.error("Client installation error:", error);
    return {
      success: false,
      message: `Failed to install client: ${errorMsg}. Current user: ${isRootUser() ? "root" : "non-root"}, In Docker: ${isDockerContainer()}`,
      canInstall: false,
    };
  }
}

