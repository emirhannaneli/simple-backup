# Docker Setup for Simple Backup

## Quick Start

### 1. Create Secret Files

Create the `secrets` directory and add your secret files:

**Windows (PowerShell):**
```powershell
New-Item -ItemType Directory -Path secrets -Force
Set-Content -Path secrets\DATABASE_URL -Value "file:/data/system.db"
Set-Content -Path secrets\JWT_SECRET -Value "your-super-secret-jwt-key-min-32-chars"
Set-Content -Path secrets\ENCRYPTION_KEY -Value "your-super-secret-encryption-key-32-chars"
Set-Content -Path secrets\BACKUP_BASE_PATH -Value "./backups"
```

**Linux/Mac:**
```bash
mkdir -p secrets
echo "file:/data/system.db" > secrets/DATABASE_URL
echo "your-super-secret-jwt-key-min-32-chars" > secrets/JWT_SECRET
echo "your-super-secret-encryption-key-32-chars" > secrets/ENCRYPTION_KEY
echo "./backups" > secrets/BACKUP_BASE_PATH
```

**Important**: Never commit these files to version control! They are already in `.gitignore`.

### Generate Secure Secrets

For production, generate secure random secrets:

**Windows (PowerShell):**
```powershell
# JWT Secret (Base64)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 })) | Out-File -FilePath secrets\JWT_SECRET -NoNewline

# Encryption Key (64 hex chars)
-join ((48..57) + (97..102) | Get-Random -Count 64 | ForEach-Object { [char]$_ }) | Out-File -FilePath secrets\ENCRYPTION_KEY -NoNewline
```

**Linux/Mac:**
```bash
# Generate JWT Secret (32+ chars)
openssl rand -base64 32 > secrets/JWT_SECRET

# Generate Encryption Key (64 hex chars for direct use, or 32 chars for PBKDF2)
openssl rand -hex 32 > secrets/ENCRYPTION_KEY
```

### 2. Build and Run

```bash
# Production
docker-compose up -d

# Development
docker-compose -f docker-compose.dev.yml up
```

### 3. Access the Application

- Web UI: http://localhost:3000
- Default credentials: `admin` / `admin` (change after first login!)

## Docker Secrets

Docker secrets are mounted as files in `/run/secrets/` inside the container. The application automatically reads from these files if available, otherwise falls back to environment variables.

The entrypoint script (`docker-entrypoint.sh`) loads secrets from `/run/secrets/` and sets them as environment variables before the application starts.

### Secret Files

- `secrets/DATABASE_URL` - SQLite database path (e.g., `file:/data/system.db`)
- `secrets/JWT_SECRET` - JWT signing secret (min 32 characters)
- `secrets/ENCRYPTION_KEY` - Encryption key for datasource passwords (32 chars or 64 hex)
- `secrets/BACKUP_BASE_PATH` - Base path for backup files (e.g., `./backups`)

## Volumes

The following volumes are created to persist data:

- `db-data` - SQLite database file (`/data/system.db`)
- `backup-data` - Backup files (`/app/backups/`)

## Environment Variables

You can also use environment variables instead of secrets by setting them directly in `docker-compose.yml`:

```yaml
environment:
  - DATABASE_URL=file:/data/system.db
  - JWT_SECRET=your-secret
  - ENCRYPTION_KEY=your-key
  - BACKUP_BASE_PATH=./backups
```

However, using Docker secrets is recommended for production as they are more secure.

## Production Deployment

For production, ensure:

1. **Strong Secrets**: Use `openssl` or PowerShell to generate secure random secrets
2. **HTTPS**: Use a reverse proxy (nginx, Traefik) with SSL certificates
3. **Backups**: Regularly backup the `db-data` volume
4. **Monitoring**: Set up health checks and monitoring
5. **Updates**: Keep the image updated and rebuild regularly

## Troubleshooting

### Database Migration Issues

If you see Prisma errors, the database might need migration:

```bash
docker-compose exec simple-backup bunx prisma migrate deploy
```

### Permission Issues

If you see permission errors, check volume ownership:

```bash
docker-compose exec simple-backup ls -la /data
```

### View Logs

```bash
docker-compose logs -f simple-backup
```

### Check Secrets

Verify that secrets are mounted correctly:

```bash
docker-compose exec simple-backup cat /run/secrets/DATABASE_URL
```

## Development Mode

Development mode includes:

- Hot reload with volume mounts
- Runs on port 3001
- Includes development dependencies

```bash
docker-compose -f docker-compose.dev.yml up
```

## Docker Commands

### Build Image

```bash
docker-compose build
```

### Start Services

```bash
docker-compose up -d
```

### Stop Services

```bash
docker-compose down
```

### View Logs

```bash
docker-compose logs -f simple-backup
```

### Execute Commands in Container

```bash
docker-compose exec simple-backup sh
```

### Backup Database Volume

```bash
docker run --rm -v simple-backup_db-data:/data -v $(pwd):/backup alpine tar czf /backup/db-backup.tar.gz /data
```

### Restore Database Volume

```bash
docker run --rm -v simple-backup_db-data:/data -v $(pwd):/backup alpine tar xzf /backup/db-backup.tar.gz -C /
```
