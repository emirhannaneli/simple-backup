#!/bin/sh
set -e

echo "Starting Simple Backup..."

# Check if we're running as root (for initial setup)
# If running as root, we'll switch to nextjs user after migrations
# UNLESS user: root is explicitly set in docker-compose (then stay as root)
# Otherwise, we assume we're already running as nextjs
if [ "$(id -u)" = "0" ]; then
  echo "Running as root"
  ROOT_MODE=true
  
  # Check if we should stay as root
  # If user: root is set in docker-compose, we should stay as root
  # We detect this by checking if we can write to /root (only root can)
  # Or if STAY_AS_ROOT environment variable is set
  if [ -n "$STAY_AS_ROOT" ] && [ "$STAY_AS_ROOT" = "true" ]; then
    echo "STAY_AS_ROOT is set, will remain as root user"
    STAY_ROOT=true
  elif [ -w "/root" ] 2>/dev/null; then
    # If we can write to /root, we're definitely root and should stay root
    # This handles the case where user: root is set in docker-compose
    echo "Container is running as root (user: root), will remain as root user"
    STAY_ROOT=true
  else
    echo "Will switch to nextjs user after setup"
    STAY_ROOT=false
    # Ensure nextjs user exists
    if ! id -u nextjs >/dev/null 2>&1; then
      echo "ERROR: nextjs user does not exist!"
      exit 1
    fi
  fi
else
  echo "Running as user: $(id)"
  ROOT_MODE=false
  STAY_ROOT=false
fi

# Load environment variables from Docker secrets if available (secrets take precedence)
# Priority: *_FILE env var > /run/secrets/* > direct env var > default
# Otherwise, use environment variables passed at runtime

# DATABASE_URL
if [ -n "$DATABASE_URL_FILE" ] && [ -f "$DATABASE_URL_FILE" ]; then
  export DATABASE_URL=$(cat "$DATABASE_URL_FILE")
  echo "Loaded DATABASE_URL from file: $DATABASE_URL_FILE"
elif [ -f "/run/secrets/DATABASE_URL" ]; then
  export DATABASE_URL=$(cat /run/secrets/DATABASE_URL)
  echo "Loaded DATABASE_URL from secret"
