#!/usr/bin/env bash
# =============================================================================
# Bookio — AWS Infrastructure Cleanup
#
# USO:
#   bash scripts/cleanup_aws.sh
#
# Elimina TODOS los recursos creados por setup_aws.sh.
# Lee los IDs del archivo .aws_resources.
# Los buckets S3 NO se eliminan (tienen assets del proyecto).
# =============================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()    { echo -e "${GREEN}[✓]${NC} $1"; }
warn()   { echo -e "${YELLOW}[!]${NC} $1"; }
info()   { echo -e "${CYAN}[→]${NC} $1"; }
skip()   { echo -e "  ${CYAN}[–]${NC} $1"; }
header() { echo -e "\n${BOLD}${CYAN}━━━ $1 ━━━${NC}"; }

STATE_FILE="$(dirname "$0")/.aws_resources"

[[ -f "$STATE_FILE" ]] || {
  echo -e "${RED}[✗]${NC} No se encontró $STATE_FILE"
  echo "   Ejecuta setup_aws.sh primero, o crea el archivo manualmente."
  exit 1
}

# Cargar estado
# shellcheck disable=SC1090
source "$STATE_FILE"

echo ""
echo -e "${BOLD}${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${RED}  ⚠️   BOOKIO AWS CLEANUP${NC}"
echo -e "${BOLD}${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Se eliminarán los siguientes recursos:"
echo -e "  • EC2: ${BOLD}$EC2_INSTANCE_ID${NC}"
echo -e "  • RDS: ${BOLD}$RDS_IDENTIFIER${NC}"
echo -e "  • SQS: ${BOLD}$SQS_QUEUE_NAME${NC}"
echo -e "  • Secrets: ${BOLD}$SECRET_DB, $SECRET_FIREBASE${NC}"
echo -e "  • Security Groups: ${BOLD}$SG_EC2_ID, $SG_RDS_ID${NC}"
echo -e "  • Key Pair: ${BOLD}$KEY_NAME${NC}"
echo -e "  ${YELLOW}• S3 buckets NO se eliminan (tienen tus archivos)${NC}"
echo ""
echo -n "¿Confirmas? Escribe 'si' para continuar: "
read -r CONFIRM
[[ "$CONFIRM" == "si" ]] || { echo "Cancelado."; exit 0; }

# ─── EC2 ──────────────────────────────────────────────────────────────────────
header "Terminando EC2"

if [[ -n "${EC2_INSTANCE_ID:-}" ]]; then
  EC2_STATE=$(aws ec2 describe-instances \
    --instance-ids "$EC2_INSTANCE_ID" \
    --query "Reservations[0].Instances[0].State.Name" \
    --output text --region "$REGION" 2>/dev/null || echo "not-found")

  if [[ "$EC2_STATE" != "terminated" && "$EC2_STATE" != "not-found" ]]; then
    info "Terminando instancia $EC2_INSTANCE_ID..."
    aws ec2 terminate-instances \
      --instance-ids "$EC2_INSTANCE_ID" \
      --region "$REGION" &>/dev/null
    info "Esperando que EC2 termine..."
    aws ec2 wait instance-terminated \
      --instance-ids "$EC2_INSTANCE_ID" \
      --region "$REGION"
    log "EC2 terminada"
  else
    skip "EC2 ya terminada o no encontrada"
  fi
else
  skip "EC2_INSTANCE_ID no definido"
fi

# ─── SQS ──────────────────────────────────────────────────────────────────────
header "Eliminando SQS Queue"

if [[ -n "${SQS_QUEUE_URL:-}" ]]; then
  aws sqs delete-queue \
    --queue-url "$SQS_QUEUE_URL" \
    --region "$REGION" &>/dev/null && log "SQS Queue eliminada" || skip "SQS Queue no encontrada"
else
  skip "SQS_QUEUE_URL no definido"
fi

# ─── Secrets Manager ──────────────────────────────────────────────────────────
header "Eliminando Secrets Manager"

