#!/usr/bin/env bash
# Actualiza config.json en S3 con la IP actual del EC2
# Correr cada vez que el Lab reinicia y cambia la IP

set -euo pipefail

STATE_FILE="$(dirname "$0")/.aws_resources"
source "$STATE_FILE"

GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'

# Obtener IP actual del EC2
NEW_IP=$(aws ec2 describe-instances \
  --instance-ids "$EC2_INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text --region "$REGION")

if [[ -z "$NEW_IP" || "$NEW_IP" == "None" ]]; then
  echo "EC2 no tiene IP pública — ¿está corriendo?"
  exit 1
fi

API_URL="http://${NEW_IP}:3000/api/v1"

# Subir config.json al bucket del frontend
echo "{\"apiUrl\":\"${API_URL}\"}" | aws s3 cp - \
  "s3://${S3_WEBSITE_BUCKET}/config.json" \
  --content-type "application/json" \
  --region "$REGION"

# Guardar nueva IP en state file
sed -i.bak "s/EC2_PUBLIC_IP=.*/EC2_PUBLIC_IP=\"${NEW_IP}\"/" "$STATE_FILE"

echo -e "${GREEN}[✓]${NC} config.json actualizado en S3"
echo -e "${CYAN}[→]${NC} Nueva IP: ${NEW_IP}"
echo -e "${CYAN}[→]${NC} API URL:  ${API_URL}"
