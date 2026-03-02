// api/analytics/analytics.routes.js
const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const { Transaction, Category, sequelize } = require('../../models');
const { Op, fn, col, literal } = require('sequelize');
const gemini = require('../../services/gemini.service');

// GET /api/analytics/monthly-summary?months=6
// Resumen de gastos e ingresos por mes
router.get('/monthly-summary', auth, async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 6;
    const since = new Date();
    since.setMonth(since.getMonth() - months);

    const results = await Transaction.findAll({
      where: {
        user_id: req.user.id,
        date: { [Op.gte]: since }
      },
      attributes: [
        [fn('DATE_FORMAT', col('date'), '%Y-%m'), 'month'],
        'type',
        [fn('SUM', col('amount')), 'total'],
        [fn('COUNT', col('id')), 'count']
      ],
      group: [literal("DATE_FORMAT(date, '%Y-%m')"), 'type'],
      order: [[literal("DATE_FORMAT(date, '%Y-%m')"), 'ASC']],
      raw: true
    });

    // Armar estructura por mes
    const monthMap = {};
    results.forEach(r => {
      if (!monthMap[r.month]) monthMap[r.month] = { month: r.month, income: 0, expenses: 0, count: 0 };
      if (r.type === 'income') monthMap[r.month].income = parseFloat(r.total);
      else monthMap[r.month].expenses = parseFloat(r.total);
      monthMap[r.month].count += parseInt(r.count);
    });

    const monthly = Object.values(monthMap).map(m => ({
      ...m,
      balance: m.income - m.expenses,
      saved: Math.max(0, m.income - m.expenses),
    }));

    res.json(monthly);
  } catch (err) {
    console.error('[Analytics] Monthly summary error:', err);
    res.status(500).json({ error: 'Error al obtener resumen mensual' });
  }
});

// GET /api/analytics/by-category?month=2025-01
// Gastos por categoría en un mes
router.get('/by-category', auth, async (req, res) => {
  try {
    const { month } = req.query;
    const where = { user_id: req.user.id, type: 'expense' };

    if (month) {
      const [year, mon] = month.split('-');
      where.date = {
        [Op.between]: [new Date(year, mon - 1, 1), new Date(year, mon, 0)]
      };
    }

    const results = await Transaction.findAll({
      where,
      attributes: [
        'category_id',
        [fn('SUM', col('Transaction.amount')), 'total'],
        [fn('COUNT', col('Transaction.id')), 'count']
      ],
      include: [{ model: Category, attributes: ['name', 'icon', 'color'], required: false }],
      group: ['category_id', 'Category.id'],
      order: [[literal('total'), 'DESC']],
      raw: true,
      nest: true
    });

    const total = results.reduce((sum, r) => sum + parseFloat(r.total), 0);

    const data = results.map(r => ({
      category_id: r.category_id,
      name: r.Category?.name || 'Sin categoría',
      icon: r.Category?.icon || '📦',
      color: r.Category?.color || '#9ca3af',
      total: parseFloat(r.total),
      count: parseInt(r.count),
      percentage: total > 0 ? ((parseFloat(r.total) / total) * 100).toFixed(1) : 0,
    }));

    res.json({ total, categories: data });
  } catch (err) {
    console.error('[Analytics] By category error:', err);
    res.status(500).json({ error: 'Error al obtener gastos por categoría' });
  }
});

// GET /api/analytics/savings-progress?month=2025-01
// Progreso de ahorro del mes
router.get('/savings-progress', auth, async (req, res) => {
  try {
    const { SavingsGoal } = require('../../models');
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const [year, mon] = month.split('-');

    // Total gastado en el mes
    const expenseResult = await Transaction.findOne({
      where: {
        user_id: req.user.id,
        type: 'expense',
        date: { [Op.between]: [new Date(year, mon - 1, 1), new Date(year, mon, 0)] }
      },
      attributes: [[fn('SUM', col('amount')), 'total']],
      raw: true
    });
    const totalExpenses = parseFloat(expenseResult?.total || 0);

    // Total ingresado en el mes
    const incomeResult = await Transaction.findOne({
      where: {
        user_id: req.user.id,
        type: 'income',
        date: { [Op.between]: [new Date(year, mon - 1, 1), new Date(year, mon, 0)] }
      },
      attributes: [[fn('SUM', col('amount')), 'total']],
      raw: true
    });
    const totalIncome = parseFloat(incomeResult?.total || 0);

    // Objetivo del mes
    const goal = await SavingsGoal.findOne({
      where: { user_id: req.user.id, month_year: month }
    });

    const actualSaved = Math.max(0, totalIncome - totalExpenses);
    const progress = goal ? Math.min(100, (actualSaved / parseFloat(goal.target_amount)) * 100) : null;

    res.json({
      month,
      total_income: totalIncome,
      total_expenses: totalExpenses,
      actual_saved: actualSaved,
      goal: goal ? { id: goal.id, target: parseFloat(goal.target_amount), notes: goal.notes } : null,
      progress_percentage: progress ? parseFloat(progress.toFixed(1)) : null,
      goal_met: progress !== null && progress >= 100,
    });
  } catch (err) {
    console.error('[Analytics] Savings progress error:', err);
    res.status(500).json({ error: 'Error al calcular progreso de ahorro' });
  }
});

// GET /api/analytics/insights?months=3
// Análisis inteligente con Gemini
router.get('/insights', auth, async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 3;
    const since = new Date();
    since.setMonth(since.getMonth() - months);

    // Obtener datos de categorías
    const categoryData = await Transaction.findAll({
      where: { user_id: req.user.id, type: 'expense', date: { [Op.gte]: since } },
      attributes: [
        'category_id',
        [fn('SUM', col('Transaction.amount')), 'total'],
        [fn('AVG', col('Transaction.amount')), 'avg'],
        [fn('COUNT', col('Transaction.id')), 'count']
      ],
      include: [{ model: Category, attributes: ['name'], required: false }],
      group: ['category_id', 'Category.id'],
      raw: true, nest: true
    });

    // Resumen mensual
    const monthlyData = await Transaction.findAll({
      where: { user_id: req.user.id, date: { [Op.gte]: since } },
      attributes: [
        [fn('DATE_FORMAT', col('date'), '%Y-%m'), 'month'],
        'type',
        [fn('SUM', col('amount')), 'total']
      ],
      group: [literal("DATE_FORMAT(date, '%Y-%m')"), 'type'],
      raw: true
    });

    const spendingData = {
      period_months: months,
      by_category: categoryData.map(r => ({
        category: r.Category?.name || 'Sin categoría',
        total: parseFloat(r.total),
        avg_per_transaction: parseFloat(r.avg).toFixed(2),
        transaction_count: parseInt(r.count)
      })),
      monthly: monthlyData
    };

    const insights = await gemini.analyzeSpending(spendingData);
    res.json(insights);
  } catch (err) {
    console.error('[Analytics] Insights error:', err.message);
    res.status(500).json({ error: `Error generando insights: ${err.message}` });
  }
});

module.exports = router;
