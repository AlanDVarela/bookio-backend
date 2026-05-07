#!/usr/bin/env bash
# =============================================================================
# Bookio — Detener EC2 y RDS para ahorrar costos
#
# EC2 t3.micro  cuesta $0.0104/hr → al detenerla: $0.00/hr
# RDS db.t3.micro cuesta $0.017/hr → al detenerla: $0.00/hr (max 7 días)
#
# IMPORTANTE: RDS solo puede estar detenida 7 días consecutivos.
# Después de 7 días AWS la reinicia automáticamente.
#
# USO:
#   bash scripts/stop_all.sh
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
echo -e "${BOLD}${YELLOW}━━━ Deteniendo Bookio (ahorro de costos) ━━━${NC}"
echo ""

# ─── Detener EC2 ──────────────────────────────────────────────────────────────
EC2_STATE=$(aws ec2 describe-instances \
  --instance-ids "$EC2_INSTANCE_ID" \
  --query "Reservations[0].Instances[0].State.Name" \
  --output text --region "$REGION" 2>/dev/null || echo "not-found")

if [[ "$EC2_STATE" == "running" ]]; then
  info "Deteniendo EC2 $EC2_INSTANCE_ID..."
  aws ec2 stop-instances --instance-ids "$EC2_INSTANCE_ID" --region "$REGION" &>/dev/null
  aws ec2 wait instance-stopped --instance-ids "$EC2_INSTANCE_ID" --region "$REGION"
  log "EC2 detenida"
elif [[ "$EC2_STATE" == "stopped" ]]; then
  log "EC2 ya estaba detenida"
else
  warn "EC2 en estado: $EC2_STATE — no se puede detener"
fi

# ─── Detener RDS ──────────────────────────────────────────────────────────────
RDS_STATUS=$(aws rds describe-db-instances \
  --db-instance-identifier "$RDS_IDENTIFIER" \
  --query "DBInstances[0].DBInstanceStatus" \
  --output text --region "$REGION" 2>/dev/null || echo "not-found")

if [[ "$RDS_STATUS" == "available" ]]; then
  info "Deteniendo RDS $RDS_IDENTIFIER..."
  aws rds stop-db-instance --db-instance-identifier "$RDS_IDENTIFIER" --region "$REGION" &>/dev/null
  log "RDS detenida (puede tardar unos minutos en completarse)"
  warn "RDS solo puede estar detenida 7 días. Después AWS la inicia automáticamente."
elif [[ "$RDS_STATUS" == "stopped" ]]; then
  log "RDS ya estaba detenida"
else
  warn "RDS en estado: $RDS_STATUS — no se puede detener ahora"
fi

echo ""
log "Todo detenido. Costo aproximado mientras está detenido: \$0/hr"
echo ""
echo -e "Para volver a iniciar: ${BOLD}bash scripts/start_all.sh${NC}"
echo ""
