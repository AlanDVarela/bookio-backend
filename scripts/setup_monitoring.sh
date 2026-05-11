#!/usr/bin/env bash
# =============================================================================
# Bookio — CloudWatch
# Crear 5 metricas, 2 alarmas, 1 dashboard
#
#   bash scripts/setup_monitoring.sh
#
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()    { echo -e "${GREEN}[✓]${NC} $1"; }
warn()   { echo -e "${YELLOW}[!]${NC} $1"; }
info()   { echo -e "${CYAN}[→]${NC} $1"; }
header() { echo -e "\n${BOLD}${CYAN}━━━ $1 ━━━${NC}"; }

# ─── Cargar estado ───────────────────────────────────────────────────────────
STATE_FILE="$(dirname "$0")/.aws_resources"
[[ -f "$STATE_FILE" ]] || { echo "No se encontró $STATE_FILE. Ejecuta setup_aws.sh primero."; exit 1; }
source "$STATE_FILE"

DASHBOARD_NAME="Bookio"
ALARM_EC2_CPU="bookio-ec2-cpu-high"
ALARM_RDS_CPU="bookio-rds-cpu-high"

# ─── SNS Topic para alertas ──────────────────────────────────────────────────
header "SNS Topic para alertas"

SNS_ARN=$(aws sns list-topics --region "$REGION" \
  --query "Topics[?ends_with(TopicArn,'bookio-alerts')].TopicArn | [0]" \
  --output text 2>/dev/null || echo "None")

if [[ "$SNS_ARN" == "None" || -z "$SNS_ARN" ]]; then
  SNS_ARN=$(aws sns create-topic --name bookio-alerts \
    --region "$REGION" --query TopicArn --output text)
  log "SNS topic creado: $SNS_ARN"
else
  log "SNS topic ya existe: $SNS_ARN"
fi

# Suscribir email del dueño (solo si no existe)
OWNER_EMAIL=$(grep -E "^SMTP_USER=" "$STATE_FILE" | cut -d'"' -f2)
if [[ -n "$OWNER_EMAIL" ]]; then
  aws sns subscribe \
    --topic-arn "$SNS_ARN" \
    --protocol email \
    --notification-endpoint "$OWNER_EMAIL" \
    --region "$REGION" &>/dev/null || true
  warn "Confirma la suscripción en tu correo: $OWNER_EMAIL"
fi

# ─── Alarma 1: EC2 CPU > 80% ─────────────────────────────────────────────────
header "Alarma 1 — EC2 CPU"

aws cloudwatch put-metric-alarm \
  --alarm-name "$ALARM_EC2_CPU" \
  --alarm-description "CPU de EC2 bookio-backend supera 80%" \
  --namespace "AWS/EC2" \
  --metric-name "CPUUtilization" \
  --dimensions Name=InstanceId,Value="$EC2_INSTANCE_ID" \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions "$SNS_ARN" \
  --ok-actions "$SNS_ARN" \
  --treat-missing-data notBreaching \
  --region "$REGION"
log "Alarma creada: $ALARM_EC2_CPU (CPU EC2 > 80% por 10 min)"

# ─── Alarma 2: RDS CPU > 80% ─────────────────────────────────────────────────
header "Alarma 2 — RDS CPU"

aws cloudwatch put-metric-alarm \
  --alarm-name "$ALARM_RDS_CPU" \
  --alarm-description "CPU de RDS bookio-db supera 80%" \
  --namespace "AWS/RDS" \
  --metric-name "CPUUtilization" \
  --dimensions Name=DBInstanceIdentifier,Value="$RDS_IDENTIFIER" \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions "$SNS_ARN" \
  --ok-actions "$SNS_ARN" \
  --treat-missing-data notBreaching \
  --region "$REGION"
log "Alarma creada: $ALARM_RDS_CPU (CPU RDS > 80% por 10 min)"

# ─── Dashboard: 5 métricas en un solo panel ───────────────────────────────────
header "Dashboard — $DASHBOARD_NAME"

