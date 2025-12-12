import { exec } from "child_process";
import { promisify } from "util";
import { quote } from "shell-quote";

const execAsync = promisify(exec);

export interface DatabaseConnection {
  type: "MYSQL" | "POSTGRES" | "MONGODB";
  host: string;
  port: number;
  username: string;
  password: string;
  databaseName: string;
}

export interface CommandResult {
  command: string;
  stdout: string;
  stderr: string;
}

// Escape shell arguments to prevent command injection
function escapeShellArg(arg: string): string {
  // Use shell-quote to safely escape arguments
  // quote returns a properly escaped string
  return quote([arg]);
}

export function buildMySQLCommand(conn: DatabaseConnection): string {
  const { host, port, username, password, databaseName } = conn;
  // Escape all user inputs to prevent command injection
  const safeHost = escapeShellArg(host);
  const safePort = port.toString();
  const safeUsername = escapeShellArg(username);
  const safePassword = escapeShellArg(password);
  const safeDatabaseName = escapeShellArg(databaseName);
  
  // Note: -p flag requires password immediately after (no space)
  // This is a limitation of mysqldump, but we escape the password
  return `mysqldump -h ${safeHost} -P ${safePort} -u ${safeUsername} -p${safePassword} ${safeDatabaseName}`;
}

export function buildPostgreSQLCommand(conn: DatabaseConnection): string {
  const { host, port, username, password, databaseName } = conn;
  // Escape all user inputs
  const safeHost = escapeShellArg(host);
  const safePort = port.toString();
  const safeUsername = escapeShellArg(username);
  const safePassword = escapeShellArg(password);
  const safeDatabaseName = escapeShellArg(databaseName);
  
  // PGPASSWORD is passed via environment variable (safer)
  // But we still escape it for the command string display
  const pgPassword = `PGPASSWORD=${safePassword}`;
  return `${pgPassword} pg_dump -h ${safeHost} -p ${safePort} -U ${safeUsername} -d ${safeDatabaseName} --no-password`;
}

export function buildMongoDBCommand(conn: DatabaseConnection): string {
  const { host, port, username, password, databaseName } = conn;
  // MongoDB URI encoding: username, password need to be URL encoded
  // Use global encodeURIComponent function
  const encodedUsername = globalThis.encodeURIComponent(username);
  const encodedPassword = globalThis.encodeURIComponent(password);
  const encodedDatabase = globalThis.encodeURIComponent(databaseName);
  // Host doesn't need URL encoding in MongoDB URI, but we escape it for shell
  const safeHost = escapeShellArg(host);
  
  const uri = `mongodb://${encodedUsername}:${encodedPassword}@${safeHost}:${port}/${encodedDatabase}`;
  // Escape the entire URI string for shell
  return `mongodump --uri=${quote([uri])} --archive`;
}

export function getFileExtension(type: "MYSQL" | "POSTGRES" | "MONGODB"): string {
  switch (type) {
    case "MYSQL":
      return "sql";
    case "POSTGRES":
      return "sql";
    case "MONGODB":
      return "archive";
    default:
      return "sql";
  }
}

export async function executeBackupCommand(
  conn: DatabaseConnection,
  outputPath: string
): Promise<CommandResult> {
  let command: string;

  switch (conn.type) {
    case "MYSQL":
      command = buildMySQLCommand(conn);
      break;
    case "POSTGRES":
      command = buildPostgreSQLCommand(conn);
      break;
    case "MONGODB":
      command = buildMongoDBCommand(conn);
      break;
    default:
      throw new Error(`Unsupported database type: ${conn.type}`);
  }

  // Redirect output to file - escape output path
  const safeOutputPath = escapeShellArg(outputPath);
  const fullCommand = `${command} > ${safeOutputPath} 2>&1`;

  try {
    const { stdout, stderr } = await execAsync(fullCommand, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      env: {
        ...process.env,
        // For PostgreSQL
        PGPASSWORD: conn.type === "POSTGRES" ? conn.password : undefined,
      },
    });

    return {
      command: fullCommand,
      stdout,
      stderr,
    };
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    return {
      command: fullCommand,
      stdout: err.stdout || "",
      stderr: err.stderr || err.message || "",
    };
  }
}

