// api/pdf/pdf.routes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');
const auth = require('../../middleware/auth');
const gemini = require('../../services/gemini.service');
const { Category } = require('../../models');
const { Op } = require('sequelize');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Solo se aceptan archivos PDF'));
  }
});

const SUPPORTED_BANKS = ['Galicia', 'Mercado Pago', 'ICBC', 'American Express', 'UALA', 'Otro'];

// POST /api/pdf/parse
router.post('/parse', auth, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo PDF' });

    const bank = req.body.bank || 'desconocido';
    console.log(`[PDF] Procesando extracto de ${bank} (${(req.file.size / 1024).toFixed(0)} KB)`);

    // Extraer texto del PDF
    let pdfData;
    try {
      pdfData = await pdfParse(req.file.buffer);
    } catch (pdfErr) {
      return res.status(422).json({ error: 'No se pudo leer el PDF. Asegurate de que no esté protegido con contraseña.' });
    }

    if (!pdfData.text || pdfData.text.trim().length < 50) {
      return res.status(422).json({ error: 'El PDF no tiene texto legible. Puede ser un PDF escaneado.' });
    }

    // Parsear con Gemini — ahora devuelve { transactions, dueDate }
    const { transactions: rawTransactions, dueDate } = await gemini.parseBankPDF(pdfData.text, bank);

    // Obtener categorías para matchear los IDs
    const categories = await Category.findAll({
      where: { [Op.or]: [{ is_default: true }, { user_id: req.user.id }] }
    });
    const categoryMap = {};
    categories.forEach(c => { categoryMap[c.name.toLowerCase()] = c; });

    // Enriquecer transacciones con IDs de categorías
    const enriched = rawTransactions.map(t => {
      const catName = (t.suggested_category || '').toLowerCase();
      const matchedCat = categoryMap[catName];
      return {
        ...t,
        bank,
        category_id: matchedCat?.id || null,
        category: matchedCat
          ? { id: matchedCat.id, name: matchedCat.name, icon: matchedCat.icon, color: matchedCat.color }
          : null,
      };
    });

    res.json({
      bank,
      total_found: enriched.length,
      transactions: enriched,
      pages: pdfData.numpages,
      due_date: dueDate, // fecha de vencimiento detectada
    });

  } catch (err) {
    console.error('[PDF] Error:', err.message);
    if (err.message.includes('cuota') || err.message.includes('Cuota')) {
      return res.status(503).json({ error: 'Las API keys de Gemini alcanzaron su límite. Intentá más tarde o agregá más keys.' });
    }
    res.status(500).json({ error: `Error procesando PDF: ${err.message}` });
  }
});

// GET /api/pdf/banks
router.get('/banks', (req, res) => {
  res.json({ banks: SUPPORTED_BANKS });
});

module.exports = router;