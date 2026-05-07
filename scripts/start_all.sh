#!/usr/bin/env bash
# =============================================================================
# Bookio — Iniciar EC2 y RDS
#
# USO:
#   bash scripts/start_all.sh
#
# Nota: La IP pública de EC2 cambia al reiniciarla.
# Actualiza CORS en src/index.ts y el Security Group si usas IP fija.
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'
BOLD='\033[1m'; NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
info() { echo -e "${CYAN}[→]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }

STATE_FILE="$(dirname "$0")/.aws_resources"
[[ -f "$STATE_FILE" ]] || { echo "No se encontró .aws_resources. Ejecuta setup_aws.sh primero."; exit 1; }
# shellcheck disable=SC1090
source "$STATE_FILE"

echo ""
echo -e "${BOLD}${GREEN}━━━ Iniciando Bookio ━━━${NC}"
echo ""

# ─── Iniciar RDS primero (tarda más) ─────────────────────────────────────────
RDS_STATUS=$(aws rds describe-db-instances \
  --db-instance-identifier "$RDS_IDENTIFIER" \
  --query "DBInstances[0].DBInstanceStatus" \
  --output text --region "$REGION" 2>/dev/null || echo "not-found")

if [[ "$RDS_STATUS" == "stopped" ]]; then
  info "Iniciando RDS $RDS_IDENTIFIER..."
  aws rds start-db-instance --db-instance-identifier "$RDS_IDENTIFIER" --region "$REGION" &>/dev/null
  info "Esperando que RDS esté disponible (puede tardar 3-5 min)..."
  aws rds wait db-instance-available --db-instance-identifier "$RDS_IDENTIFIER" --region "$REGION"
  log "RDS disponible"
elif [[ "$RDS_STATUS" == "available" ]]; then
  log "RDS ya estaba corriendo"
else
  warn "RDS en estado: $RDS_STATUS"
fi

# ─── Iniciar EC2 ─────────────────────────────────────────────────────────────
EC2_STATE=$(aws ec2 describe-instances \
  --instance-ids "$EC2_INSTANCE_ID" \
  --query "Reservations[0].Instances[0].State.Name" \
  --output text --region "$REGION" 2>/dev/null || echo "not-found")

if [[ "$EC2_STATE" == "stopped" ]]; then
  info "Iniciando EC2 $EC2_INSTANCE_ID..."
  aws ec2 start-instances --instance-ids "$EC2_INSTANCE_ID" --region "$REGION" &>/dev/null
  aws ec2 wait instance-running --instance-ids "$EC2_INSTANCE_ID" --region "$REGION"
  log "EC2 corriendo"
elif [[ "$EC2_STATE" == "running" ]]; then
  log "EC2 ya estaba corriendo"
else
  warn "EC2 en estado: $EC2_STATE"
fi

# ─── Obtener nueva IP pública ─────────────────────────────────────────────────
NEW_IP=$(aws ec2 describe-instances \
  --instance-ids "$EC2_INSTANCE_ID" \
  --query "Reservations[0].Instances[0].PublicIpAddress" \
  --output text --region "$REGION")

# Actualizar el state file con la nueva IP
sed -i.bak "s/^EC2_PUBLIC_IP=.*/EC2_PUBLIC_IP=\"${NEW_IP}\"/" "$STATE_FILE" 2>/dev/null || true
rm -f "${STATE_FILE}.bak"

echo ""
log "Bookio está corriendo"
echo ""
echo -e "  ${CYAN}EC2 IP pública:${NC}  ${BOLD}$NEW_IP${NC}  ${YELLOW}(nueva IP al reiniciar)${NC}"
echo -e "  ${CYAN}API:${NC}             ${BOLD}http://$NEW_IP:3000${NC}"
echo -e "  ${CYAN}Health check:${NC}    ${BOLD}http://$NEW_IP:3000/health${NC}"
echo -e "  ${CYAN}SSH:${NC}             ${BOLD}ssh -i $KEY_FILE ec2-user@$NEW_IP${NC}"
echo ""
echo -e "${YELLOW}Recuerda:${NC} Si la IP cambió, actualiza el CORS en ${BOLD}src/index.ts${NC}"
echo ""