function parseConnectionError(error: unknown, dbType: string, conn?: DatabaseConnection): string {
  const err = error as { stderr?: string; message?: string; code?: string };
  const errorMessage = err.stderr || err.message || "";
  const lowerError = errorMessage.toLowerCase();
  const errorCode = err.code?.toLowerCase() || "";

  const defaultPort = dbType === "MYSQL" ? "3306" : dbType === "POSTGRES" ? "5432" : "27017";
  const dbName = dbType === "MYSQL" ? "MySQL" : dbType === "POSTGRES" ? "PostgreSQL" : "MongoDB";
  const clientTool = dbType === "MYSQL" ? "mysql client" : dbType === "POSTGRES" ? "psql (PostgreSQL client)" : "mongosh (MongoDB shell)";

  // Network/Connection errors
  if (
    lowerError.includes("econnrefused") || 
    lowerError.includes("connection refused") ||
    errorCode === "econnrefused"
  ) {
    return `❌ Connection Refused\n\nCannot connect to ${dbName} server at ${conn?.host || "host"}:${conn?.port || defaultPort}.\n\nPossible causes:\n• Database server is not running\n• Incorrect host address (check if it's "localhost" or an IP address)\n• Incorrect port number (default: ${defaultPort})\n• Firewall blocking the connection\n\nPlease verify:\n1. The ${dbName} server is running\n2. The host and port are correct\n3. The server is accessible from this machine`;
  }

  if (
    lowerError.includes("etimedout") || 
    lowerError.includes("timeout") ||
    errorCode === "etimedout"
  ) {
    return `⏱️ Connection Timeout\n\nConnection to ${dbName} server timed out after 10 seconds.\n\nPossible causes:\n• Database server is not responding\n• Network connectivity issues\n• Firewall blocking the connection\n• Server is overloaded\n\nPlease verify:\n1. The ${dbName} server is running and accessible\n2. Network connectivity is stable\n3. Firewall rules allow connections on port ${conn?.port || defaultPort}`;
  }

  if (
    lowerError.includes("enotfound") || 
    lowerError.includes("getaddrinfo") ||
    lowerError.includes("name or service not known") ||
    errorCode === "enotfound"
  ) {
    return `🔍 Host Not Found\n\nCannot resolve host address: "${conn?.host || "unknown"}".\n\nPossible causes:\n• Incorrect hostname or IP address\n• DNS resolution failure\n• Network connectivity issues\n\nPlease verify:\n1. The host address is correct (try "localhost" or "127.0.0.1" for local servers)\n2. DNS is working correctly\n3. The host is reachable from this machine`;
  }

  // Authentication errors
  if (
    lowerError.includes("access denied") || 
    lowerError.includes("authentication failed") || 
    lowerError.includes("password") ||
    lowerError.includes("invalid credentials") ||
    lowerError.includes("authentication") ||
    lowerError.includes("wrong password")
  ) {
    return `🔐 Authentication Failed\n\nCannot authenticate with ${dbName} server.\n\nPossible causes:\n• Incorrect username\n• Incorrect password\n• User does not have permission to access the database\n• User account is locked or disabled\n\nPlease verify:\n1. Username is correct (case-sensitive for some databases)\n2. Password is correct (check for typos)\n3. User has permission to access database "${conn?.databaseName || "unknown"}"\n4. User account is active and not locked`;
  }

  // Database not found
  if (
    lowerError.includes("unknown database") || 
    (lowerError.includes("database") && lowerError.includes("does not exist")) ||
    lowerError.includes("database") && lowerError.includes("not found")
  ) {
    return `📦 Database Not Found\n\nDatabase "${conn?.databaseName || "unknown"}" does not exist on the ${dbName} server.\n\nPossible causes:\n• Database name is misspelled\n• Database has not been created yet\n• Database was deleted\n\nPlease verify:\n1. Database name is correct (case-sensitive for some databases)\n2. Database exists on the server\n3. You have permission to access this database`;
  }

  // Command not found
  if (
    lowerError.includes("command not found") || 
    lowerError.includes("not recognized") ||
    lowerError.includes("not found") && (lowerError.includes("mysql") || lowerError.includes("psql") || lowerError.includes("mongosh"))
  ) {
    return `🛠️ Client Tool Not Found\n\n${clientTool} is not installed or not in PATH.\n\nTo fix this:\n\n${dbType === "MYSQL" 
      ? "• Install MySQL client tools:\n  - Ubuntu/Debian: sudo apt-get install mysql-client\n  - macOS: brew install mysql-client\n  - Windows: Install MySQL from mysql.com"
      : dbType === "POSTGRES"
      ? "• Install PostgreSQL client tools:\n  - Ubuntu/Debian: sudo apt-get install postgresql-client\n  - macOS: brew install postgresql\n  - Windows: Install PostgreSQL from postgresql.org"
      : "• Install MongoDB shell:\n  - Ubuntu/Debian: sudo apt-get install mongodb-mongosh\n  - macOS: brew install mongosh\n  - Windows: Install MongoDB from mongodb.com"
    }\n\nAfter installation, ensure the tools are in your system PATH.`;
  }

  // SSL/TLS errors
  if (lowerError.includes("ssl") || lowerError.includes("tls") || lowerError.includes("certificate")) {
    return `🔒 SSL/TLS Error\n\nSSL/TLS connection to ${dbName} server failed.\n\nPossible causes:\n• SSL certificate validation failed\n• Server requires SSL but client doesn't support it\n• Incorrect SSL configuration\n\nPlease verify:\n1. SSL settings match server requirements\n2. SSL certificates are valid\n3. SSL/TLS is properly configured`;
  }

  // Permission errors
  if (lowerError.includes("permission denied") || lowerError.includes("access denied") && !lowerError.includes("password")) {
    return `🚫 Permission Denied\n\nUser "${conn?.username || "unknown"}" does not have permission to perform this operation.\n\nPossible causes:\n• User lacks required privileges\n• Database permissions are not set correctly\n• User is restricted from accessing this database\n\nPlease verify:\n1. User has necessary privileges\n2. Database permissions are correctly configured\n3. User is allowed to access database "${conn?.databaseName || "unknown"}"`;
  }

  // Connection limit errors
  if (lowerError.includes("too many connections") || lowerError.includes("connection limit")) {
    return `🔌 Connection Limit Reached\n\nThe ${dbName} server has reached its maximum connection limit.\n\nPossible causes:\n• Too many active connections\n• Connection pool is exhausted\n• Server configuration limits connections\n\nPlease verify:\n1. Close unused connections\n2. Increase server connection limit\n3. Wait and try again later`;
  }

  // Generic error - try to extract meaningful part
  const lines = errorMessage.split("\n").filter((line: string) => line.trim());
  const lastLine = lines[lines.length - 1] || errorMessage;
  
  // Return a cleaner version if we can extract something useful
  if (lastLine.length < 200 && lastLine.length > 10) {
    return `❌ Connection Failed\n\n${lastLine}\n\nPlease check:\n• All connection settings are correct\n• Database server is running and accessible\n• Network connectivity is stable\n• User credentials are valid`;
  }

  return `❌ Connection Test Failed\n\nUnable to connect to ${dbName} database.\n\nPlease verify:\n• Database server is running\n• Host: ${conn?.host || "unknown"}\n• Port: ${conn?.port || defaultPort}\n• Username: ${conn?.username || "unknown"}\n• Database: ${conn?.databaseName || "unknown"}\n• Network connectivity is stable\n• Firewall allows connections`;
}

