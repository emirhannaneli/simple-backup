import { exec } from "child_process";
import { promisify } from "util";
import { quote } from "shell-quote";

const execAsync = promisify(exec);

export interface DatabaseConnection {
  type: "MYSQL" | "POSTGRES" | "MONGODB" | "REDIS" | "CASSANDRA" | "ELASTICSEARCH" | "INFLUXDB" | "NEO4J" | "SQLITE" | "H2";
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  databaseName: string;
  authSource?: string;
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
  if (!conn.host || !conn.port || !conn.username || !conn.password) {
    throw new Error("MySQL requires host, port, username, and password");
  }
  const { host, port, username, password, databaseName } = conn;
  // Escape all user inputs to prevent command injection
  const safeHost = escapeShellArg(host);
  const safePort = port.toString();
  const safeUsername = escapeShellArg(username);
  const safePassword = escapeShellArg(password);
  const safeDatabaseName = escapeShellArg(databaseName);
  
  // Use --password= instead of -p to avoid prompt
  return `mysqldump -h ${safeHost} -P ${safePort} -u ${safeUsername} --password=${safePassword} ${safeDatabaseName}`;
}

export function buildPostgreSQLCommand(conn: DatabaseConnection): string {
  if (!conn.host || !conn.port || !conn.username || !conn.password) {
    throw new Error("PostgreSQL requires host, port, username, and password");
  }
  const { host, port, username, password, databaseName } = conn;
  // Escape all user inputs
  const safeHost = escapeShellArg(host);
  const safePort = port.toString();
  const safeUsername = escapeShellArg(username);
  const safePassword = escapeShellArg(password);
  const safeDatabaseName = escapeShellArg(databaseName);
  
  // PGPASSWORD is passed via environment variable (safer)
  // Don't include it in command string, it will be set in env
  return `pg_dump -h ${safeHost} -p ${safePort} -U ${safeUsername} -d ${safeDatabaseName} --no-password`;
}

export function buildMongoDBCommand(conn: DatabaseConnection, outputPath: string): string {
  if (!conn.host || !conn.port || !conn.username || !conn.password) {
    throw new Error("MongoDB requires host, port, username, and password");
  }
  const { host, port, username, password, databaseName } = conn;
  // MongoDB URI encoding: username, password need to be URL encoded
  const encodedUsername = globalThis.encodeURIComponent(username);
  const encodedPassword = globalThis.encodeURIComponent(password);
  const encodedDatabase = globalThis.encodeURIComponent(databaseName);
  let uri = `mongodb://${encodedUsername}:${encodedPassword}@${host}:${port}/${encodedDatabase}`;
  
  // Add authSource if provided, default to admin
  const authSourceVal = conn.authSource || "admin";
  const encodedAuthSource = globalThis.encodeURIComponent(authSourceVal);
  uri += `?authSource=${encodedAuthSource}`;
  
  // Use single quotes for URI and output path
  const safeUri = `'${uri.replace(/'/g, "'\\''")}'`;
  const safeOutputPath = `'${outputPath.replace(/'/g, "'\\''")}'`;
  
  return `mongodump --uri=${safeUri} --archive=${safeOutputPath}`;
}

export function buildRedisCommand(conn: DatabaseConnection, outputPath: string): string {
  if (!conn.host || !conn.port) {
    throw new Error("Redis requires host and port");
  }
  const { host, port, password } = conn;
  const safeHost = escapeShellArg(host);
  const safePort = port.toString();
  const safeOutputPath = escapeShellArg(outputPath);
  
  // Redis RDB snapshot - use --rdb for direct backup
  if (password) {
    const safePassword = escapeShellArg(password);
    return `redis-cli -h ${safeHost} -p ${safePort} -a ${safePassword} --rdb ${safeOutputPath}`;
  } else {
    return `redis-cli -h ${safeHost} -p ${safePort} --no-auth-warning --rdb ${safeOutputPath}`;
  }
}

