#!/usr/bin/env bash
# =============================================================================
# Bookio — AWS Infrastructure Setup
# Compatible con AWS Academy Learner's Lab (us-east-1)
#
# USO:
#   bash scripts/setup_aws.sh [--email tu@correo.com] [--repo-url https://...]
#
# REQUISITOS:
#   - AWS CLI v2 configurado con credenciales del Learner's Lab
#   - jq instalado (brew install jq / apt install jq)
#   - openssl (viene en macOS/Linux)
#
# SERVICIOS QUE CREA:
#   EC2 t3.micro        — Backend Node.js (LabInstanceProfile)
#   RDS db.t3.micro     — PostgreSQL 16
#   S3                  — Verifica buckets existentes + static website
#   SQS                 — Cola de citas (bookio-appointments-queue)
#   SES                 — Email sender (modo sandbox)
#   Secrets Manager     — Credenciales DB + Firebase
# =============================================================================

set -euo pipefail

# ─── Colores ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()    { echo -e "${GREEN}[✓]${NC} $1"; }
warn()   { echo -e "${YELLOW}[!]${NC} $1"; }
info()   { echo -e "${CYAN}[→]${NC} $1"; }
error()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }
header() { echo -e "\n${BOLD}${CYAN}━━━ $1 ━━━${NC}"; }

# ─── Configuración ───────────────────────────────────────────────────────────
REGION="us-east-1"
APP_NAME="bookio"
INSTANCE_TYPE="t3.micro"
RDS_CLASS="db.t3.micro"
RDS_IDENTIFIER="${APP_NAME}-db"
KEY_NAME="${APP_NAME}-key"
SG_EC2_NAME="${APP_NAME}-ec2-sg"
SG_RDS_NAME="${APP_NAME}-rds-sg"
RDS_SUBNET_GROUP="${APP_NAME}-subnet-group"
SECRET_DB="${APP_NAME}/db"
SECRET_FIREBASE="${APP_NAME}/firebase"
SECRET_SMTP="${APP_NAME}/smtp"
SQS_QUEUE_NAME="${APP_NAME}-appointments-queue"
S3_ASSETS_BUCKET="bookio-assets-bucket"
S3_WEBSITE_BUCKET="bookio-static-website"
STATE_FILE="$(dirname "$0")/.aws_resources"

# ─── Argumentos opcionales ───────────────────────────────────────────────────
SMTP_USER=""
SMTP_PASS=""
REPO_URL="https://github.com/AlanDVarela/bookio-backend.git"

while [[ $# -gt 0 ]]; do
  case $1 in
    --smtp-user) SMTP_USER="$2"; shift 2 ;;
    --smtp-pass) SMTP_PASS="$2"; shift 2 ;;
    --repo-url)  REPO_URL="$2";  shift 2 ;;
    *) warn "Argumento desconocido: $1"; shift ;;
  esac
done

if [[ -z "$SMTP_USER" ]]; then
  echo -n "Correo Gmail para enviar notificaciones (ej: tuapp@gmail.com): "
  read -r SMTP_USER
fi
if [[ -z "$SMTP_PASS" ]]; then
  echo -n "App Password de Gmail (16 chars, sin espacios): "
  read -rs SMTP_PASS
  echo ""
fi

# ─── Prerequisitos ───────────────────────────────────────────────────────────
header "Verificando prerequisitos"

command -v aws  &>/dev/null || error "AWS CLI no encontrado. Instálalo: https://aws.amazon.com/cli/"
command -v jq   &>/dev/null || error "jq no encontrado. Instálalo: brew install jq"
command -v openssl &>/dev/null || error "openssl no encontrado"

# Verificar credenciales activas
CALLER=$(aws sts get-caller-identity --region "$REGION" --output json 2>/dev/null) \
  || error "Credenciales AWS inválidas o expiradas. Ejecuta: bash scripts/update_credentials.sh"

ACCOUNT_ID=$(echo "$CALLER" | jq -r '.Account')
log "Cuenta AWS: $ACCOUNT_ID | Región: $REGION"

