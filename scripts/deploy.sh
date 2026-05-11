#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Bookio Backend — Script de Despliegue Parametrizado
# Despliega la aplicación en una instancia EC2 mediante SSH.
#
# Uso:
#   bash scripts/deploy.sh --host <EC2_IP> --user <EC2_USER> --key <SSH_KEY_PATH>
#
# Ejemplo:
#   bash scripts/deploy.sh --host 54.200.1.100 --user ec2-user --key ~/.ssh/bookio.pem
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ─── Colores para output ────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ─── Variables por defecto ───────────────────────────────────────────────────
EC2_HOST=""
EC2_USER="ec2-user"
SSH_KEY=""
REMOTE_DIR="/home/ec2-user/bookio-backend"
APP_NAME="bookio-backend"
SKIP_BUILD=false

# ─── Parseo de argumentos ───────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --host)       EC2_HOST="$2";    shift 2 ;;
    --user)       EC2_USER="$2";    shift 2 ;;
    --key)        SSH_KEY="$2";     shift 2 ;;
    --remote-dir) REMOTE_DIR="$2";  shift 2 ;;
    --skip-build) SKIP_BUILD=true;  shift   ;;
    *)
      echo -e "${RED}❌ Argumento desconocido: $1${NC}"
      exit 1
      ;;
  esac
done

# ─── Validaciones ───────────────────────────────────────────────────────────
if [[ -z "$EC2_HOST" ]]; then
  echo -e "${RED}❌ Error: --host es requerido.${NC}"
  exit 1
fi

if [[ -z "$SSH_KEY" ]]; then
  echo -e "${RED}❌ Error: --key es requerido.${NC}"
  exit 1
fi

if [[ ! -f "$SSH_KEY" ]]; then
  echo -e "${RED}❌ Error: Archivo de llave SSH no encontrado: $SSH_KEY${NC}"
  exit 1
fi

SSH_CMD="ssh -i $SSH_KEY -o StrictHostKeyChecking=no $EC2_USER@$EC2_HOST"
SCP_CMD="scp -i $SSH_KEY -o StrictHostKeyChecking=no"

# ─── Step 1: Build local ────────────────────────────────────────────────────
if [[ "$SKIP_BUILD" == "false" ]]; then
  echo -e "${YELLOW}[1/5] Compilando proyecto localmente...${NC}"
  npx prisma generate
  npm run build
else
  echo -e "${YELLOW}[1/5] Build omitido (--skip-build)${NC}"
fi

# ─── Step 2: Transferir archivos ─────────────────────────────────────────────
echo -e "${YELLOW}[2/5] Transfiriendo archivos a EC2 ($EC2_HOST)...${NC}"
$SSH_CMD "mkdir -p $REMOTE_DIR/dist $REMOTE_DIR/prisma"

# dist/ → REMOTE_DIR/dist/  (compilado)
rsync -az --delete \
  -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" \
  dist/ \
  "$EC2_USER@$EC2_HOST:$REMOTE_DIR/dist/"

# prisma/ → REMOTE_DIR/prisma/  (schema y migraciones)
rsync -az --delete \
  -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" \
  prisma/ \
  "$EC2_USER@$EC2_HOST:$REMOTE_DIR/prisma/"

# package files
rsync -az \
  -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" \
  package.json package-lock.json \
  "$EC2_USER@$EC2_HOST:$REMOTE_DIR/"

# ─── Step 3: Instalar dependencias en remoto ─────────────────────────────────
echo -e "${YELLOW}[3/5] Instalando dependencias en producción...${NC}"
$SSH_CMD "cd $REMOTE_DIR && HUSKY=0 npm ci --omit=dev"

# ─── Step 4: Ejecutar migraciones de Prisma ──────────────────────────────────
echo -e "${YELLOW}🗄️  [4/5] Sincronizando esquema de base de datos...${NC}"
$SSH_CMD "cd $REMOTE_DIR && npx prisma generate && npx prisma db push --accept-data-loss"

# ─── Step 5: Reiniciar la aplicación ─────────────────────────────────────────
echo -e "${YELLOW}🔄 [5/5] Reiniciando aplicación con PM2...${NC}"
$SSH_CMD "cd $REMOTE_DIR && pm2 restart $APP_NAME || pm2 start dist/src/index.js --name $APP_NAME"

echo -e "${GREEN}✅ Deploy completado exitosamente en $EC2_HOST${NC}"
echo -e "${GREEN}   App: $APP_NAME | Dir: $REMOTE_DIR${NC}"
