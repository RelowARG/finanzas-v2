// api/transactions/transactions.routes.js
const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const { Transaction, Category } = require('../../models');
const { Op } = require('sequelize');

// GET /api/transactions
router.get('/', auth, async (req, res) => {
  try {
    const { month, category_id, type, source, page = 1, limit = 100 } = req.query;
    const where = { user_id: req.user.id };

    if (month) {
      const [year, mon] = month.split('-');
      const start = new Date(year, mon - 1, 1);
      const end = new Date(year, mon, 0);
      where.date = { [Op.between]: [start, end] };
    }
    if (category_id) where.category_id = category_id;
    if (type) where.type = type;
    if (source) where.source = source;

    const { count, rows } = await Transaction.findAndCountAll({
      where,
      include: [{ model: Category, attributes: ['id', 'name', 'icon', 'color'] }],
      order: [['date', 'DESC'], ['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });

    res.json({ total: count, page: parseInt(page), transactions: rows });
  } catch (err) {
    console.error('[Transactions] GET error:', err);
    res.status(500).json({ error: 'Error al obtener transacciones' });
  }
});

// GET /api/transactions/savings-summary?month=2026-02
router.get('/savings-summary', auth, async (req, res) => {
  try {
    const { month } = req.query;
    const where = { user_id: req.user.id, type: 'savings' };

    if (month) {
      const [year, mon] = month.split('-');
      const start = new Date(year, mon - 1, 1);
      const end = new Date(year, mon, 0);
      where.date = { [Op.between]: [start, end] };
    }

    const savings = await Transaction.findAll({ where });
    const total_usd = savings.reduce((sum, t) => sum + parseFloat(t.usd_amount || 0), 0);
    const total_ars = savings.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

    res.json({ total_usd, total_ars, count: savings.length, transactions: savings });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener resumen de ahorros' });
  }
});

// POST /api/transactions
router.post('/', auth, async (req, res) => {
  try {
    const { date, description, amount, type, category_id, source, bank, notes, usd_amount, exchange_rate } = req.body;
    if (!date || !description || !amount || !type)
      return res.status(400).json({ error: 'Faltan campos requeridos: date, description, amount, type' });

    const tx = await Transaction.create({
      user_id: req.user.id,
      date, description,
      amount: parseFloat(amount),
      type,
      category_id: category_id || null,
      source: source || 'manual',
      bank: bank || null,
      notes: notes || null,
      usd_amount: usd_amount ? parseFloat(usd_amount) : null,
      exchange_rate: exchange_rate ? parseFloat(exchange_rate) : null,
    });

    const full = await Transaction.findByPk(tx.id, {
      include: [{ model: Category, attributes: ['id', 'name', 'icon', 'color'] }]
    });
    res.status(201).json(full);
  } catch (err) {
    console.error('[Transactions] POST error:', err);
    res.status(500).json({ error: 'Error al crear transacción' });
  }
});

// POST /api/transactions/bulk
router.post('/bulk', auth, async (req, res) => {
  try {
    const { transactions } = req.body;
    if (!Array.isArray(transactions) || transactions.length === 0)
      return res.status(400).json({ error: 'Se requiere un array de transacciones' });

    const toCreate = transactions.map(t => ({
      user_id: req.user.id,
      date: t.date,
      description: t.description,
      amount: parseFloat(t.amount),
      type: t.type,
      category_id: t.category_id || null,
      source: 'pdf',
      bank: t.bank || null,
      notes: t.notes || null,
      usd_amount: t.usd_amount ? parseFloat(t.usd_amount) : null,
      exchange_rate: t.exchange_rate ? parseFloat(t.exchange_rate) : null,
    }));

    const created = await Transaction.bulkCreate(toCreate);
    res.status(201).json({ created: created.length, message: `${created.length} transacciones importadas` });
  } catch (err) {
    console.error('[Transactions] Bulk POST error:', err);
    res.status(500).json({ error: 'Error al importar transacciones' });
  }
});

// PUT /api/transactions/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const tx = await Transaction.findOne({ where: { id: req.params.id, user_id: req.user.id } });
    if (!tx) return res.status(404).json({ error: 'Transacción no encontrada' });

    const { date, description, amount, type, category_id, notes, usd_amount, exchange_rate } = req.body;
    await tx.update({
      date, description,
      amount: parseFloat(amount),
      type, category_id, notes,
      usd_amount: usd_amount ? parseFloat(usd_amount) : null,
      exchange_rate: exchange_rate ? parseFloat(exchange_rate) : null,
    });

    const full = await Transaction.findByPk(tx.id, {
      include: [{ model: Category, attributes: ['id', 'name', 'icon', 'color'] }]
    });
    res.json(full);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar transacción' });
  }
});

// DELETE /api/transactions/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const tx = await Transaction.findOne({ where: { id: req.params.id, user_id: req.user.id } });
    if (!tx) return res.status(404).json({ error: 'Transacción no encontrada' });
    await tx.destroy();
    res.json({ message: 'Transacción eliminada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar transacción' });
  }
});

module.exports = router;