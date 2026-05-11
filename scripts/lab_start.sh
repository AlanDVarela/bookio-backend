#!/usr/bin/env bash
# =============================================================================
# Bookio — Lab Start
# Ejecutar cada vez que abres el Learner's Lab
#
# USO:
#   bash scripts/lab_start.sh
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
log()    { echo -e "${GREEN}[✓]${NC} $1"; }
warn()   { echo -e "${YELLOW}[!]${NC} $1"; }
info()   { echo -e "${CYAN}[→]${NC} $1"; }

STATE_FILE="$(dirname "$0")/.aws_resources"
[[ -f "$STATE_FILE" ]] || { echo "No se encontró $STATE_FILE. Ejecuta setup_aws.sh primero."; exit 1; }
source "$STATE_FILE"

# ─── 1. Verificar credenciales ────────────────────────────────────────────────
info "Verificando credenciales AWS..."
aws sts get-caller-identity --region "$REGION" &>/dev/null \
  || { warn "Credenciales expiradas. Actualízalas en ~/.aws/credentials y vuelve a correr."; exit 1; }
log "Credenciales válidas"

# ─── 2. Nueva IP del EC2 ──────────────────────────────────────────────────────
info "Obteniendo IP actual del EC2..."
NEW_IP=$(aws ec2 describe-instances \
  --instance-ids "$EC2_INSTANCE_ID" \
  --query "Reservations[0].Instances[0].PublicIpAddress" \
  --output text --region "$REGION")

if [[ -z "$NEW_IP" || "$NEW_IP" == "None" ]]; then
  warn "EC2 no tiene IP pública — puede estar detenido. Iniciándolo..."
  aws ec2 start-instances --instance-ids "$EC2_INSTANCE_ID" --region "$REGION" &>/dev/null
  aws ec2 wait instance-running --instance-ids "$EC2_INSTANCE_ID" --region "$REGION"
  NEW_IP=$(aws ec2 describe-instances \
    --instance-ids "$EC2_INSTANCE_ID" \
    --query "Reservations[0].Instances[0].PublicIpAddress" \
    --output text --region "$REGION")
fi
log "IP del EC2: $NEW_IP"

# Actualizar .aws_resources
sed -i.bak "s/EC2_PUBLIC_IP=.*/EC2_PUBLIC_IP=\"${NEW_IP}\"/" "$STATE_FILE"
sed -i.bak "s/EC2_PUBLIC_DNS=.*/EC2_PUBLIC_DNS=\"ec2-${NEW_IP//./-}.compute-1.amazonaws.com\"/" "$STATE_FILE"
rm -f "${STATE_FILE}.bak"

# ─── 3. Actualizar config.json en S3 ─────────────────────────────────────────
info "Actualizando config.json en S3..."
echo "{\"apiUrl\":\"http://${NEW_IP}:3000/api/v1\"}" | \
  aws s3 cp - "s3://${S3_WEBSITE_BUCKET}/config.json" \
  --content-type "application/json" --region "$REGION"
log "Frontend apunta a: http://${NEW_IP}:3000/api/v1"

# ─── 4. Actualizar Security Group SSH ────────────────────────────────────────
info "Actualizando regla SSH del Security Group..."
MY_IP=$(curl -s https://checkip.amazonaws.com)

OLD_SSH_CIDR=$(aws ec2 describe-security-groups \
  --group-ids "$SG_EC2_ID" \
  --query 'SecurityGroups[0].IpPermissions[?FromPort==`22`].IpRanges[0].CidrIp' \
  --output text --region "$REGION" 2>/dev/null || echo "")

if [[ -n "$OLD_SSH_CIDR" && "$OLD_SSH_CIDR" != "${MY_IP}/32" ]]; then
  aws ec2 revoke-security-group-ingress \
    --group-id "$SG_EC2_ID" --protocol tcp --port 22 \
    --cidr "$OLD_SSH_CIDR" --region "$REGION" &>/dev/null || true
  aws ec2 authorize-security-group-ingress \
    --group-id "$SG_EC2_ID" --protocol tcp --port 22 \
    --cidr "${MY_IP}/32" --region "$REGION" &>/dev/null
  log "SSH actualizado: $OLD_SSH_CIDR → ${MY_IP}/32"
else
  log "SSH ya permite tu IP: ${MY_IP}/32"
fi

# ─── Resumen ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${GREEN}  ✅  LAB LISTO${NC}"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  API:    ${BOLD}http://${NEW_IP}:3000${NC}"
echo -e "  Health: ${BOLD}http://${NEW_IP}:3000/health${NC}"
echo -e "  SSH:    ${BOLD}ssh -i keys/bookio-key.pem ec2-user@${NEW_IP}${NC}"
echo ""
