#!/usr/bin/env bash
# =============================================================================
# Bookio — Actualizar credenciales AWS (Learner's Lab)
#
# En AWS Academy Learner's Lab las credenciales temporales expiran
# aprox. cada 4 horas. Este script las actualiza localmente.
#
# La instancia EC2 NO necesita este script porque usa LabInstanceProfile
# (las credenciales se renuevan automáticamente vía instance metadata).
#
# USO:
#   bash scripts/update_credentials.sh
#
# Luego pega las credenciales del Lab cuando se te pida.
# Las encuentras en: Lab → AWS Details → AWS CLI → Show
# =============================================================================

set -euo pipefail

YELLOW='\033[1;33m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'
RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'

AWS_PROFILE="${AWS_PROFILE:-default}"
CREDENTIALS_FILE="$HOME/.aws/credentials"

echo ""
echo -e "${BOLD}${CYAN}━━━ Actualizar Credenciales AWS Learner's Lab ━━━${NC}"
echo ""
echo -e "${YELLOW}Dónde encontrar las credenciales:${NC}"
echo -e "  1. En el Learner's Lab, haz clic en ${BOLD}'AWS Details'${NC}"
echo -e "  2. Luego clic en ${BOLD}'AWS CLI: Show'${NC}"
echo -e "  3. Copia el bloque completo que se ve así:"
echo ""
echo -e "  ${CYAN}[default]"
echo -e "  aws_access_key_id=ASIA..."
echo -e "  aws_secret_access_key=..."
echo -e "  aws_session_token=...${NC}"
echo ""
echo -e "${YELLOW}Pega las credenciales abajo y presiona${NC} ${BOLD}Enter${NC} ${YELLOW}y luego${NC} ${BOLD}Ctrl+D${NC}${YELLOW}:${NC}"
echo ""

# Leer todo hasta EOF
PASTE=$(cat)

# Parsear los valores del bloque pegado
# [^=]*= para parar en el PRIMER = (el session token contiene = en base64)
ACCESS_KEY=$(echo "$PASTE" | grep -i 'aws_access_key_id' | sed 's/^[^=]*=[ \t]*//' | tr -d '\r\n' || echo "")
SECRET_KEY=$(echo "$PASTE" | grep -i 'aws_secret_access_key' | sed 's/^[^=]*=[ \t]*//' | tr -d '\r\n' || echo "")
SESSION_TOKEN=$(echo "$PASTE" | grep -i 'aws_session_token' | sed 's/^[^=]*=[ \t]*//' | tr -d '\r\n' || echo "")

# Validar que se parsearon los tres campos
if [[ -z "$ACCESS_KEY" || -z "$SECRET_KEY" || -z "$SESSION_TOKEN" ]]; then
  echo -e "${RED}[✗]${NC} No se pudieron parsear las credenciales. Verifica el formato y vuelve a intentar."
  echo "  ACCESS_KEY:    ${ACCESS_KEY:-(vacío)}"
  echo "  SECRET_KEY:    ${SECRET_KEY:-(vacío)}"
  echo "  SESSION_TOKEN: ${SESSION_TOKEN:0:20}... (${#SESSION_TOKEN} chars)"
  exit 1
fi

# Crear directorio si no existe
mkdir -p "$(dirname "$CREDENTIALS_FILE")"

# Reemplazar o crear el bloque [default] en credentials
if [[ -f "$CREDENTIALS_FILE" ]]; then
  # Hacer backup
  cp "$CREDENTIALS_FILE" "${CREDENTIALS_FILE}.bak"
fi

# Escribir credenciales
cat > "$CREDENTIALS_FILE" <<CREDS
[${AWS_PROFILE}]
aws_access_key_id=${ACCESS_KEY}
aws_secret_access_key=${SECRET_KEY}
aws_session_token=${SESSION_TOKEN}
CREDS

echo ""
echo -e "${GREEN}[✓]${NC} Credenciales actualizadas en: $CREDENTIALS_FILE"

# Verificar que funcionen
echo ""
echo -e "${CYAN}[→]${NC} Verificando credenciales..."

if IDENTITY=$(aws sts get-caller-identity \
  --region us-east-1 \
  --profile "$AWS_PROFILE" \
  --output json 2>/dev/null); then
  ACCOUNT=$(echo "$IDENTITY" | grep '"Account"' | sed 's/.*"\(.*\)".*/\1/')
  ARN=$(echo "$IDENTITY" | grep '"Arn"' | sed 's/.*"\(.*\)".*/\1/')
  echo -e "${GREEN}[✓]${NC} Credenciales válidas"
  echo -e "  Cuenta: ${BOLD}$ACCOUNT${NC}"
  echo -e "  ARN:    $ARN"
else
  echo -e "${RED}[✗]${NC} Las credenciales no funcionaron. Verifica que las pegaste correctamente."
  exit 1
fi

# Si existe state file, ofrecer actualizar la SG del EC2 con la nueva IP
STATE_FILE="$(dirname "$0")/.aws_resources"
if [[ -f "$STATE_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$STATE_FILE"
  echo ""
  echo -e "${YELLOW}[!]${NC} Tip: Si tu IP cambió, actualiza el Security Group de EC2 para SSH:"
  MY_IP=$(curl -s https://checkip.amazonaws.com)
  echo -e "  ${CYAN}aws ec2 authorize-security-group-ingress \\${NC}"
  echo -e "    ${CYAN}--group-id ${SG_EC2_ID:-sg-xxx} --protocol tcp --port 22 \\${NC}"
  echo -e "    ${CYAN}--cidr ${MY_IP}/32 --region us-east-1${NC}"
fi

echo ""
echo -e "${BOLD}Credenciales listas para usar. Expiran en ~4 horas.${NC}"
echo -e "Vuelve a ejecutar este script al inicio de cada sesión del Lab."
echo ""