# Verificar LabInstanceProfile (requerido en Learner's Lab)
INSTANCE_PROFILE=$(aws iam get-instance-profile \
  --instance-profile-name LabInstanceProfile \
  --region "$REGION" \
  --query 'InstanceProfile.InstanceProfileName' \
  --output text 2>/dev/null) || true

if [[ "$INSTANCE_PROFILE" != "LabInstanceProfile" ]]; then
  error "LabInstanceProfile no encontrado. Este script requiere AWS Academy Learner's Lab."
fi
log "LabInstanceProfile verificado"

# ─── VPC y Subnets ───────────────────────────────────────────────────────────
header "Obteniendo VPC default"

VPC_ID=$(aws ec2 describe-vpcs \
  --filters "Name=isDefault,Values=true" \
  --query "Vpcs[0].VpcId" \
  --output text \
  --region "$REGION")
[[ "$VPC_ID" == "None" || -z "$VPC_ID" ]] && error "No se encontró VPC default"
log "VPC: $VPC_ID"

# Obtener subnets en diferentes AZs (RDS necesita mínimo 2)
SUBNETS=$(aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" "Name=defaultForAz,Values=true" \
  --query "Subnets[*].SubnetId" \
  --output text \
  --region "$REGION")
SUBNET_ARRAY=($SUBNETS)
[[ ${#SUBNET_ARRAY[@]} -lt 2 ]] && error "Se necesitan al menos 2 subnets para RDS. Encontradas: ${#SUBNET_ARRAY[@]}"
SUBNET_1="${SUBNET_ARRAY[0]}"
SUBNET_2="${SUBNET_ARRAY[1]}"
log "Subnets: $SUBNET_1 | $SUBNET_2"

# ─── Key Pair ─────────────────────────────────────────────────────────────────
header "Key Pair SSH"

KEY_FILE="$HOME/.ssh/${KEY_NAME}.pem"

if aws ec2 describe-key-pairs --key-names "$KEY_NAME" --region "$REGION" &>/dev/null; then
  warn "Key pair '$KEY_NAME' ya existe. Si no tienes el .pem, bórralo primero con cleanup."
else
  info "Creando key pair ${KEY_NAME}..."
  aws ec2 create-key-pair \
    --key-name "$KEY_NAME" \
    --query "KeyMaterial" \
    --output text \
    --region "$REGION" > "$KEY_FILE"
  chmod 400 "$KEY_FILE"
  log "Key guardada en: $KEY_FILE"
fi

# ─── Security Groups ─────────────────────────────────────────────────────────
header "Security Groups"

# Security Group para EC2
SG_EC2_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=$SG_EC2_NAME" "Name=vpc-id,Values=$VPC_ID" \
  --query "SecurityGroups[0].GroupId" --output text --region "$REGION" 2>/dev/null || echo "None")

if [[ "$SG_EC2_ID" == "None" || -z "$SG_EC2_ID" ]]; then
  SG_EC2_ID=$(aws ec2 create-security-group \
    --group-name "$SG_EC2_NAME" \
    --description "Bookio EC2 — SSH y API" \
    --vpc-id "$VPC_ID" \
    --query "GroupId" --output text --region "$REGION")

  # SSH (solo desde tu IP — más seguro)
  MY_IP=$(curl -s https://checkip.amazonaws.com)
  aws ec2 authorize-security-group-ingress \
    --group-id "$SG_EC2_ID" --protocol tcp --port 22 \
    --cidr "${MY_IP}/32" --region "$REGION" &>/dev/null || true
  # API pública
  aws ec2 authorize-security-group-ingress \
    --group-id "$SG_EC2_ID" --protocol tcp --port 3000 \
    --cidr "0.0.0.0/0" --region "$REGION" &>/dev/null || true
  aws ec2 authorize-security-group-ingress \
    --group-id "$SG_EC2_ID" --protocol tcp --port 80 \
    --cidr "0.0.0.0/0" --region "$REGION" &>/dev/null || true
  log "EC2 Security Group creado: $SG_EC2_ID"
else
  log "EC2 Security Group ya existe: $SG_EC2_ID"
fi

# Security Group para RDS
SG_RDS_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=$SG_RDS_NAME" "Name=vpc-id,Values=$VPC_ID" \
  --query "SecurityGroups[0].GroupId" --output text --region "$REGION" 2>/dev/null || echo "None")

if [[ "$SG_RDS_ID" == "None" || -z "$SG_RDS_ID" ]]; then
  SG_RDS_ID=$(aws ec2 create-security-group \
    --group-name "$SG_RDS_NAME" \
    --description "Bookio RDS — PostgreSQL solo desde EC2" \
    --vpc-id "$VPC_ID" \
    --query "GroupId" --output text --region "$REGION")

  # Solo desde el SG de EC2
  aws ec2 authorize-security-group-ingress \
    --group-id "$SG_RDS_ID" \
    --protocol tcp --port 5432 \
    --source-group "$SG_EC2_ID" \
    --region "$REGION" &>/dev/null || true
  # También desde tu IP local (para debugging con DBeaver/TablePlus)
  MY_IP=$(curl -s https://checkip.amazonaws.com)
  aws ec2 authorize-security-group-ingress \
    --group-id "$SG_RDS_ID" --protocol tcp --port 5432 \
    --cidr "${MY_IP}/32" --region "$REGION" &>/dev/null || true
  log "RDS Security Group creado: $SG_RDS_ID"
else
  log "RDS Security Group ya existe: $SG_RDS_ID"
fi

# ─── RDS Subnet Group ─────────────────────────────────────────────────────────
header "RDS Subnet Group"

if aws rds describe-db-subnet-groups --db-subnet-group-name "$RDS_SUBNET_GROUP" \
  --region "$REGION" &>/dev/null; then
  log "RDS Subnet Group ya existe"
else
  aws rds create-db-subnet-group \
    --db-subnet-group-name "$RDS_SUBNET_GROUP" \
    --db-subnet-group-description "Bookio RDS subnets" \
    --subnet-ids "$SUBNET_1" "$SUBNET_2" \
    --region "$REGION" &>/dev/null
  log "RDS Subnet Group creado"
fi

# ─── RDS PostgreSQL ───────────────────────────────────────────────────────────
header "RDS PostgreSQL (db.t3.micro)"

RDS_ENDPOINT=""
DB_PASS=""

RDS_STATUS=$(aws rds describe-db-instances \
  --db-instance-identifier "$RDS_IDENTIFIER" \
  --query "DBInstances[0].DBInstanceStatus" \
  --output text --region "$REGION" 2>/dev/null || echo "not-found")

if [[ "$RDS_STATUS" == "not-found" ]]; then
  # Generar contraseña segura
  DB_PASS=$(openssl rand -base64 16 | tr -dc 'A-Za-z0-9' | head -c 20)
  info "Creando RDS PostgreSQL (esto tarda ~5 minutos)..."

  aws rds create-db-instance \
    --db-instance-identifier "$RDS_IDENTIFIER" \
    --db-instance-class "$RDS_CLASS" \
    --engine postgres \
    --engine-version "16" \
    --allocated-storage 20 \
    --storage-type gp2 \
    --master-username bookio_admin \
    --master-user-password "$DB_PASS" \
    --db-name bookio \
    --vpc-security-group-ids "$SG_RDS_ID" \
    --db-subnet-group-name "$RDS_SUBNET_GROUP" \
    --publicly-accessible \
    --no-multi-az \
    --backup-retention-period 0 \
    --no-deletion-protection \
    --no-enable-performance-insights \
    --region "$REGION" &>/dev/null

  info "Esperando que RDS esté disponible (puede tardar 3-7 min)..."
  aws rds wait db-instance-available \
    --db-instance-identifier "$RDS_IDENTIFIER" \
    --region "$REGION"
  log "RDS disponible"
elif [[ "$RDS_STATUS" == "stopped" ]]; then
  warn "RDS está detenida. Iniciándola..."
  aws rds start-db-instance --db-instance-identifier "$RDS_IDENTIFIER" --region "$REGION" &>/dev/null
  aws rds wait db-instance-available --db-instance-identifier "$RDS_IDENTIFIER" --region "$REGION"
  log "RDS iniciada"
else
  log "RDS ya existe con status: $RDS_STATUS"
  # Intentar leer contraseña del Secrets Manager si ya existe
  DB_PASS=$(aws secretsmanager get-secret-value \
    --secret-id "$SECRET_DB" --region "$REGION" \
    --query "SecretString" --output text 2>/dev/null | \
    jq -r '.password // empty' 2>/dev/null || echo "")
fi

RDS_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier "$RDS_IDENTIFIER" \
  --query "DBInstances[0].Endpoint.Address" \
  --output text --region "$REGION")
log "RDS Endpoint: $RDS_ENDPOINT"
DATABASE_URL="postgresql://bookio_admin:${DB_PASS}@${RDS_ENDPOINT}:5432/bookio?schema=public"

# ─── Secrets Manager ─────────────────────────────────────────────────────────
header "Secrets Manager"

create_or_update_secret() {
  local NAME="$1"
  local VALUE="$2"
  if aws secretsmanager describe-secret --secret-id "$NAME" --region "$REGION" &>/dev/null; then
    aws secretsmanager put-secret-value \
      --secret-id "$NAME" --secret-string "$VALUE" \
      --region "$REGION" &>/dev/null
    log "Secret actualizado: $NAME"
  else
    aws secretsmanager create-secret \
      --name "$NAME" --secret-string "$VALUE" \
      --region "$REGION" &>/dev/null
    log "Secret creado: $NAME"
  fi
}

# Secret DB — contiene URL completa + credenciales separadas
create_or_update_secret "$SECRET_DB" \
  "{\"url\":\"${DATABASE_URL}\",\"host\":\"${RDS_ENDPOINT}\",\"port\":\"5432\",\"database\":\"bookio\",\"username\":\"bookio_admin\",\"password\":\"${DB_PASS}\"}"

# Secret Firebase — el usuario deberá actualizar esto con sus credenciales reales
if ! aws secretsmanager describe-secret --secret-id "$SECRET_FIREBASE" --region "$REGION" &>/dev/null; then
  create_or_update_secret "$SECRET_FIREBASE" \
    "{\"project_id\":\"YOUR_FIREBASE_PROJECT_ID\",\"client_email\":\"YOUR_FIREBASE_CLIENT_EMAIL\",\"private_key\":\"YOUR_FIREBASE_PRIVATE_KEY\"}"
  warn "Secret Firebase creado con placeholders. Actualiza '$SECRET_FIREBASE' con tus credenciales reales."
else
  log "Secret Firebase ya existe: $SECRET_FIREBASE"
fi

# Secret SMTP — credenciales de Gmail para Nodemailer
create_or_update_secret "$SECRET_SMTP" \
  "{\"smtp_user\":\"${SMTP_USER}\",\"smtp_pass\":\"${SMTP_PASS}\"}"

# ─── SQS Queue ────────────────────────────────────────────────────────────────
header "SQS Queue"

SQS_QUEUE_URL=$(aws sqs get-queue-url \
  --queue-name "$SQS_QUEUE_NAME" \
  --region "$REGION" \
  --query "QueueUrl" --output text 2>/dev/null || echo "")

if [[ -z "$SQS_QUEUE_URL" ]]; then
  SQS_QUEUE_URL=$(aws sqs create-queue \
    --queue-name "$SQS_QUEUE_NAME" \
    --attributes '{
      "VisibilityTimeout": "60",
      "MessageRetentionPeriod": "86400",
      "ReceiveMessageWaitTimeSeconds": "20"
    }' \
    --region "$REGION" \
    --query "QueueUrl" --output text)
  log "SQS Queue creada: $SQS_QUEUE_URL"
else
  log "SQS Queue ya existe: $SQS_QUEUE_URL"
fi

SQS_QUEUE_ARN=$(aws sqs get-queue-attributes \
  --queue-url "$SQS_QUEUE_URL" \
  --attribute-names QueueArn \
  --query "Attributes.QueueArn" --output text --region "$REGION")

# ─── Email: Nodemailer + Gmail SMTP ──────────────────────────────────────────
# Las credenciales ya se guardaron en Secrets Manager (bookio/smtp).
# EC2 las leerá automáticamente vía LabInstanceProfile.
# No se necesita SES: el backend usa Nodemailer + Gmail port 587 (abierto en EC2).
log "Credenciales SMTP guardadas en Secrets Manager: $SECRET_SMTP"

# ─── S3 Buckets ───────────────────────────────────────────────────────────────
header "S3 Buckets"

# Verificar bucket de assets
if aws s3api head-bucket --bucket "$S3_ASSETS_BUCKET" 2>/dev/null; then
  log "Assets bucket existe: $S3_ASSETS_BUCKET"
  # Asegurar CORS para uploads del backend
  aws s3api put-bucket-cors \
    --bucket "$S3_ASSETS_BUCKET" \
    --cors-configuration '{
      "CORSRules": [{
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET","PUT","POST","DELETE"],
        "AllowedOrigins": ["*"],
        "MaxAgeSeconds": 3000
      }]
    }' --region "$REGION" &>/dev/null
else
  warn "Bucket '$S3_ASSETS_BUCKET' no encontrado. Créalo manualmente si es necesario."
fi

# Verificar bucket de static website
if aws s3api head-bucket --bucket "$S3_WEBSITE_BUCKET" 2>/dev/null; then
  log "Website bucket existe: $S3_WEBSITE_BUCKET"
  # Configurar como static website
  aws s3 website "s3://$S3_WEBSITE_BUCKET/" \
    --index-document index.html \
    --error-document index.html 2>/dev/null || true

  # Public read policy
  aws s3api put-bucket-policy \
    --bucket "$S3_WEBSITE_BUCKET" \
    --policy "{
      \"Version\": \"2012-10-17\",
      \"Statement\": [{
        \"Effect\": \"Allow\",
        \"Principal\": \"*\",
        \"Action\": \"s3:GetObject\",
        \"Resource\": \"arn:aws:s3:::${S3_WEBSITE_BUCKET}/*\"
      }]
    }" 2>/dev/null || true

  aws s3api put-bucket-acl \
    --bucket "$S3_WEBSITE_BUCKET" \
    --acl public-read 2>/dev/null || warn "No se pudo poner public-read ACL en website bucket (puede ser normal)"

  log "Static website URL: http://${S3_WEBSITE_BUCKET}.s3-website-${REGION}.amazonaws.com"
else
  warn "Bucket '$S3_WEBSITE_BUCKET' no encontrado. Créalo manualmente para el frontend Angular."
fi

# ─── EC2 Instance ─────────────────────────────────────────────────────────────
header "EC2 Instance (t3.micro)"

# Obtener AMI más reciente de Amazon Linux 2023
info "Buscando AMI más reciente de Amazon Linux 2023..."
AMI_ID=$(aws ec2 describe-images \
  --owners amazon \
  --filters \
    "Name=name,Values=al2023-ami-2023*-x86_64" \
    "Name=state,Values=available" \
    "Name=architecture,Values=x86_64" \
  --query "Images | sort_by(@, &CreationDate) | [-1].ImageId" \
  --output text --region "$REGION")
log "AMI: $AMI_ID"

# Verificar si ya existe una instancia bookio-backend running/stopped
EXISTING_INSTANCE=$(aws ec2 describe-instances \
  --filters \
    "Name=tag:Name,Values=bookio-backend" \
    "Name=instance-state-name,Values=running,stopped,pending" \
  --query "Reservations[0].Instances[0].InstanceId" \
  --output text --region "$REGION" 2>/dev/null || echo "None")

if [[ "$EXISTING_INSTANCE" != "None" && -n "$EXISTING_INSTANCE" ]]; then
  EC2_INSTANCE_ID="$EXISTING_INSTANCE"
  log "EC2 ya existe: $EC2_INSTANCE_ID"
else
  # UserData — configura el servidor en el primer arranque
  # Nota: Usa LabRole vía instance metadata, sin credenciales hardcodeadas
  USER_DATA=$(cat <<USERDATA
#!/bin/bash
set -e
exec > /var/log/bookio-init.log 2>&1
echo "=== Bookio EC2 Init: \$(date) ==="

# Actualizar sistema
dnf update -y 2>/dev/null || yum update -y

# Instalar Node.js 20 + git
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
dnf install -y nodejs git 2>/dev/null || yum install -y nodejs git

# Herramientas globales
npm install -g pm2 tsx

# Directorio de la app
APP_DIR=/home/ec2-user/bookio-backend
mkdir -p \$APP_DIR

# Clonar repositorio
git clone ${REPO_URL} \$APP_DIR
cd \$APP_DIR

# Obtener secretos de Secrets Manager (usando LabRole del instance profile)
# Obtener DATABASE_URL desde Secrets Manager (solo para prisma db push)
DB_SECRET=\$(aws secretsmanager get-secret-value \
  --secret-id ${SECRET_DB} \
  --region ${REGION} \
  --query SecretString --output text)
DB_URL=\$(echo "\$DB_SECRET" | python3 -c "import sys,json; print(json.load(sys.stdin)['url'])")

# .env mínimo — solo variables no sensibles.
# DATABASE_URL, Firebase y SMTP los carga el app desde Secrets Manager en runtime
# (via src/config/secrets.config.ts → loadSecretsIntoEnv).
cat > \$APP_DIR/.env << ENVFILE
PORT=3000
NODE_ENV=production
AWS_REGION=${REGION}
S3_BUCKET_NAME=${S3_ASSETS_BUCKET}
SQS_QUEUE_URL=${SQS_QUEUE_URL}
ENVFILE

# Instalar dependencias
npm ci

# Compilar TypeScript
npm run build

# Prisma: requiere DATABASE_URL para el push, se pasa inline
npx prisma generate
DATABASE_URL="\$DB_URL" npx prisma db push --accept-data-loss 2>/dev/null || true

# Cambiar owner
chown -R ec2-user:ec2-user \$APP_DIR

# Iniciar con PM2
sudo -u ec2-user pm2 start \$APP_DIR/dist/index.js --name bookio-backend
sudo -u ec2-user pm2 startup systemd -u ec2-user --hp /home/ec2-user 2>/dev/null || true
sudo -u ec2-user pm2 save

echo "=== Bookio init completado: \$(date) ==="
USERDATA
)

  info "Lanzando EC2 instance..."
  EC2_INSTANCE_ID=$(aws ec2 run-instances \
    --image-id "$AMI_ID" \
    --instance-type "$INSTANCE_TYPE" \
    --key-name "$KEY_NAME" \
    --security-group-ids "$SG_EC2_ID" \
    --iam-instance-profile Name=LabInstanceProfile \
    --user-data "$USER_DATA" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=bookio-backend}]" \
    --metadata-options "HttpTokens=optional,HttpEndpoint=enabled" \
    --query "Instances[0].InstanceId" \
    --output text --region "$REGION")

  info "Esperando que EC2 arranque..."
  aws ec2 wait instance-running \
    --instance-ids "$EC2_INSTANCE_ID" \
    --region "$REGION"
  log "EC2 corriendo: $EC2_INSTANCE_ID"