export function buildCassandraCommand(conn: DatabaseConnection): string {
  if (!conn.host || !conn.port || !conn.username || !conn.password) {
    throw new Error("Cassandra requires host, port, username, and password");
  }
  const { host, port, username, password, databaseName } = conn;
  // Cassandra snapshot using nodetool (requires SSH or local access)
  // Note: nodetool typically runs on the Cassandra server
  const safeHost = escapeShellArg(host);
  const safeKeyspace = escapeShellArg(databaseName);
  const snapshotName = `backup_${Date.now()}`;
  const safeSnapshotName = escapeShellArg(snapshotName);
  
  // nodetool snapshot command (requires server access)
  // This is a simplified version - in practice, you may need SSH
  // Try nodetool first, fallback to common paths if not in PATH
  const cmd = `nodetool -h ${safeHost} -p ${safeKeyspace} snapshot -t ${safeSnapshotName} ${safeKeyspace}`;
  return `${cmd} 2>&1 || /usr/bin/nodetool -h ${safeHost} -p ${safeKeyspace} snapshot -t ${safeSnapshotName} ${safeKeyspace} 2>&1`;
}

export function buildElasticsearchCommand(conn: DatabaseConnection): string {
  if (!conn.host || !conn.port) {
    throw new Error("Elasticsearch requires host and port");
  }
  const { host, port, username, password, databaseName } = conn;
  // Elasticsearch snapshot via REST API
  const safeHost = escapeShellArg(host);
  const safePort = port.toString();
  const repository = escapeShellArg(databaseName || "backup_repo");
  const snapshotName = `backup_${Date.now()}`;
  const safeSnapshotName = escapeShellArg(snapshotName);
  
  const url = `http://${host}:${port}/_snapshot/${repository}/${safeSnapshotName}`;
  
  if (username && password) {
    const safeUsername = escapeShellArg(username);
    const safePassword = escapeShellArg(password);
    return `curl -X PUT "${url}" -u ${safeUsername}:${safePassword}`;
  } else {
    return `curl -X PUT "${url}"`;
  }
}

export function buildInfluxDBCommand(conn: DatabaseConnection, outputPath: string): string {
  if (!conn.host || !conn.port) {
    throw new Error("InfluxDB requires host and port");
  }
  const { host, port, username, password, databaseName } = conn;
  const safeHost = escapeShellArg(host);
  const safePort = port.toString();
  const safeDatabase = escapeShellArg(databaseName);
  const safeOutputPath = escapeShellArg(outputPath);
  
  let command = `influx backup -host ${safeHost}:${safePort} -db ${safeDatabase} ${safeOutputPath}`;
  
  if (username && password) {
    const safeUsername = escapeShellArg(username);
    const safePassword = escapeShellArg(password);
    command += ` -username ${safeUsername} -password ${safePassword}`;
  }
  
  // Try influx first, fallback to /usr/local/bin/influx if not in PATH
  return `influx backup -host ${safeHost}:${safePort} -db ${safeDatabase} ${safeOutputPath}${username && password ? ` -username ${escapeShellArg(username)} -password ${escapeShellArg(password)}` : ""} 2>&1 || /usr/local/bin/influx backup -host ${safeHost}:${safePort} -db ${safeDatabase} ${safeOutputPath}${username && password ? ` -username ${escapeShellArg(username)} -password ${escapeShellArg(password)}` : ""} 2>&1`;
}

export function buildNeo4jCommand(conn: DatabaseConnection, outputPath: string): string {
  if (!conn.host || !conn.port || !conn.username || !conn.password) {
    throw new Error("Neo4j requires host, port, username, and password");
  }
  const { databaseName } = conn;
  const safeDatabase = escapeShellArg(databaseName || "neo4j");
  const safeOutputPath = escapeShellArg(outputPath);
  
  // neo4j-admin dump command (requires server access)
  // Try neo4j-admin first, fallback to common paths if not in PATH
  const cmd = `neo4j-admin database dump --database=${safeDatabase} --to=${safeOutputPath}`;
  return `${cmd} 2>&1 || /usr/bin/neo4j-admin database dump --database=${safeDatabase} --to=${safeOutputPath} 2>&1`;
}

export function buildSQLiteCommand(conn: DatabaseConnection, outputPath: string): string {
  // SQLite is file-based, databaseName contains the file path
  const safeDatabasePath = escapeShellArg(conn.databaseName);
  const safeOutputPath = escapeShellArg(outputPath);
  
  // Use SQLite .backup command
  return `sqlite3 ${safeDatabasePath} ".backup ${safeOutputPath}"`;
}

