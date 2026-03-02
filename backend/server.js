// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models');

const app = express();
const PORT = process.env.PORT || 5001;

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',').map(s => s.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production')
      cb(null, true);
    else cb(new Error('CORS: origen no permitido'));
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── ROUTES ──────────────────────────────────────────────────────────────────
app.use('/api/auth',         require('./api/auth/auth.routes'));
app.use('/api/transactions', require('./api/transactions/transactions.routes'));
app.use('/api/categories',   require('./api/categories/categories.routes'));
app.use('/api/pdf',          require('./api/pdf/pdf.routes'));
app.use('/api/analytics',    require('./api/analytics/analytics.routes'));
app.use('/api/goals',        require('./api/goals/goals.routes'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '2.0.0' }));

// ─── ERROR HANDLER ───────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' });
});

// ─── START ───────────────────────────────────────────────────────────────────
const start = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado a MySQL');
    // alter: true agrega columnas nuevas sin borrar datos existentes
    await sequelize.sync({ alter: true });
    console.log('✅ Modelos sincronizados');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Backend corriendo en http://localhost:${PORT}`);
      console.log(`📊 CORS habilitado para: ${allowedOrigins.join(', ')}`);
    });
  } catch (err) {
    console.error('❌ Error al iniciar:', err.message);
    console.error('   Asegurate de que Docker esté corriendo: docker-compose up -d');
    process.exit(1);
  }
};

start();