fi

EC2_PUBLIC_IP=$(aws ec2 describe-instances \
  --instance-ids "$EC2_INSTANCE_ID" \
  --query "Reservations[0].Instances[0].PublicIpAddress" \
  --output text --region "$REGION")
EC2_PUBLIC_DNS=$(aws ec2 describe-instances \
  --instance-ids "$EC2_INSTANCE_ID" \
  --query "Reservations[0].Instances[0].PublicDnsName" \
  --output text --region "$REGION")

# ─── Guardar estado (para cleanup) ───────────────────────────────────────────
header "Guardando estado"

cat > "$STATE_FILE" <<STATE
# Bookio AWS Resources — $(date)
# Generado por setup_aws.sh — NO editar manualmente
REGION="${REGION}"
ACCOUNT_ID="${ACCOUNT_ID}"
APP_NAME="${APP_NAME}"
KEY_NAME="${KEY_NAME}"
KEY_FILE="${KEY_FILE}"
VPC_ID="${VPC_ID}"
SG_EC2_ID="${SG_EC2_ID}"
SG_RDS_ID="${SG_RDS_ID}"
RDS_SUBNET_GROUP="${RDS_SUBNET_GROUP}"
RDS_IDENTIFIER="${RDS_IDENTIFIER}"
RDS_ENDPOINT="${RDS_ENDPOINT}"
SECRET_DB="${SECRET_DB}"
SECRET_FIREBASE="${SECRET_FIREBASE}"
SECRET_SMTP="${SECRET_SMTP}"
SQS_QUEUE_URL="${SQS_QUEUE_URL}"
SQS_QUEUE_ARN="${SQS_QUEUE_ARN}"
SQS_QUEUE_NAME="${SQS_QUEUE_NAME}"
SMTP_USER="${SMTP_USER}"
S3_ASSETS_BUCKET="${S3_ASSETS_BUCKET}"
S3_WEBSITE_BUCKET="${S3_WEBSITE_BUCKET}"
EC2_INSTANCE_ID="${EC2_INSTANCE_ID}"
EC2_PUBLIC_IP="${EC2_PUBLIC_IP}"
EC2_PUBLIC_DNS="${EC2_PUBLIC_DNS}"
STATE

