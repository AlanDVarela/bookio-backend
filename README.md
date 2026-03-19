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
3. Configura las variables de entorno:

Crea un archivo .env en la raíz del proyecto basándote en .env.example.

4. Inicializa Prisma y sincroniza la base de datos:

```bash
npx prisma generate
npx prisma db push
```
5. Levanta el servidor en modo desarrollo:
```bash
npm run dev
```
