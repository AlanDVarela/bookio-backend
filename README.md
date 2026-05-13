# Bookio - Backend 

[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)](https://www.prisma.io/)
[![AWS](https://img.shields.io/badge/Amazon_AWS-FF9900?style=for-the-badge&logo=amazonwebservices&logoColor=white)](https://aws.amazon.com/)


Bienvenido al repositorio Backend de **Bookio**.

## 🔗 Ecosistema Bookio
Esta plataforma cuenta con una arquitectura desacoplada. Explora nuestros diferentes repositorios:

* 🌐 [**Frontend (Angular SPA)** ➔ Visitar Repositorio](https://github.com/FPSamu/bookio-frontend)
* 📱 [**Mobile App (Cliente iOS/Android con Flutter)** ➔ Visitar Repositorio](https://github.com/FPSamu/bookio-mobile)
* ⚙️ [**Backend (API REST Node.js)** ➔ Estás aquí](https://github.com/AlanDVarela/bookio-backend)

---

## Descripción del Proyecto
Actualmente, muchas Pequeñas y Medianas Empresas (PyMEs) del sector servicios (barberías, spas, consultorios) gestionan sus citas de manera manual. Esto ocasiona problemas críticos como el empalme de horarios (*overbooking*), altas tasas de ausentismo (*no-shows*) y pérdida de tiempo productivo en la gestión telefónica.

**Bookio** es una plataforma web SaaS (Software as a Service) multi-negocio diseñada para resolver esta problemática. Su arquitectura en la nube permite alta disponibilidad, garantizando un manejo robusto de concurrencia y aprovechando servicios administrados para tareas asíncronas.

### Equipo y Distribución de Roles
* **Alan Varela:** Backend feature 1 + Front end.
* **Samuel Pia:** Backend feature 2 + Front end.
* **Jair Aguilar:** Backend feature 3 + CI/CD.

---

## Arquitectura en AWS

El proyecto está desplegado sobre una arquitectura en la nube con los siguientes servicios:

| Servicio | Tier | Rol |
|---|---|---|
| **EC2 t3.micro** | Cómputo | API REST Node.js/Express con `LabInstanceProfile` (sin credenciales hardcodeadas) |
| **RDS db.t3.micro** | Base de Datos | PostgreSQL 16 — modelo relacional Multi-tenant, transacciones ACID vía Prisma ORM |
| **S3** | Almacenamiento | `bookio-static-website` → Frontend Angular SPA · `bookio-assets-bucket` → logos/fotos |
| **SQS** | Cola de mensajes | `bookio-appointments-queue` — desacopla creación de citas del envío de correos |
| **Secrets Manager** | Seguridad | Credenciales DB, Firebase y SMTP: el EC2 las lee vía `LabInstanceProfile` sin tocar el código |

### Estimación de Costos (us-east-1)

| Recurso | Precio/hr | 24h/7d |
|---|---|---|
| EC2 t3.micro | $0.0104 | $1.75/sem | $
| RDS db.t3.micro | $0.017 | $2.86/sem 
| Secrets Manager (3 secrets) | — | $0.28/sem | 
| S3, SQS, Nodemailer | — | ~$0.00 | 
| **Total** | | **~$4.89/sem** | 


### Diagramas Técnicos

<summary><b>Arquitectura</b></summary>
<br>
<p align="left">
  <img src="https://imgur.com/nBMCCuI.png" alt="Diagrama de Arquitectura AWS" width="800"/>
</p>

<details>
<summary><b>Ver Flujo de Secuencia (Disponibilidad y Reserva)</b></summary>
<br>
<p align="center">
  <img src="https://imgur.com/GIikXmE.png" alt="Flujo de Disponibilidad y Reserva" width="800"/>
</p>
</details>

<details>
<summary><b>Ver Diagrama de Entidad Relación (Multi-tenant)</b></summary>
<br>
<p align="center">
  <img src="https://imgur.com/KUaBgl9.png" alt="Diagrama de Entidad Relación Multi-tenant" width="800"/>
</p>
</details>

---

## Flujos End-to-End
El desarrollo se centra en 3 flujos principales enumerados:

1. **Flujo 1 - Configuración del Tenant:** Validación y creación del espacio del negocio (Business/Service) almacenando recursos en S3 y RDS.
2. **Flujo 2 - Motor de Reserva:** Manejo de concurrencia relacional estricta para registrar citas sin empalmes en el calendario (PostgreSQL).
3. **Flujo 3 - Notificaciones por Eventos:** Al crear/cambiar estado de una cita, se publica un mensaje en **Amazon SQS**. Un worker de long-polling consume la cola y envía correos transaccionales (confirmación/cancelación) con **Nodemailer + Gmail SMTP**.

---
### Estructura del Proyecto

```text
bookio-backend/
├── .github/
│   └── workflows/
│       ├── ci.yml               # Pipeline CI (Lint + Tests)
│       └── cd.yml               # Pipeline CD (Build + Deploy)
├── .husky/
│   └── pre-commit               # Hook: lint-staged antes de cada commit
├── docker-compose.yml           # Base de Datos Local
├── .env.example                 # Ejemplo de variables de entorno
├── api.http                     # Archivo de pruebas rápidas REST (VSCode REST Client)
├── eslint.config.mjs            # Configuración de ESLint (TypeScript)
├── jest.config.ts               # Configuración de Jest para pruebas unitarias
├── prisma.config.ts             # Configuración del CLI de Prisma
├── prisma/
│   ├── schema.prisma            # Modelo de Base de Datos
│   └── seed.ts                  # Script para poblar la DB inicial
├── scripts/
│   └── deploy.sh                # Script parametrizado de deploy a EC2
├── tests/
│   └── unit/                    # Pruebas unitarias por módulo
│       ├── appointments/
│       ├── isolation/           # Tests de aislamiento multi-tenant
│       ├── middlewares/
│       ├── schedules/
│       └── services/
└── src/
    ├── app/
    │   ├── appointments/        # Lógica de Reservaciones
    │   ├── auth/                # Rutas y validaciones de Firebase
    │   ├── businesses/          # Puntos de entrada para el local / negocio
    │   ├── favorites/           # Gestión de favoritos del cliente
    │   ├── middlewares/         # Jwt, RequireRole, S3, SNS, SecretManager
    │   ├── reviews/             # Opiniones de citas pasadas
    │   ├── schedules/           # Horarios laborables
    │   ├── services/            # Catálogo de servicios por negocio
    │   └── users/               # Perfil y metadatos de usuario
    ├── config/                  # Inyección de environment (.env)
    ├── database/                # Conexión Adapter Pg de Prisma
    └── index.ts                 # Entry point (Express)
```

## Cómo correr el proyecto (Local)

### Prerrequisitos
* Node.js v20+
* AWS CLI v2 + `jq` (`brew install awscli jq`)
* Cuenta de AWS Academy Learner's Lab

### Desarrollo local (Docker)

1. Clona e instala:
   ```bash
   git clone https://github.com/AlanDVarela/bookio-backend
   cd bookio-backend
   npm install
   ```
2. Crea `.env` desde `.env.example` con tus credenciales de Firebase y SMTP.
3. Levanta la DB local:
   ```bash
   docker-compose up -d
   npx prisma generate && npx prisma db push && npx prisma db seed
   ```
4. Inicia el servidor:
   ```bash
   npm run dev
   ```

### Despliegue en AWS (Learner's Lab)

```bash
# 1. Al inicio de CADA sesión del Lab — actualiza credenciales locales
bash scripts/update_credentials.sh

# 2. Primera vez — crea toda la infraestructura (~10 min)
bash scripts/setup_aws.sh

# 3. Actualiza el secret de Firebase con tus credenciales reales
aws secretsmanager put-secret-value \
  --secret-id bookio/firebase \
  --secret-string '{"project_id":"...","client_email":"...","private_key":"..."}' \
  --region us-east-1

# 4. Ahorra dinero: detén cuando no uses, inicia cuando trabajes
bash scripts/stop_all.sh    # ~$0/hr
bash scripts/start_all.sh   # ~$0.027/hr

# 5. Al terminar el proyecto — elimina todo
bash scripts/cleanup_aws.sh
```

> **Nota Gmail App Password:** Ve a [myaccount.google.com](https://myaccount.google.com) → Seguridad → Verificación en 2 pasos → Contraseñas de aplicaciones. Genera una de 16 caracteres.


---

## 📡 API Reference (`/api/v1`)

A continuación se listan los endpoints agrupados por dominio. Los endpoints protegidos esperan un `Authorization: Bearer <firebase-id-token>` válido en los headers.

### 🔐 Autenticación (`/auth`)

| Método | Endpoint | Descripción | Body | Auth |
|---|---|---|---|---|
| POST | `/auth/register` | Registra o loguea al usuario (upsert por Firebase UID). Retorna `{ user }` | `{ idToken, role, name?, phone? }` | Público |
| GET | `/auth/me` | Retorna el perfil completo del usuario autenticado. Retorna `{ user }` | — | Bearer |

### 👤 Usuarios (`/users`)

| Método | Endpoint | Descripción | Body | Auth |
|---|---|---|---|---|
| GET | `/users` | Lista todos los usuarios. Retorna `{ users[] }` | — | Bearer |
| GET | `/users/:id` | Obtiene un usuario por ID. Retorna `{ user }` | — | Bearer |
| PUT | `/users/profile` | Actualiza nombre y/o teléfono del usuario autenticado. Retorna `{ message, user }` | `{ name?, phone? }` | Bearer |
| PATCH | `/users/:id/avatar` | Sube foto de perfil (multipart). Retorna `{ message, avatar_url }` | `FormData: photo` | Bearer (propio) |
| DELETE | `/users/:id` | Elimina la cuenta propia. Retorna `{ message }` | — | Bearer (propio) |

### 🏢 Negocios (`/businesses`)

| Método | Endpoint | Descripción | Body / Query | Auth |
|---|---|---|---|---|
| GET | `/businesses` | Directorio paginado con filtros. Retorna `{ data[], total, page, limit }` | `?type, ratingGte, search, page, limit` | Público |
| GET | `/businesses/recommended` | Top 5 negocios. Retorna `{ data[], ... }` | — | Público |
| GET | `/businesses/mine` | Negocio del dueño autenticado (incluye servicios). Retorna `{ business }` | — | Bearer (Owner) |
| GET | `/businesses/metrics` | KPIs: citas hoy/semana, ingresos, ocupación, gráficas. Retorna `{ metrics }` | — | Bearer (Owner) |
| GET | `/businesses/reservations` | Lista de reservas del negocio, con filtro opcional por fecha. Retorna `{ reservations[] }` | `?date=YYYY-MM-DD` | Bearer (Owner) |
| GET | `/businesses/:id` | Detalle público de un negocio. Retorna `{ business }` | — | Público |
| GET | `/businesses/:id/services` | Servicios ofrecidos por un negocio. Retorna `{ services[] }` | — | Público |
| POST | `/businesses` | Registra un nuevo negocio (con logo opcional). Retorna `{ message, business }` | `{ name, type, address, latitude?, longitude? }` + `FormData: logo?` | Bearer (Owner) |
| POST | `/businesses/:id/photos` | Sube hasta 5 fotos del negocio. Retorna `{ message, photos[] }` | `FormData: photos[]` | Bearer (Owner) |

### 📅 Citas (`/appointments`)

| Método | Endpoint | Descripción | Body / Query | Auth |
|---|---|---|---|---|
| GET | `/appointments/slots` | Slots disponibles para reservar. Retorna `{ availableSlots[] }` | `?businessId, dateStr, serviceDuration, serviceId?` | Público |
| GET | `/appointments` | Lista citas con filtros opcionales. Retorna `{ appointments[] }` | `?businessId?, clientId?, status?` (upcoming/past/cancelled) | Bearer |
| POST | `/appointments` | Reserva una cita. Retorna `{ message, appointment }` | `{ businessId, serviceId, startDatetime }` | Bearer (Client) |
| PUT | `/appointments/:id/status` | Cambia el estado de la cita. Retorna `{ message, appointment }` | `{ status }` (PENDING/CONFIRMED/CANCELLED) | Bearer |
| DELETE | `/appointments/:id` | Elimina una cita. Retorna `{ message }` | — | Bearer |

### ⭐ Favoritos (`/favorites`)

| Método | Endpoint | Descripción | Body | Auth |
|---|---|---|---|---|
| GET | `/favorites` | Lista los negocios favoritos del cliente. Retorna `{ favorites[] }` | — | Bearer (Client) |
| POST | `/favorites` | Agrega un negocio a favoritos. Retorna `{ favorite }` | `{ businessId }` | Bearer (Client) |
| DELETE | `/favorites/:id` | Elimina un favorito. Retorna `{ message }` | — | Bearer (Client) |

### 💬 Reseñas (`/reviews`)

| Método | Endpoint | Descripción | Body | Auth |
|---|---|---|---|---|
| POST | `/reviews` | Crea una evaluación post-cita. Retorna `{ review }` | `{ score, comment, appointment_id }` | Bearer (Client) |
| GET | `/reviews/business/:businessId` | Reseñas públicas de un negocio. Retorna `{ reviews[] }` | — | Público |

### 🛠️ Servicios (`/services`)

| Método | Endpoint | Descripción | Body | Auth |
|---|---|---|---|---|
| GET | `/services` | Servicios del negocio autenticado. Retorna `{ services[] }` | — | Bearer (Owner) |
| POST | `/services` | Crea un servicio. Retorna `{ service }` | `{ name, durationMinutes, price }` | Bearer (Owner) |
| GET | `/services/:id/schedule` | Horario semanal de un servicio. Retorna `{ schedules[] }` | — | Bearer (Owner) |
| PUT | `/services/:id/schedule` | Crea o actualiza un día del horario del servicio. Retorna `{ schedule }` | `{ dayOfWeek, startTime, endTime }` | Bearer (Owner) |
| DELETE | `/services/:id/schedule/:dayId` | Elimina un día del horario del servicio. Retorna `{ message }` | — | Bearer (Owner) |
| PATCH | `/services/:id/photo` | Sube foto del servicio (multipart). Retorna `{ message, photo_url }` | `FormData: photo` | Bearer (Owner) |

### 🗓️ Horarios (`/schedules`)

| Método | Endpoint | Descripción | Body | Auth |
|---|---|---|---|---|
| GET | `/schedules/business/:businessId` | Horario semanal público de un negocio. Retorna `{ schedules[], blockedSlots[] }` | — | **Público** |
| GET | `/schedules` | Horario + bloqueos del negocio autenticado. Retorna `{ schedules[], blockedSlots[] }` | — | Bearer (Owner) |
| PUT | `/schedules` | Crea o actualiza un día laboral. Retorna `{ schedule }` | `{ dayOfWeek, startTime, endTime }` | Bearer (Owner) |
| DELETE | `/schedules/:id` | Elimina un día laboral. Retorna `{ message }` | — | Bearer (Owner) |
| POST | `/schedules/blocked` | Agrega un bloqueo de horario. Retorna `{ blockedSlot }` | `{ date, startTime?, endTime?, reason? }` | Bearer (Owner) |
| DELETE | `/schedules/blocked/:id` | Elimina un bloqueo. Retorna `{ message }` | — | Bearer (Owner) |

---

## 🛠️ Middlewares Customizados

El proyecto cuenta con un set de middlewares especializados para inyectar lógica de negocio, separar responsabilidades (Separation of Concerns) y mantener los Endpoints limpios:

| Middleware / Servicio | Archivo | Descripción de Responsabilidad |
|---|---|---|
| **Verificador de Firebase** | `auth.middleware.ts: authenticateJWT` | Intercepta el request, lee el header `Authorization`, y con `firebase-admin` valida criptográficamente el token (JWT). Inyecta la data segura decodificada en `req.user`. |
| **Control de Accesos (RBAC)** | `auth.middleware.ts: requireRole` | Actúa junto al verificador. Lee los roles de base de datos extraídos en `req.user` y bloquea u otorga acceso a clientes, dueños de negocios o admins. |
| **Parser Multipart FormData** | `upload.middleware.ts: upload` | Configuración base en memoria (via Multer) para parsear correctamente *uploads* sin ensuciar los controladores. Permite transferencias directas. |
| **AWS S3 Object Uploader** | `s3.service.ts` | Recibe Buffers desde el middleware multipart y mediante el AWS SDK v3 los sube asíncronamente al respectivo Bucket privado/público. Retorna URIs seguras. |
| **Email Service (Nodemailer)** | `services/email.service.ts` | Envía correos transaccionales (confirmación/cancelación de citas) usando Gmail SMTP vía Nodemailer. El puerto 587 está abierto en EC2. |
| **SQS Worker** | `workers/sqs.worker.ts` | Proceso de long-polling que consume la cola `bookio-appointments-queue`. Desacopla la escritura en DB del envío de email: la API responde al cliente sin bloquear por el correo. |
| **AWS Secrets Resolver** | `secretManager.service.ts` | Inyecta credenciales (DB, Firebase, SMTP) desde Secrets Manager en runtime, sin variables hardcodeadas en el código ni en el sistema de archivos. |

---

## Pruebas Unitarias

El proyecto utiliza **Jest** + **ts-jest** para pruebas unitarias. Los tests se organizan en la carpeta `tests/` reflejando la estructura del código fuente:

```text
tests/
└── unit/
    ├── appointments/
    │   └── appointments.service.test.ts
    ├── middlewares/
    │   └── auth.middleware.test.ts
    ├── schedules/
    │   └── schedules.service.test.ts
    └── services/
        ├── services.controller.test.ts
        └── services.service.test.ts
```

### Ejecutar todas las pruebas
```bash
npm test
```

### Ejecutar con cobertura
```bash
npx jest --coverage
```

### Ejecutar un archivo específico
```bash
npx jest tests/unit/services/services.service.test.ts
```

### Estrategia de Testing
- **Mocking completo de Prisma:** Cada suite mockea `prisma` para aislar la lógica de negocio de la base de datos.
- **Mocking de servicios externos:** AWS SNS, Firebase Auth y S3 se mockean para evitar llamadas reales.
- **Cobertura de edge cases:** Tests para errores de BD, validaciones de rol, conflictos de horario (overbooking) y parámetros faltantes.
- **Aislamiento Multi-Tenant:** Tests dedicados que validan que las queries filtran correctamente por `business_id`, asegurando que datos de un negocio nunca se filtren hacia otro.

---

## Estrategia de CI/CD

Nuestra estrategia de Integración y Despliegue Continuo se basa en automatizar la calidad del código para evitar que errores humanos lleguen a producción.

### Continuous Integration (CI)

El pipeline de CI se activa automáticamente al realizar un **Pull Request (PR)** hacia la rama `main`:

```mermaid
graph LR
  A[PR a main] --> B[ESLint<br/>Análisis Estático]
  B --> C[Jest<br/>Pruebas Unitarias]
  C --> D[Coverage<br/>Reporte]
  D --> E{Merge}
```

| Etapa | Herramienta | Descripción |
|---|---|---|
| **Análisis Estático** | ESLint + `typescript-eslint` | Detecta errores de tipado, variables no usadas, `any` explícitos y malas prácticas antes de que lleguen al repo. |
| **Pre-commit Hooks** | Husky + lint-staged | Ejecuta ESLint automáticamente sobre archivos staged en cada commit local, forzando calidad desde el primer push. |
| **Pruebas Unitarias** | Jest + ts-jest | Valida lógica de negocio con mocks de Prisma. Incluye tests de **aislamiento multi-tenant** que comprueban que el filtrado por `business_id` funciona correctamente y no mezcla datos entre tenants en RDS. |
| **Cobertura** | Jest `--coverage` | Genera reporte de cobertura y lo sube como artefacto del pipeline. |

### Continuous Deployment (CD)

Se utilizan **scripts de bash parametrizados** para realizar el despliegue en EC2 mediante SSH:

```bash
# Uso del script de deploy
bash scripts/deploy.sh \
  --host <EC2_IP> \
  --user ec2-user \
  --key ~/.ssh/bookio.pem
```

| Step | Acción |
|---|---|
| 1 | `npm run build` — Compilación TypeScript local |
| 2 | `rsync` — Transferencia de artefactos a EC2 (excluye `node_modules`, `.env`, `tests`) |
| 3 | `npm ci --omit=dev` — Instalación de dependencias de producción en remoto |
| 4 | `npx prisma db push` — Sincronización del esquema de BD |
| 5 | `pm2 restart` — Reinicio de la aplicación sin downtime |

> **Nota:** Actualmente el CD está configurado como *placeholder* (valida build localmente). Cuando la instancia EC2 esté disponible, se activarán los pasos de SSH descomentando la sección correspondiente en `.github/workflows/cd.yml`.

### Archivos del Pipeline

```text
.github/workflows/
├── ci.yml          # Pipeline de CI (Lint + Tests) — trigger: PR a main
└── cd.yml          # Pipeline de CD (Build + Deploy) — trigger: CI exitoso en main

.husky/
└── pre-commit      # Hook: ejecuta lint-staged antes de cada commit

scripts/
└── deploy.sh       # Script parametrizado de despliegue SSH a EC2
```

### Secrets Requeridos (GitHub Actions)

Para activar el CD en producción, configurar estos secrets en el repositorio:

| Secret | Descripción |
|---|---|
| `EC2_HOST` | IP pública o DNS de la instancia EC2 |
| `EC2_USER` | Usuario SSH (e.g. `ec2-user`) |
| `EC2_SSH_KEY` | Contenido de la llave privada PEM |
