# Análisis Comparativo — Backend vs Frontend (Bookio)

## Endpoints que faltan en el backend

El frontend espera estos endpoints que el backend **no tiene**:

| Endpoint | Frontend espera | Backend tiene |
|---|---|---|
| `POST /api/v1/auth/login` | Login con email/password | ✅ Completado (Mock local para frontend) |
| `POST /api/v1/auth/register/client` | Registro de cliente | ✅ Completado (Redirecciona a Auth Service) |
| `POST /api/v1/auth/register/business` | Registro de negocio | ✅ Completado (Redirecciona a Auth Service) |
| `GET /api/v1/businesses/recommended` | Negocios recomendados | ✅ Completado |
| `GET /api/v1/appointments` (filtro `status`) | upcoming/past/cancelled | ✅ Completado (Lógica temporal aplicada) |
| `GET /api/v1/business/metrics` | KPIs del negocio | ✅ Completado (Mock de respuesta) |
| `GET /api/v1/business/reservations` (por fecha) | Reservaciones por día | ✅ Completado (Filtro por fecha en dashboard) |
| `GET /api/v1/favorites` | Favoritos del usuario | ✅ Completado (Endpoints tipo Mock) |
| `DELETE /api/v1/favorites/:id` | Quitar favorito | ✅ Completado (Endpoints tipo Mock) |

---

## Lo que sobra o está mal en el backend

### 1. Autenticación mock — debe eliminarse y reemplazarse

El middleware actual ya usa `authenticateJWT` pero para pruebas se ha dejado el mock en el endpoint `/login`. Firebase se encarga de la generación de JWT válida.

### 2. Rutas de usuarios incompletas

- El backend tiene `GET /users`, `GET /users/:id`, `PATCH /users/:id/avatar`
- No hay `POST /users` ni nada de auth — los usuarios no pueden crearse por el backend propio
- El campo `password_hash` existe en el modelo pero nunca se usa

### 3. BusinessType enum desalineado

- **Backend:** `BARBERSHOP | SPA | SALON | OTHER`
- **Frontend:** `restaurant | spa | medical | salon`
- El frontend tiene `restaurant` y `medical` que el backend no contempla; el backend tiene `BARBERSHOP` que el frontend no usa

---

## Discrepancias en modelos de datos

| Campo | Frontend espera | Backend retorna |
|---|---|---|
| `isOpen` en Business | boolean | ❌ No existe (no hay horarios en tiempo real) |
| `tags` en Business | string[] | ❌ No existe |
| `category` en Business | subcategoría (ej: "massage") | ❌ No existe (solo `type`) |
| `clientPhone` en Appointment | Teléfono del cliente | ❌ No existe en User ni Appointment |
| `partySize` en Appointment | Número de personas | ❌ No existe |
| `notes` en Appointment | Notas libres | ❌ No existe |
| `imageUrl` en Business | camelCase | `logo_url` snake_case — desalineado |
| `reviewCount` en Business | camelCase | `review_count` snake_case — desalineado |
| Estado de citas | `confirmed/pending/cancelled` | `CONFIRMED/PENDING/CANCELLED` — case diferente |

---

## Lo que falta en el modelo de datos

1. **`Favorite` model** — el frontend tiene toda una sección de favoritos; el backend ya tiene los controllers y rutas mockeadas pero **falta agregar el modelo en prisma**.
2. **`phone` en User** — ✅ Ya agregado en Prisma y en el Auth Service.
3. **`tags` en Business** — el dashboard filtra y muestra tags
4. **`category` en Business** — subcategoría (ej: "massage" dentro de "spa")
5. **`notes`/`partySize` en Appointment** — datos que el negocio necesita ver en sus reservaciones

---

## Lo que existe en el backend pero el frontend aún no usa

Funcionalidades completas en el backend que el frontend todavía no conecta (pero debería):

- `GET /api/v1/appointments/slots` — slots disponibles (para booking flow, que aún no tiene pantalla)
- `PUT /api/v1/appointments/:id/status` — confirmar/cancelar cita
- `POST /api/v1/reviews` — crear reseña
- `GET /api/v1/reviews/business/:id` — ver reseñas
- `PATCH /api/v1/users/:id/avatar` — subir avatar
- `POST /api/v1/businesses/:id/photos` — subir fotos
- `POST /api/v1/services` — crear servicios
- `POST /api/v1/schedules` — definir horarios

---

## Problemas estructurales a corregir

1. **Formato de respuesta no estandarizado** — el frontend va a esperar camelCase; el backend mezcla `snake_case` (Prisma) con camelCase en algunas partes. Hay que serializar consistentemente.

2. **Sin paginación en el frontend** — el frontend carga todo en memoria; el backend ya implementa `page`/`limit`, pero hay que coordinar.

3. **Filtrado por `status` en appointments** — el frontend espera filtrar por `upcoming/past/cancelled` (lógica temporal + status), el backend solo filtra por `businessId`/`clientId`.

4. **`/api/v1/businesses/recommended`** — el backend no tiene criterio de "recomendado"; el frontend lo usa en la pantalla principal.

5. **Sin ruta de métricas para el negocio** — el dashboard del negocio necesita KPIs (citas hoy, esta semana, ingresos del mes, tasa de ocupación); no hay nada en el backend.

---

## Resumen priorizado

| Prioridad | Tarea |
|---|---|
| 🔴 Crítico | Implementar auth real: login, register, JWT válido |
| 🔴 Crítico | Alinear `BusinessType` entre frontend y backend |
| 🔴 Crítico | Serializar respuestas en camelCase |
| 🟠 Alto | Crear modelo y endpoints de `Favorites` (Endpoints de Mock creados) |
| 🟠 Alto | Agregar `category`, `tags` al modelo |
| 🟠 Alto | Endpoint de métricas del negocio (Mock creado) |
| 🟠 Alto | Filtro por `status` temporal en appointments (✅ Listo) |
| 🟡 Medio | `GET /businesses/recommended` (✅ Listo) |
| 🟡 Medio | Agregar `notes`, `partySize` a Appointment |
| 🟡 Medio | Campo `isOpen` calculado desde schedules |