for SECRET in "${SECRET_DB:-}" "${SECRET_FIREBASE:-}" "${SECRET_SMTP:-}"; do
  [[ -z "$SECRET" ]] && continue
  aws secretsmanager delete-secret \
    --secret-id "$SECRET" \
    --force-delete-without-recovery \
    --region "$REGION" &>/dev/null && log "Secret eliminado: $SECRET" || skip "Secret no encontrado: $SECRET"
done

# ─── RDS ──────────────────────────────────────────────────────────────────────
header "Eliminando RDS"

RDS_STATUS=$(aws rds describe-db-instances \
  --db-instance-identifier "${RDS_IDENTIFIER:-}" \
  --query "DBInstances[0].DBInstanceStatus" \
  --output text --region "$REGION" 2>/dev/null || echo "not-found")

if [[ "$RDS_STATUS" != "not-found" ]]; then
  # Si está detenida, hay que iniciarla para poder eliminarla
  if [[ "$RDS_STATUS" == "stopped" ]]; then
    warn "RDS está detenida, iniciándola para poder eliminarla..."
    aws rds start-db-instance --db-instance-identifier "$RDS_IDENTIFIER" --region "$REGION" &>/dev/null || true
    aws rds wait db-instance-available --db-instance-identifier "$RDS_IDENTIFIER" --region "$REGION" || true
  fi

  info "Eliminando RDS $RDS_IDENTIFIER (sin snapshot final)..."
  aws rds delete-db-instance \
    --db-instance-identifier "$RDS_IDENTIFIER" \
    --skip-final-snapshot \
    --delete-automated-backups \
    --region "$REGION" &>/dev/null
  info "Esperando eliminación de RDS (puede tardar varios minutos)..."
  aws rds wait db-instance-deleted \
    --db-instance-identifier "$RDS_IDENTIFIER" \
    --region "$REGION"
  log "RDS eliminada"
else
  skip "RDS no encontrada"
fi

# ─── RDS Subnet Group ─────────────────────────────────────────────────────────
header "Eliminando RDS Subnet Group"

if [[ -n "${RDS_SUBNET_GROUP:-}" ]]; then
  aws rds delete-db-subnet-group \
    --db-subnet-group-name "$RDS_SUBNET_GROUP" \
    --region "$REGION" &>/dev/null && log "Subnet Group eliminado" || skip "Subnet Group no encontrado"
else
  skip "RDS_SUBNET_GROUP no definido"
fi

# ─── Security Groups ─────────────────────────────────────────────────────────
header "Eliminando Security Groups"

# Esperar un poco para que las dependencias se liberen
sleep 5

for SG_ID in "${SG_EC2_ID:-}" "${SG_RDS_ID:-}"; do
  [[ -z "$SG_ID" ]] && continue
  aws ec2 delete-security-group \
    --group-id "$SG_ID" \
    --region "$REGION" &>/dev/null && log "Security Group eliminado: $SG_ID" || warn "No se pudo eliminar SG: $SG_ID (puede tener dependencias)"
done

# ─── Key Pair ─────────────────────────────────────────────────────────────────
header "Eliminando Key Pair"

if [[ -n "${KEY_NAME:-}" ]]; then
  aws ec2 delete-key-pair \
    --key-name "$KEY_NAME" \
    --region "$REGION" &>/dev/null && log "Key pair eliminado: $KEY_NAME" || skip "Key pair no encontrado"

  if [[ -n "${KEY_FILE:-}" && -f "$KEY_FILE" ]]; then
    rm -f "$KEY_FILE"
    log "Archivo PEM eliminado: $KEY_FILE"
  fi
fi

# ─── Limpiar state file ───────────────────────────────────────────────────────
mv "$STATE_FILE" "${STATE_FILE}.bak" 2>/dev/null || true

echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${GREEN}  ✅  CLEANUP COMPLETADO${NC}"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}Nota:${NC} Los buckets S3 no se eliminaron. Hazlo manual si lo necesitas:"
echo -e "  aws s3 rb s3://${S3_ASSETS_BUCKET} --force"
echo -e "  aws s3 rb s3://${S3_WEBSITE_BUCKET} --force"
echo ""