elif [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="file:/data/system.db"
  echo "Using default DATABASE_URL"
fi

# JWT_SECRET
if [ -n "$JWT_SECRET_FILE" ] && [ -f "$JWT_SECRET_FILE" ]; then
  export JWT_SECRET=$(cat "$JWT_SECRET_FILE")
  echo "Loaded JWT_SECRET from file: $JWT_SECRET_FILE"
elif [ -f "/run/secrets/JWT_SECRET" ]; then
  export JWT_SECRET=$(cat /run/secrets/JWT_SECRET)
  echo "Loaded JWT_SECRET from secret"
elif [ -z "$JWT_SECRET" ]; then
  echo "Warning: JWT_SECRET not set. Using default (INSECURE for production)"
fi

# ENCRYPTION_KEY
if [ -n "$ENCRYPTION_KEY_FILE" ] && [ -f "$ENCRYPTION_KEY_FILE" ]; then
  export ENCRYPTION_KEY=$(cat "$ENCRYPTION_KEY_FILE")
  echo "Loaded ENCRYPTION_KEY from file: $ENCRYPTION_KEY_FILE"
elif [ -f "/run/secrets/ENCRYPTION_KEY" ]; then
  export ENCRYPTION_KEY=$(cat /run/secrets/ENCRYPTION_KEY)
  echo "Loaded ENCRYPTION_KEY from secret"
elif [ -z "$ENCRYPTION_KEY" ]; then
  echo "Warning: ENCRYPTION_KEY not set. Using default (INSECURE for production)"
fi

# BACKUP_BASE_PATH
if [ -n "$BACKUP_BASE_PATH_FILE" ] && [ -f "$BACKUP_BASE_PATH_FILE" ]; then
  export BACKUP_BASE_PATH=$(cat "$BACKUP_BASE_PATH_FILE")
  echo "Loaded BACKUP_BASE_PATH from file: $BACKUP_BASE_PATH_FILE"
elif [ -f "/run/secrets/BACKUP_BASE_PATH" ]; then
  export BACKUP_BASE_PATH=$(cat /run/secrets/BACKUP_BASE_PATH)
  echo "Loaded BACKUP_BASE_PATH from secret"
elif [ -z "$BACKUP_BASE_PATH" ]; then
  export BACKUP_BASE_PATH="/data/backups"
  echo "Using default BACKUP_BASE_PATH"
fi

# Wait for database file to be ready (if using volume)
if [ ! -f "/data/system.db" ]; then
  echo "Database file not found, initializing..."
  mkdir -p /data
fi

# Ensure backup directory exists
echo "Ensuring backup directory exists: $BACKUP_BASE_PATH"
mkdir -p "$BACKUP_BASE_PATH"

# Fix permissions for /data directory
# If running as root, fix permissions for nextjs user
# If running as nextjs, try to ensure we have write access
if [ "$ROOT_MODE" = "true" ]; then
  echo "Fixing permissions for /data directory (running as root)..."
  # Set ownership first
  chown -R nextjs:nodejs /data 2>/dev/null || true
  # Set directory permissions (775 = rwxrwxr-x, allows nextjs to write)
  find /data -type d -exec chmod 775 {} \; 2>/dev/null || true
  # Set file permissions (664 = rw-rw-r--, allows nextjs to read/write)
  find /data -type f -exec chmod 664 {} \; 2>/dev/null || true
  # Ensure /data itself is writable
  chmod 775 /data 2>/dev/null || true
  echo "Permissions fixed. /data directory:"
  ls -ld /data 2>&1 || true
else
  echo "Checking /data directory permissions (running as $(id))..."
  if [ ! -w "/data" ]; then
    echo "WARNING: /data directory is not writable by current user"
    echo "This may cause migration failures if /data is a volume mount"
    echo "Consider running container with proper volume permissions or as root initially"
  fi
fi

# Ensure Prisma directory is accessible
if [ -d "/app/prisma" ]; then
  echo "Prisma directory found at /app/prisma"
  if [ -d "/app/prisma/migrations" ]; then
    echo "Found migrations directory"
    # Ensure migration files are readable
    if [ "$ROOT_MODE" = "true" ]; then
      chmod -R 755 /app/prisma/migrations 2>/dev/null || true
    fi
    ls -la /app/prisma/migrations | head -5 || true
  else
    echo "Warning: migrations directory not found"
  fi
else
  echo "Warning: Prisma directory not found at /app/prisma"
fi

# Run Prisma migrations
echo "Running Prisma migrations..."
echo "DATABASE_URL: ${DATABASE_URL}"
export DATABASE_URL="${DATABASE_URL}"

# Change to app directory to ensure Prisma can find schema
cd /app

# Run migration with better error handling
# SQLite requires write access to both the database file and the directory for journal files
# For now, run migrations as root to avoid permission issues, then fix ownership
if [ "$ROOT_MODE" = "true" ]; then
  # Ensure database file and directory are writable
  echo "Ensuring database file permissions..."
  if [ -f "/data/system.db" ]; then
    chmod 664 /data/system.db 2>/dev/null || true
  fi
  # Ensure /data directory is writable (for journal files)
  chmod 775 /data 2>/dev/null || true
  
  # Run migrations as root (will fix ownership afterwards)
  echo "Running migrations..."
  bunx prisma@5.22.0 migrate deploy 2>&1 || {
    echo "ERROR: Migration failed!"
    echo "Current user: $(id)"
    echo "Current directory: $(pwd)"
    echo "DATABASE_URL: ${DATABASE_URL}"
    echo "Checking /data permissions:"
    ls -la /data 2>&1 || true
    echo "Checking database file:"
    ls -la /data/system.db* 2>&1 || true
    echo "Checking /app/prisma:"
    ls -la /app/prisma 2>&1 || true
    exit 1
  }
  
  # Fix ownership of database files (including any journal files created)
  echo "Fixing database file ownership..."
  chown -R nextjs:nodejs /data/system.db* 2>/dev/null || true
  chmod 664 /data/system.db* 2>/dev/null || true
else
  # Run as current user (nextjs)
  bunx prisma@5.22.0 migrate deploy 2>&1 || {
    echo "ERROR: Migration failed!"
    echo "Current user: $(id)"
    echo "Current directory: $(pwd)"
    echo "DATABASE_URL: ${DATABASE_URL}"
    echo "Checking /data permissions:"
    ls -la /data 2>&1 || true
    echo "Checking database file:"
    ls -la /data/system.db* 2>&1 || true
    echo "Checking /app/prisma:"
    ls -la /app/prisma 2>&1 || true
    exit 1
  }
fi

# Safety net: ensure critical columns exist even if migration had issues
# SQLite will error if column already exists, which we safely ignore
echo "Ensuring database schema compatibility..."
DB_PATH=$(echo "$DATABASE_URL" | sed 's|file:||')
if [ -f "$DB_PATH" ]; then
  sqlite3 "$DB_PATH" "ALTER TABLE datasources ADD COLUMN authSource TEXT;" 2>/dev/null && \
    echo "✓ Added missing authSource column" || \
    echo "✓ authSource column already exists"
elif command -v sqlite3 > /dev/null 2>&1; then
  echo "Warning: Database file not found at $DB_PATH, skipping schema check"
else
  echo "Warning: sqlite3 not available, skipping schema safety check"
fi

# Generate Prisma Client if needed
echo "Generating Prisma Client..."
export DATABASE_URL="${DATABASE_URL}"
# Prisma Client generation doesn't need database access, can run as any user
bunx prisma@5.22.0 generate || {
  echo "ERROR: Prisma Client generation failed!"
  exit 1
}

# Seed database (creates default admin if not exists)
echo "Seeding database..."
export DATABASE_URL="${DATABASE_URL}"

# Manual seed using Bun (can run TypeScript directly)
echo "Running seed with bun..."
cat > /app/manual-seed.ts << 'EOF'
import { PrismaClient } from '@prisma/client';
import { hash } from 'argon2';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

(async () => {
  try {
    console.log('Checking for existing admin user...');
    const existing = await prisma.user.findUnique({ 
      where: { username: 'admin' } 
    });
    
    if (existing) {
      console.log('✓ Admin user already exists');
      return;
    }
    
    console.log('Creating admin user...');
    const passwordHash = await hash('admin');
    const user = await prisma.user.create({
      data: {
        username: 'admin',
        passwordHash,
        role: 'ADMIN'
      }
    });
    
    console.log('✓ Admin user created successfully');
    console.log('  Username: admin');
    console.log('  Password: admin');
    console.log('  User ID:', user.id);
  } catch (err) {
    console.error('✗ Error during seed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
EOF

# Set NODE_PATH to help Bun find modules
export NODE_PATH=/app/node_modules

# Seed database - run as root if in root mode, then fix ownership
cd /app && bun --bun manual-seed.ts || {
  echo "ERROR: Seed failed!"
  rm -f /app/manual-seed.ts
  exit 1
}
# Fix ownership of database after seed (in case it created/modified anything)
if [ "$ROOT_MODE" = "true" ]; then
  chown -R nextjs:nodejs /data/system.db* 2>/dev/null || true
fi
rm -f /app/manual-seed.ts
echo "✓ Seed completed successfully"

# Create a helper script for installing clients as root
# This script will be called by the API to install database clients
if [ "$ROOT_MODE" = "true" ]; then
  echo "Creating client installer helper script..."
  cat > /app/install-client.sh << 'INSTALL_EOF'
#!/bin/sh
# This script runs as root to install database clients
# Called by the API endpoint /api/clients/install

DB_TYPE="$1"
INSTALL_CMD="$2"

if [ -z "$DB_TYPE" ] || [ -z "$INSTALL_CMD" ]; then
  echo "Usage: install-client.sh <DB_TYPE> <INSTALL_CMD>"
  exit 1
fi

# For MongoDB and Neo4j, ensure edge repository is available
if [ "$DB_TYPE" = "MONGODB" ] || [ "$DB_TYPE" = "NEO4J" ]; then
  if ! grep -q "edge/community" /etc/apk/repositories 2>/dev/null; then
    echo "http://dl-cdn.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories
    apk update
  fi
fi

# Execute the install command
eval "$INSTALL_CMD"
INSTALL_EOF
  chmod +x /app/install-client.sh
  chown root:root /app/install-client.sh
  echo "Client installer helper script created"
fi

# If we were running as root and STAY_ROOT is false, switch to nextjs user before starting the app
if [ "$ROOT_MODE" = "true" ] && [ "$STAY_ROOT" = "false" ]; then
  echo "Switching to nextjs user for application runtime..."
  # Use su-exec if available, otherwise use su
  if command -v su-exec >/dev/null 2>&1; then
    exec su-exec nextjs "$@"
  else
    # Fallback to su
    exec su -s /bin/sh nextjs -c "cd /app && exec \"\$@\"" -- "$@"
  fi
else
  echo "Starting application as current user ($(id))..."
  exec "$@"
fi

