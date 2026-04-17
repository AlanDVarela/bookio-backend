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

## 📖 Descripción del Proyecto
Actualmente, muchas Pequeñas y Medianas Empresas (PyMEs) del sector servicios (barberías, spas, consultorios) gestionan sus citas de manera manual. Esto ocasiona problemas críticos como el empalme de horarios (*overbooking*), altas tasas de ausentismo (*no-shows*) y pérdida de tiempo productivo en la gestión telefónica.

**Bookio** es una plataforma web SaaS (Software as a Service) multi-negocio diseñada para resolver esta problemática. Su arquitectura en la nube permite alta disponibilidad, garantizando un manejo robusto de concurrencia y aprovechando servicios administrados para tareas asíncronas.

### 👥 Equipo y Distribución de Roles
* **Alan Varela:** Backend feature 1 + Front end.
* **Samuel Pia:** Backend feature 2 + Front end.
* **Jair Aguilar:** Backend feature 3 + CI/CD.

---

## 🏗️ Arquitectura en AWS
El proyecto está diseñado sobre una arquitectura en la nube utilizando los siguientes 5 servicios principales de AWS:

1. **Amazon EC2 (Cómputo):** Alojamiento de nuestra API RESTful (Node.js/Express) bajo entorno Linux.
2. **Amazon RDS - PostgreSQL (Base de Datos):** Implementación del modelo relacional Multi-tenant, garantizando transacciones ACID a través de Prisma ORM.
3. **Amazon S3 (Almacenamiento):** Uso dual para alojamiento del *Static Website* (Frontend SPA) y repositorio para recursos estáticos del negocio (imágenes/logotipos).
4. **Amazon SNS (Mensajería):** Arquitectura orientada a eventos para el envío asíncrono de correos transaccionales (confirmaciones de citas).
5. **AWS Secrets Manager (Seguridad):** Inyección segura de variables de entorno y credenciales hacia nuestras instancias EC2.

### Diagramas Técnicos

<details>
<summary><b>☁️ Ver Diagrama de Arquitectura AWS</b></summary>
<br>
<p align="center">
  <img src="https://i.imgur.com/59kCgQO.png" alt="Diagrama de Arquitectura AWS" width="800"/>
</p>
</details>

<details>
<summary><b>🔀 Ver Flujo de Secuencia (Disponibilidad y Reserva)</b></summary>
<br>
<p align="center">
  <img src="https://imgur.com/GIikXmE.png" alt="Flujo de Disponibilidad y Reserva" width="800"/>
</p>
</details>

<details>
<summary><b>🗄️ Ver Diagrama de Entidad Relación (Multi-tenant)</b></summary>
<br>
<p align="center">
  <img src="https://imgur.com/KUaBgl9.png" alt="Diagrama de Entidad Relación Multi-tenant" width="800"/>
</p>
</details>

---

## 🚀 Flujos End-to-End
El desarrollo se centra en 3 flujos principales enumerados:

1. **Flujo 1 - Configuración del Tenant:** Validación y creación del espacio del negocio (Business/Service) almacenando recursos en S3 y RDS.
2. **Flujo 2 - Motor de Reserva:** Manejo de concurrencia relacional estricta para registrar citas sin empalmes en el calendario (PostgreSQL).
3. **Flujo 3 - Notificaciones por Eventos:** Desacoplamiento de procesos mediante la publicación asíncrona de eventos en Amazon SNS para correos de confirmación.

---

## ⚙️ Cómo correr el proyecto (Local)

### Prerrequisitos
* Node.js (v18 o superior)
* PostgreSQL instalado localmente
* Cuenta de AWS (para servicios administrados)

### Pasos de instalación
1. Clona el repositorio:
   ```bash
   git clone https://github.com/AlanDVarela/bookio-backend
   cd bookio-backend
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Variables de entorno:
   Crea un archivo `.env` basándote en el archivo `.env.example`. Asegúrate de colocar las llaves correctas de Firebase (`FIREBASE_PRIVATE_KEY`, etc.)

4. Levanta la Base de Datos Local con Docker:
   ```bash
   docker-compose up -d
   ```

5. Sincroniza el esquema de base de datos y llénala de datos base (Seed):
   ```bash
   npx prisma generate
   npx prisma db push
   npx prisma db seed
   ```

6. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

### 📁 Estructura del Proyecto

```text
bookio-backend/
├── docker-compose.yml       # Base de Datos Local
├── .env.example             # Ejemplo de variables de entorno
├── api.http                 # Archivo de pruebas rápidas REST (Usar con VSCode REST Client)
├── prisma.config.ts         # Configuración del CLI de Prisma
├── prisma/
│   ├── schema.prisma        # Modelo de Base de Datos
│   └── seed.ts              # Script para poblar la DB inicial
└── src/
    ├── app/
    │   ├── appointments/    # Lógica de Reservaciones
    │   ├── auth/            # Rutas y validaciones de Firebase
    │   ├── businesses/      # Puntos de entrada para el local / negocio
    │   ├── favorites/       # Gestión de favoritos del cliente
    │   ├── middlewares/     # Jwt, RequireRole, S3, SNS, SecretManager
    │   ├── reviews/         # Opiniones de citas pasadas
    │   ├── schedules/       # Horarios laborables
    │   ├── services/        # Catálogo de servicios por negocio
    │   └── users/           # Perfil y metadatos de usuario
    ├── config/              # Inyección de environment (.env)
    ├── database/            # Conexión Adapter Pg de Prisma
    └── index.ts             # Entry point (Express)
