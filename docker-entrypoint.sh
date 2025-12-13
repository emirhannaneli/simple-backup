#!/bin/sh
set -e

echo "Starting Simple Backup..."

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

# Run Prisma migrations
echo "Running Prisma migrations..."
export DATABASE_URL="${DATABASE_URL}"
bunx prisma@5.22.0 migrate deploy || {
  echo "ERROR: Migration failed!"
  exit 1
}

# Generate Prisma Client if needed
echo "Generating Prisma Client..."
export DATABASE_URL="${DATABASE_URL}"
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

cd /app && bun --bun manual-seed.ts || {
  echo "ERROR: Seed failed!"
  rm -f /app/manual-seed.ts
  exit 1
}
rm -f /app/manual-seed.ts
echo "✓ Seed completed successfully"

echo "Starting application..."
exec "$@"