export function buildH2Command(conn: DatabaseConnection, outputPath: string): string {
  const { username, password, databaseName } = conn;
  // H2 can be file-based or server-based
  // databaseName contains JDBC URL or file path
  const safeUrl = escapeShellArg(databaseName.startsWith("jdbc:") ? databaseName : `jdbc:h2:${databaseName}`);
  const safeOutputPath = escapeShellArg(outputPath);
  const safeUsername = escapeShellArg(username || "sa");
  const safePassword = escapeShellArg(password || "");
  
  return `java -cp h2.jar org.h2.tools.Script -url ${safeUrl} -user ${safeUsername} -password ${safePassword} -script ${safeOutputPath}`;
}

export function getFileExtension(type: DatabaseConnection["type"]): string {
  switch (type) {
    case "MYSQL":
      return "sql";
    case "POSTGRES":
      return "sql";
    case "MONGODB":
      return "archive";
    case "REDIS":
      return "rdb";
    case "CASSANDRA":
      return "tar.gz";
    case "ELASTICSEARCH":
      return "json";
    case "INFLUXDB":
      return "backup";
    case "NEO4J":
      return "dump";
    case "SQLITE":
      return "db";
    case "H2":
      return "sql";
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
      command = buildMongoDBCommand(conn, outputPath);
      break;
    case "REDIS":
      command = buildRedisCommand(conn, outputPath);
      break;
    case "CASSANDRA":
      command = buildCassandraCommand(conn);
      break;
    case "ELASTICSEARCH":
      command = buildElasticsearchCommand(conn);
      break;
    case "INFLUXDB":
      command = buildInfluxDBCommand(conn, outputPath);
      break;
    case "NEO4J":
      command = buildNeo4jCommand(conn, outputPath);
      break;
    case "SQLITE":
      command = buildSQLiteCommand(conn, outputPath);
      break;
    case "H2":
      command = buildH2Command(conn, outputPath);
      break;
    default:
      throw new Error(`Unsupported database type: ${conn.type}`);
  }

  // Determine if we need to redirect output to the file
  // MongoDB, Redis, SQLite, etc. already handle output files via their own parameters
  const needsRedirect = !["MONGODB", "REDIS", "SQLITE", "H2", "INFLUXDB", "NEO4J", "ELASTICSEARCH"].includes(conn.type);
  
  const safeOutputPath = escapeShellArg(outputPath);
  const fullCommand = needsRedirect 
    ? `${command} > ${safeOutputPath}`
    : command;

  try {
    const { stdout, stderr } = await execAsync(fullCommand, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      env: {
        ...process.env,
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
  const err = error as { stderr?: string; message?: string; code?: string | number };
  const errorMessage = err.stderr || err.message || "";
  const lowerError = errorMessage.toLowerCase();
  // Handle code as string or number
  const errorCode = err.code 
    ? (typeof err.code === 'string' ? err.code.toLowerCase() : String(err.code).toLowerCase())
    : "";

  const defaultPortMap: Record<string, string> = {
    MYSQL: "3306",
    POSTGRES: "5432",
    MONGODB: "27017",
    REDIS: "6379",
    CASSANDRA: "9042",
    ELASTICSEARCH: "9200",
    INFLUXDB: "8086",
    NEO4J: "7687",
    SQLITE: "N/A",
    H2: "8082",
  };
  
  const dbNameMap: Record<string, string> = {
    MYSQL: "MySQL",
    POSTGRES: "PostgreSQL",
    MONGODB: "MongoDB",
    REDIS: "Redis",
    CASSANDRA: "Cassandra",
    ELASTICSEARCH: "Elasticsearch",
    INFLUXDB: "InfluxDB",
    NEO4J: "Neo4j",
    SQLITE: "SQLite",
    H2: "H2",
  };
  
  const clientToolMap: Record<string, string> = {
    MYSQL: "mysql client",
    POSTGRES: "psql (PostgreSQL client)",
    MONGODB: "mongodump (MongoDB backup tool)",
    REDIS: "redis-cli",
    CASSANDRA: "cqlsh (Cassandra Query Language Shell)",
    ELASTICSEARCH: "curl",
    INFLUXDB: "influx CLI",
    NEO4J: "cypher-shell",
    SQLITE: "sqlite3",
    H2: "H2 Shell (java -cp h2.jar)",
  };

  const defaultPort = defaultPortMap[dbType] || "N/A";
  const dbName = dbNameMap[dbType] || dbType;
  const clientTool = clientToolMap[dbType] || "client tool";

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
    (lowerError.includes("not found") && (
      lowerError.includes("mysql") || lowerError.includes("psql") || lowerError.includes("mongosh") ||
      lowerError.includes("redis") || lowerError.includes("cqlsh") || lowerError.includes("influx") ||
      lowerError.includes("neo4j") || lowerError.includes("cypher") || lowerError.includes("sqlite3") ||
      lowerError.includes("h2") || lowerError.includes("java")
    ))
  ) {
    const installInstructions: Record<string, string> = {
      MYSQL: "• Install MySQL client tools:\n  - Ubuntu/Debian: sudo apt-get install mysql-client\n  - macOS: brew install mysql-client\n  - Windows: Install MySQL from mysql.com\n  - Docker: Add to Dockerfile: RUN apk add --no-cache mysql-client",
      POSTGRES: "• Install PostgreSQL client tools:\n  - Ubuntu/Debian: sudo apt-get install postgresql-client\n  - macOS: brew install postgresql\n  - Windows: Install PostgreSQL from postgresql.org\n  - Docker: Add to Dockerfile: RUN apk add --no-cache postgresql-client",
      MONGODB: "• Install MongoDB tools:\n  - Ubuntu/Debian: sudo apt-get install mongodb-database-tools\n  - macOS: brew install mongodb-database-tools\n  - Windows: Install MongoDB from mongodb.com\n  - Docker: RUN apk add --no-cache mongodb-tools",
      REDIS: "• Install Redis CLI:\n  - Ubuntu/Debian: sudo apt-get install redis-tools\n  - macOS: brew install redis\n  - Windows: Download from redis.io\n  - Docker: Add to Dockerfile: RUN apk add --no-cache redis",
      CASSANDRA: "• Install Cassandra tools:\n  - Ubuntu/Debian: sudo apt-get install cassandra-tools\n  - macOS: brew install cassandra\n  - Or download from cassandra.apache.org\n  - Docker: Add to Dockerfile: RUN apk add --no-cache cassandra-tools",
      ELASTICSEARCH: "• curl is usually pre-installed. If not:\n  - Ubuntu/Debian: sudo apt-get install curl\n  - macOS: Usually pre-installed\n  - Windows: Download from curl.se\n  - Docker: Usually pre-installed in Alpine",
      INFLUXDB: "• Install InfluxDB CLI:\n  - Download from influxdata.com/downloads\n  - Or use package manager for your OS\n  - Docker: Download and install in Dockerfile",
      NEO4J: "• Install Neo4j tools:\n  - Download from neo4j.com/download\n  - Ensure cypher-shell is in PATH\n  - Docker: Install Neo4j tools in Dockerfile",
      SQLITE: "• Install SQLite3:\n  - Ubuntu/Debian: sudo apt-get install sqlite3\n  - macOS: Usually pre-installed\n  - Windows: Download from sqlite.org\n  - Docker: Add to Dockerfile: RUN apk add --no-cache sqlite",
      H2: "• Install H2 Database:\n  - Download h2.jar from h2database.com\n  - Ensure Java is installed and h2.jar is in PATH or classpath\n  - Docker: Install Java and h2.jar in Dockerfile",
    };
    
    return `🛠️ Client Tool Not Found\n\n${clientTool} is not installed or not in PATH.\n\nTo fix this:\n\n${installInstructions[dbType] || "• Please install the required client tool for " + dbName}\n\nAfter installation, ensure the tools are in your system PATH.`;
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
  let envVars: Record<string, string | undefined> = { ...process.env };

  switch (conn.type) {
    case "MYSQL": {
      if (!conn.host || !conn.port || !conn.username || !conn.password) {
        return { success: false, error: "MySQL requires host, port, username, and password" };
      }
      const safeHost = escapeShellArg(conn.host);
      const safePort = conn.port.toString();
      const safeUsername = escapeShellArg(conn.username);
      const safePassword = escapeShellArg(conn.password);
      const safeDatabaseName = escapeShellArg(conn.databaseName);
      // Use --password= instead of -p to avoid prompt
      testCommand = `mysql -h ${safeHost} -P ${safePort} -u ${safeUsername} --password=${safePassword} -e ${quote(["SELECT 1"])} ${safeDatabaseName}`;
      break;
    }
    case "POSTGRES": {
      if (!conn.host || !conn.port || !conn.username || !conn.password) {
        return { success: false, error: "PostgreSQL requires host, port, username, and password" };
      }
      const safeHost = escapeShellArg(conn.host);
      const safePort = conn.port.toString();
      const safeUsername = escapeShellArg(conn.username);
      const safePassword = escapeShellArg(conn.password);
      const safeDatabaseName = escapeShellArg(conn.databaseName);
      // Use PGPASSWORD environment variable (safer than command line)
      testCommand = `psql -h ${safeHost} -p ${safePort} -U ${safeUsername} -d ${safeDatabaseName} -c ${quote(["SELECT 1"])}`;
      envVars.PGPASSWORD = conn.password;
      break;
    }
    case "MONGODB": {
      if (!conn.host || !conn.port || !conn.username || !conn.password) {
        return { success: false, error: "MongoDB requires host, port, username, and password" };
      }
      // MongoDB URI encoding - use global encodeURIComponent
      const encodedUsername = globalThis.encodeURIComponent(conn.username);
      const encodedPassword = globalThis.encodeURIComponent(conn.password);
      const encodedHost = conn.host; // Don't escape for URI
      const encodedDatabase = globalThis.encodeURIComponent(conn.databaseName);
      let uri = `mongodb://${encodedUsername}:${encodedPassword}@${encodedHost}:${conn.port}/${encodedDatabase}`;
      
      // Add authSource if provided, default to admin
      const authSourceVal = conn.authSource || "admin";
      const encodedAuthSource = globalThis.encodeURIComponent(authSourceVal);
      uri += `?authSource=${encodedAuthSource}`;

      // Use single quotes for URI to prevent shell-quote backslash escaping of characters like ':', '@', etc.
      const safeUri = `'${uri.replace(/'/g, "'\\''")}'`;
      // Use mongodump for connection testing
      testCommand = `mongodump --uri=${safeUri} --collection=__connection_test__ --quiet 2>&1 | head -n 10 || mongodump --uri=${safeUri} --quiet 2>&1 | head -n 10`;
      break;
    }
    case "REDIS": {
      if (!conn.host || !conn.port) {
        return { success: false, error: "Redis requires host and port" };
      }
      const safeHost = escapeShellArg(conn.host);
      const safePort = conn.port.toString();
      if (conn.password) {
        const safePassword = escapeShellArg(conn.password);
        testCommand = `redis-cli -h ${safeHost} -p ${safePort} -a ${safePassword} PING`;
      } else {
        testCommand = `redis-cli -h ${safeHost} -p ${safePort} --no-auth-warning PING`;
      }
      break;
    }
    case "CASSANDRA": {
      if (!conn.host || !conn.port || !conn.username || !conn.password) {
        return { success: false, error: "Cassandra requires host, port, username, and password" };
      }
      const safeHost = escapeShellArg(conn.host);
      const safePort = conn.port.toString();
      const safeUsername = escapeShellArg(conn.username);
      const safePassword = escapeShellArg(conn.password);
      // cqlsh uses -u for username and --password for password (not -p which is for port)
      // cqlsh is installed via pip, might be in /usr/local/bin or ~/.local/bin
      const cqlshCmd = `cqlsh ${safeHost} ${safePort} -u ${safeUsername} --password ${safePassword} -e ${quote(["DESCRIBE KEYSPACES"])}`;
      testCommand = `${cqlshCmd} 2>&1 || /usr/local/bin/cqlsh ${safeHost} ${safePort} -u ${safeUsername} --password ${safePassword} -e ${quote(["DESCRIBE KEYSPACES"])} 2>&1 || python3 -m cqlsh ${safeHost} ${safePort} -u ${safeUsername} --password ${safePassword} -e ${quote(["DESCRIBE KEYSPACES"])} 2>&1`;
      break;
    }
    case "ELASTICSEARCH": {
      if (!conn.host || !conn.port) {
        return { success: false, error: "Elasticsearch requires host and port" };
      }
      // Don't escape host/port in URL
      const url = `http://${conn.host}:${conn.port}/_cluster/health`;
      if (conn.username && conn.password) {
        const safeUsername = escapeShellArg(conn.username);
        const safePassword = escapeShellArg(conn.password);
        testCommand = `curl -s -X GET "${url}" -u ${safeUsername}:${safePassword}`;
      } else {
        testCommand = `curl -s -X GET "${url}"`;
      }
      break;
    }
    case "INFLUXDB": {
      if (!conn.host || !conn.port) {
        return { success: false, error: "InfluxDB requires host and port" };
      }
      const safeHost = escapeShellArg(conn.host);
      const safePort = conn.port.toString();
      // InfluxDB v1 uses -host, v2 uses -hostname
      let command = `influx -host ${safeHost}:${safePort} -execute ${quote(["SHOW DATABASES"])}`;
      if (conn.username && conn.password) {
        const safeUsername = escapeShellArg(conn.username);
        const safePassword = escapeShellArg(conn.password);
        command += ` -username ${safeUsername} -password ${safePassword}`;
      }
      // Try influx first, fallback to /usr/local/bin/influx if not in PATH
      testCommand = `${command} 2>&1 || /usr/local/bin/influx ${command.replace(/^influx /, "")} 2>&1`;
      break;
    }
    case "NEO4J": {
      if (!conn.host || !conn.port || !conn.username || !conn.password) {
        return { success: false, error: "Neo4j requires host, port, username, and password" };
      }
      const safeHost = escapeShellArg(conn.host);
      const safePort = conn.port.toString();
      const safeUsername = escapeShellArg(conn.username);
      const safePassword = escapeShellArg(conn.password);
      // cypher-shell uses -a for address, -u for username, -p for password
      // Try cypher-shell first, fallback to common paths if not in PATH
      const cypherCmd = `cypher-shell -a bolt://${safeHost}:${safePort} -u ${safeUsername} -p ${safePassword} ${quote(["RETURN 1"])}`;
      testCommand = `${cypherCmd} 2>&1 || /usr/bin/cypher-shell -a bolt://${safeHost}:${safePort} -u ${safeUsername} -p ${safePassword} ${quote(["RETURN 1"])} 2>&1`;
      break;
    }
    case "SQLITE": {
      // SQLite is file-based, databaseName contains the file path
      const safeDatabasePath = escapeShellArg(conn.databaseName);
      testCommand = `sqlite3 ${safeDatabasePath} ${quote(["SELECT 1"])}`;
      break;
    }
    case "H2": {
      // H2 can be file-based or server-based
      const safeUrl = escapeShellArg(conn.databaseName.startsWith("jdbc:") ? conn.databaseName : `jdbc:h2:${conn.databaseName}`);
      const safeUsername = escapeShellArg(conn.username || "sa");
      const safePassword = escapeShellArg(conn.password || "");
      testCommand = `java -cp h2.jar org.h2.tools.Shell -url ${safeUrl} -user ${safeUsername} -password ${safePassword} -sql ${quote(["SELECT 1"])}`;
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
        ...envVars,
      } as NodeJS.ProcessEnv,
    });
    
    const dbNameMap: Record<DatabaseConnection["type"], string> = {
      MYSQL: "MySQL",
      POSTGRES: "PostgreSQL",
      MONGODB: "MongoDB",
      REDIS: "Redis",
      CASSANDRA: "Cassandra",
      ELASTICSEARCH: "Elasticsearch",
      INFLUXDB: "InfluxDB",
      NEO4J: "Neo4j",
      SQLITE: "SQLite",
      H2: "H2",
    };
    
    const dbName = dbNameMap[conn.type];
    const connectionDetails = conn.type === "SQLITE" 
      ? `• Database File: ${conn.databaseName}`
      : conn.type === "H2" && !conn.host
      ? `• Database: ${conn.databaseName}\n• Username: ${conn.username || "sa"}`
      : `• Host: ${conn.host}\n• Port: ${conn.port}\n• Database: ${conn.databaseName}\n• Username: ${conn.username || "N/A"}`;
    
    return { 
      success: true, 
      message: `✅ Connection Successful\n\nSuccessfully connected to ${dbName} database.\n\nConnection Details:\n${connectionDetails}\n\nThe database is ready for backup operations.`
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: parseConnectionError(error, conn.type, conn),
    };
  }
}

