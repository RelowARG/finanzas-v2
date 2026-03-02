# Finanzas Familiar v2 🏠💰

App de finanzas personales para uso familiar. Simple, potente y con carga automática de gastos desde PDFs bancarios.

## ✨ Funcionalidades

- **Importación automática de PDFs** bancarios (Galicia, Mercado Pago, ICBC, American Express, UALA)
- **Categorización inteligente** con Gemini AI
- **Rotación automática de API keys** de Gemini (podés poner varias gratis)
- **Análisis de gastos** por categoría y por mes
- **Comparativas** — qué mes gastaron más/menos
- **Insights con IA** — dónde podés ahorrar
- **Objetivos de ahorro gamificados** con racha y badges
- **Multi-usuario** para uso familiar
- **Base de datos MySQL en Docker** — persiste siempre, levanta solo

## 🚀 Setup inicial (solo la primera vez)

### 1. Requisitos previos
- [Node.js 18+](https://nodejs.org)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### 2. Clonar y configurar

```bash
# En la carpeta del proyecto
cd finanzas-v2

# Copiar y editar el .env del backend
cp backend/.env.example backend/.env
# → Editar backend/.env y poner tus API keys de Gemini
```

### 3. Conseguir API keys de Gemini (gratis)

1. Ir a [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Crear una o varias keys (cada cuenta de Google tiene su cuota gratuita)
3. Copiarlas en `backend/.env`:

```env
GEMINI_API_KEYS=key1,key2,key3
```

### 4. Levantar la base de datos

```bash
docker-compose up -d
```

Esto levanta MySQL en Docker. Los datos se guardan en un volumen persistente —
no se pierden aunque reinicies Docker o la PC.

### 5. Instalar dependencias

```bash
# Backend
cd backend && npm install

# Frontend  
cd ../frontend && npm install
```

### 6. Iniciar la app

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

La app estará en **http://localhost:5173**

---

## 📄 Cómo importar un PDF bancario

1. Ir a **Importar PDF** en el menú
2. Seleccionar el banco
3. Subir el PDF del extracto
4. Gemini extrae y categoriza todos los gastos automáticamente
5. Revisar, ajustar categorías si hace falta
6. Confirmar importación

Los gastos en **efectivo** se cargan manualmente desde Transacciones → Nueva.

---

## 🗄️ Base de datos

MySQL corre en Docker en el puerto `3307` para no conflictuar con instalaciones locales.

```bash
# Iniciar MySQL
docker-compose up -d

# Detener MySQL (los datos se conservan)
docker-compose down

# Ver logs
docker-compose logs -f mysql

# Conectar con cliente SQL
mysql -h 127.0.0.1 -P 3307 -u finanzas_user -p finanzas_v2
# password: finanzas_pass_2024
```

---

## 📁 Estructura del proyecto

```
finanzas-v2/
├── docker-compose.yml          ← MySQL en Docker
├── backend/
│   ├── .env.example            ← Copiar a .env y configurar
│   ├── server.js               ← Entrada del servidor
│   ├── models/index.js         ← Modelos Sequelize
│   ├── services/
│   │   └── gemini.service.js   ← Integración Gemini + rotación de keys
│   └── api/
│       ├── auth/               ← Login/registro
│       ├── transactions/       ← CRUD transacciones
│       ├── categories/         ← CRUD categorías
│       ├── pdf/                ← Parseo de PDFs
│       ├── analytics/          ← Análisis y estadísticas
│       └── goals/              ← Objetivos de ahorro
└── frontend/
    └── src/
        ├── pages/
        │   ├── DashboardPage   ← Vista principal
        │   ├── TransactionsPage← Lista + carga manual
        │   ├── ImportPage      ← Importar PDF (3 pasos)
        │   ├── AnalyticsPage   ← Análisis + insights IA
        │   └── GoalsPage       ← Objetivos gamificados
        ├── services/api.js     ← Axios + todos los endpoints
        └── utils/format.js     ← Formateo de moneda/fechas
```

---

## 🔧 Variables de entorno (backend/.env)

```env
PORT=5001
DB_HOST=localhost
DB_PORT=3307
DB_NAME=finanzas_v2
DB_USER=finanzas_user
DB_PASSWORD=finanzas_pass_2024
JWT_SECRET=cambia_esto_por_algo_secreto
GEMINI_API_KEYS=key1,key2,key3
FRONTEND_URL=http://localhost:5173
```