export async function testConnection(conn: DatabaseConnection): Promise<{ success: boolean; error?: string; message?: string }> {
  let testCommand: string;

  switch (conn.type) {
    case "MYSQL": {
      const safeHost = escapeShellArg(conn.host);
      const safePort = conn.port.toString();
      const safeUsername = escapeShellArg(conn.username);
      const safePassword = escapeShellArg(conn.password);
      const safeDatabaseName = escapeShellArg(conn.databaseName);
      testCommand = `mysql -h ${safeHost} -P ${safePort} -u ${safeUsername} -p${safePassword} -e ${quote(["SELECT 1"])} ${safeDatabaseName}`;
      break;
    }
    case "POSTGRES": {
      const safeHost = escapeShellArg(conn.host);
      const safePort = conn.port.toString();
      const safeUsername = escapeShellArg(conn.username);
      const safePassword = escapeShellArg(conn.password);
      const safeDatabaseName = escapeShellArg(conn.databaseName);
      testCommand = `PGPASSWORD=${safePassword} psql -h ${safeHost} -p ${safePort} -U ${safeUsername} -d ${safeDatabaseName} -c ${quote(["SELECT 1"])}`;
      break;
    }
    case "MONGODB": {
      // MongoDB URI encoding - use global encodeURIComponent
      const encodedUsername = globalThis.encodeURIComponent(conn.username);
      const encodedPassword = globalThis.encodeURIComponent(conn.password);
      const encodedHost = escapeShellArg(conn.host);
      const encodedDatabase = globalThis.encodeURIComponent(conn.databaseName);
      const uri = `mongodb://${encodedUsername}:${encodedPassword}@${encodedHost}:${conn.port}/${encodedDatabase}`;
      testCommand = `mongosh ${quote([uri])} --eval ${quote(["db.adminCommand('ping')"])}`;
      break;
    }
    default:
      return { success: false, error: "Unsupported database type" };
  }

  try {
    await execAsync(testCommand, {
      timeout: 10000, // 10 second timeout
      env: {
        ...process.env,
        PGPASSWORD: conn.type === "POSTGRES" ? conn.password : undefined,
      },
    });
    
    const dbName = conn.type === "MYSQL" ? "MySQL" : conn.type === "POSTGRES" ? "PostgreSQL" : "MongoDB";
    return { 
      success: true, 
      message: `✅ Connection Successful\n\nSuccessfully connected to ${dbName} database.\n\nConnection Details:\n• Host: ${conn.host}\n• Port: ${conn.port}\n• Database: ${conn.databaseName}\n• Username: ${conn.username}\n\nThe database is ready for backup operations.`
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: parseConnectionError(error, conn.type, conn),
    };
  }
}