```

---

## 📡 API Reference (`/api/v1`)

A continuación se listan los endpoints principales agrupados por dominio. Todos los endpoints que requieren autenticación esperan un `Bearer Token` de Firebase válido en los headers.

### 🔐 Autenticación (`/auth`)
| Método | Endpoint | Descripción | Body / Query | Headers requeridos |
|---|---|---|---|---|
| POST | `/auth/login` | Login inicial en backend | `{}` | `Auth: Bearer` |
| POST | `/auth/register/client` | Registra a un nuevo usuario como `CLIENT` | `{ name, phone }` | `Auth: Bearer` |
| POST | `/auth/register/business` | Registra a un nuevo usuario como `BUSINESS_OWNER` | `{ name, phone }` | `Auth: Bearer` |
| GET | `/auth/me` | Devuelve el perfil completo del usuario autenticado | N/A | `Auth: Bearer` |

### 🏢 Negocios (`/businesses`)
| Método | Endpoint | Descripción | Body / Query | Headers requeridos |
|---|---|---|---|---|
| GET | `/businesses` | Obtiene el directorio de negocios | `?page, limit` | Público |
| GET | `/businesses/recommended` | Obtiene top 5 de negocios mejor evaluados | N/A | Público |
| GET | `/businesses/:id` | Detalle público del negocio | N/A | Público |
| GET | `/businesses/:id/services` | Lista los servicios ofrecidos por un negocio | N/A | Público |
| GET | `/businesses/metrics` | Obtiene los KPIs de rendimiento del negocio | N/A | `Auth: Bearer` (Owner) |
| GET | `/businesses/reservations` | Obtiene lista de reservas filtrada opcionalmente por fecha | `?date=YYYY-MM-DD` | `Auth: Bearer` (Owner) |

### 📅 Citas (`/appointments`)
| Método | Endpoint | Descripción | Body / Query | Headers requeridos |
|---|---|---|---|---|
| GET | `/appointments` | Obtiene citas. Permite filtrar por estado temporal | `?status=upcoming/past/cancelled` | `Auth: Bearer` |
| GET | `/appointments/slots` | Obtiene slots disponibles para realizar una reserva | `?businessId, date` | Público / Auth |
| POST | `/appointments` | Reserva una nueva cita | `{ businessId, serviceId, startDatetime... }` | `Auth: Bearer` (Client) |
| PUT | `/appointments/:id/status` | Cambia el estado (CONFIRMED/CANCELLED) | `{ status }` | `Auth: Bearer` |

### ⭐ Favoritos & Reseñas (`/favorites`, `/reviews`)
| Método | Endpoint | Descripción | Body / Query | Headers requeridos |
|---|---|---|---|---|
| GET | `/favorites` | Obtiene lista de negocios favoritos del usuario | N/A | `Auth: Bearer` (Client) |
| POST | `/favorites` | Guarda un negocio en favoritos | `{ businessId }` | `Auth: Bearer` (Client) |
| DELETE| `/favorites/:id` | Remueve de favoritos | N/A | `Auth: Bearer` (Client) |
| POST | `/reviews` | Sube una evaluación pos-cita | `{ score, comment, appointment_id }`| `Auth: Bearer` (Client) |
| GET | `/reviews/business/:id` | Obtiene todas las revisiones publicadas de un negocio | N/A | Público |

---

## 🛠️ Middlewares Customizados

El proyecto cuenta con un set de middlewares especializados para inyectar lógica de negocio, separar responsabilidades (Separation of Concerns) y mantener los Endpoints limpios:

| Middleware / Servicio | Archivo | Descripción de Responsabilidad |
|---|---|---|
| **Verificador de Firebase** | `auth.middleware.ts: authenticateJWT` | Intercepta el request, lee el header `Authorization`, y con `firebase-admin` valida criptográficamente el token (JWT). Inyecta la data segura decodificada en `req.user`. |
| **Control de Accesos (RBAC)** | `auth.middleware.ts: requireRole` | Actúa junto al verificador. Lee los roles de base de datos extraídos en `req.user` y bloquea u otorga acceso a clientes, dueños de negocios o admins. |
| **Parser Multipart FormData** | `upload.middleware.ts: upload` | Configuración base en memoria (via Multer) para parsear correctamente *uploads* sin ensuciar los controladores. Permite transferencias directas. |
| **AWS S3 Object Uploader** | `s3.service.ts` | Recibe Buffers desde el middleware multipart y mediante el AWS SDK v3 los sube asíncronamente al respectivo Bucket privado/público. Retorna URIs seguras. |
| **AWS SNS Event Dispatcher** | `sns.service.ts` | Servicio global de notificaciones. Emplea Tópicos (Topics) de Amazon Simple Notification Service para disparar triggers a dispositivos móviles o endpoints paralelos de manera no bloqueante. |
| **AWS Secrets Resolver** | `secretManager.service.ts` | Encripta peticiones en runtime que requieren claves API muy sensibles delegando la búsqueda a las bóvedas blindadas de Cloud en lugar de almacenarlas localmente. |