log "Estado guardado en: $STATE_FILE"

# ─── Resumen ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${GREEN}  ✅  BOOKIO INFRAESTRUCTURA LISTA${NC}"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${CYAN}EC2 Backend${NC}"
echo -e "    IP pública:   ${BOLD}$EC2_PUBLIC_IP${NC}"
echo -e "    API:          ${BOLD}http://$EC2_PUBLIC_IP:3000${NC}"
echo -e "    Health check: ${BOLD}http://$EC2_PUBLIC_IP:3000/health${NC}"
echo -e "    SSH:          ${BOLD}ssh -i $KEY_FILE ec2-user@$EC2_PUBLIC_IP${NC}"
echo ""
echo -e "  ${CYAN}RDS PostgreSQL${NC}"
echo -e "    Endpoint:     ${BOLD}$RDS_ENDPOINT:5432${NC}"
echo -e "    Database:     ${BOLD}bookio${NC}"
echo -e "    Usuario:      ${BOLD}bookio_admin${NC}"
echo ""
echo -e "  ${CYAN}SQS Queue${NC}"
echo -e "    URL:          ${BOLD}$SQS_QUEUE_URL${NC}"
echo ""
echo -e "  ${CYAN}S3 Frontend${NC}"
echo -e "    URL:          ${BOLD}http://${S3_WEBSITE_BUCKET}.s3-website-${REGION}.amazonaws.com${NC}"
echo ""
echo -e "  ${CYAN}Email (Nodemailer + Gmail SMTP)${NC}"
echo -e "    From:         ${BOLD}$SMTP_USER${NC}"
echo -e "    Pass secret:  Secrets Manager → ${BOLD}$SECRET_SMTP${NC}"
echo ""
echo -e "${YELLOW}IMPORTANTE — Próximos pasos:${NC}"
echo -e "  1. Actualiza el secret Firebase en Secrets Manager:"
echo -e "     ${BOLD}aws secretsmanager put-secret-value --secret-id bookio/firebase \\${NC}"
echo -e "       ${BOLD}--secret-string '{\"project_id\":\"...\",\"client_email\":\"...\",\"private_key\":\"...\"}' --region $REGION${NC}"
echo -e "  2. Verifica el correo en SES (revisa tu bandeja de entrada)"
echo -e "  3. Logs del EC2: ${BOLD}ssh -i $KEY_FILE ec2-user@$EC2_PUBLIC_IP 'tail -f /var/log/bookio-init.log'${NC}"
echo -e "  4. Actualiza CORS en src/index.ts con la IP: ${BOLD}http://$EC2_PUBLIC_IP:3000${NC}"
echo ""
echo -e "${YELLOW}AHORRO DE COSTOS:${NC}"
echo -e "  Detener todo:  ${BOLD}bash scripts/stop_all.sh${NC}"
echo -e "  Iniciar todo:  ${BOLD}bash scripts/start_all.sh${NC}"
echo ""