DASHBOARD_BODY=$(cat <<DASHBOARD
{
  "widgets": [
    {
      "type": "text",
      "x": 0, "y": 0, "width": 24, "height": 1,
      "properties": {
        "markdown": "# Bookio — Production Monitoring"
      }
    },
    {
      "type": "metric",
      "x": 0, "y": 1, "width": 12, "height": 6,
      "properties": {
        "title": "EC2 — CPU Utilization (%)",
        "view": "timeSeries",
        "stat": "Average",
        "period": 60,
        "region": "${REGION}",
        "metrics": [
          ["AWS/EC2", "CPUUtilization",
           "InstanceId", "${EC2_INSTANCE_ID}",
           {"label": "CPU EC2", "color": "#2ca02c"}]
        ],
        "annotations": {
          "horizontal": [{"value": 80, "label": "Limite alarma", "color": "#d62728"}]
        },
        "yAxis": {"left": {"min": 0, "max": 100}}
      }
    },
    {
      "type": "metric",
      "x": 12, "y": 1, "width": 12, "height": 6,
      "properties": {
        "title": "EC2 — Network In (bytes)",
        "view": "timeSeries",
        "stat": "Sum",
        "period": 60,
        "region": "${REGION}",
        "annotations": {"horizontal": []},
        "metrics": [
          ["AWS/EC2", "NetworkIn",
           "InstanceId", "${EC2_INSTANCE_ID}",
           {"label": "Network In", "color": "#1f77b4"}]
        ]
      }
    },
    {
      "type": "metric",
      "x": 0, "y": 7, "width": 12, "height": 6,
      "properties": {
        "title": "RDS — CPU Utilization (%)",
        "view": "timeSeries",
        "stat": "Average",
        "period": 60,
        "region": "${REGION}",
        "metrics": [
          ["AWS/RDS", "CPUUtilization",
           "DBInstanceIdentifier", "${RDS_IDENTIFIER}",
           {"label": "CPU RDS", "color": "#ff7f0e"}]
        ],
        "annotations": {
          "horizontal": [{"value": 80, "label": "Limite alarma", "color": "#d62728"}]
        },
        "yAxis": {"left": {"min": 0, "max": 100}}
      }
    },
    {
      "type": "metric",
      "x": 12, "y": 7, "width": 12, "height": 6,
      "properties": {
        "title": "RDS — Database Connections",
        "view": "timeSeries",
        "stat": "Average",
        "period": 60,
        "region": "${REGION}",
        "annotations": {"horizontal": []},
        "metrics": [
          ["AWS/RDS", "DatabaseConnections",
           "DBInstanceIdentifier", "${RDS_IDENTIFIER}",
           {"label": "Conexiones activas", "color": "#9467bd"}]
        ]
      }
    },
    {
      "type": "metric",
      "x": 0, "y": 13, "width": 12, "height": 6,
      "properties": {
        "title": "SQS — Mensajes enviados a la cola",
        "view": "timeSeries",
        "stat": "Sum",
        "period": 300,
        "region": "${REGION}",
        "annotations": {"horizontal": []},
        "metrics": [
          ["AWS/SQS", "NumberOfMessagesSent",
           "QueueName", "${SQS_QUEUE_NAME}",
           {"label": "Citas encoladas", "color": "#8c564b"}]
        ]
      }
    },
    {
      "type": "alarm",
      "x": 12, "y": 13, "width": 12, "height": 6,
      "properties": {
        "title": "Estado de Alarmas",
        "alarms": [
          "arn:aws:cloudwatch:${REGION}:${ACCOUNT_ID}:alarm:${ALARM_EC2_CPU}",
          "arn:aws:cloudwatch:${REGION}:${ACCOUNT_ID}:alarm:${ALARM_RDS_CPU}"
        ]
      }
    }
  ]
}
DASHBOARD
)

aws cloudwatch put-dashboard \
  --dashboard-name "$DASHBOARD_NAME" \
  --dashboard-body "$DASHBOARD_BODY" \
  --region "$REGION" &>/dev/null
log "Dashboard creado: $DASHBOARD_NAME"

# ─── Resumen ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${GREEN}  ✅  MONITOREO CONFIGURADO${NC}"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${CYAN}5 Métricas (nativas, sin agente):${NC}"
echo -e "    1. EC2 CPUUtilization"
echo -e "    2. EC2 NetworkIn"
echo -e "    3. RDS CPUUtilization"
echo -e "    4. RDS DatabaseConnections"
echo -e "    5. SQS NumberOfMessagesSent"
echo ""
echo -e "  ${CYAN}2 Alarmas:${NC}"
echo -e "    • $ALARM_EC2_CPU  → CPU EC2 > 80% por 10 min"
echo -e "    • $ALARM_RDS_CPU  → CPU RDS > 80% por 10 min"
echo ""
echo -e "  ${CYAN}1 Dashboard:${NC}"
echo -e "    ${BOLD}https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#dashboards:name=${DASHBOARD_NAME}${NC}"
echo ""
echo -e "${YELLOW}IMPORTANTE:${NC} Confirma la suscripción en tu correo ${BOLD}$OWNER_EMAIL${NC}"
echo -e "para recibir alertas cuando se activen las alarmas."
echo ""
