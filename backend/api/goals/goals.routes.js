// api/goals/goals.routes.js
const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const { SavingsGoal, Transaction, sequelize } = require('../../models');
const { Op, fn, col } = require('sequelize');

// GET /api/goals
router.get('/', auth, async (req, res) => {
  try {
    const goals = await SavingsGoal.findAll({
      where: { user_id: req.user.id },
      order: [['month_year', 'DESC']]
    });

    const enriched = await Promise.all(goals.map(async (goal) => {
      let start, end;

      if (goal.period_type === 'annual') {
        const year = goal.month_year.split('-')[0];
        start = new Date(year, 0, 1);
        end = new Date(year, 11, 31);
      } else {
        const [year, mon] = goal.month_year.split('-');
        start = new Date(year, mon - 1, 1);
        end = new Date(year, mon, 0);
      }

      // Para objetivos en USD: sumar usd_amount de transacciones savings
      // Para objetivos en ARS: calcular income - expenses
      const target = parseFloat(goal.target_amount);
      const currency = goal.currency || 'ARS';

      let actualSaved = 0;

      if (currency === 'USD') {
        const savingsResult = await Transaction.findOne({
          where: { user_id: req.user.id, type: 'savings', date: { [Op.between]: [start, end] } },
          attributes: [[fn('SUM', col('usd_amount')), 'total']], raw: true
        });
        actualSaved = parseFloat(savingsResult?.total || 0);
      } else {
        const [incomeResult, expenseResult] = await Promise.all([
          Transaction.findOne({
            where: { user_id: req.user.id, type: 'income', date: { [Op.between]: [start, end] } },
            attributes: [[fn('SUM', col('amount')), 'total']], raw: true
          }),
          Transaction.findOne({
            where: { user_id: req.user.id, type: 'expense', date: { [Op.between]: [start, end] } },
            attributes: [[fn('SUM', col('amount')), 'total']], raw: true
          })
        ]);
        const income = parseFloat(incomeResult?.total || 0);
        const expenses = parseFloat(expenseResult?.total || 0);
        actualSaved = Math.max(0, income - expenses);
      }

      const progress = target > 0 ? Math.min(100, (actualSaved / target) * 100) : 0;

      return {
        id: goal.id,
        month_year: goal.month_year,
        period_type: goal.period_type || 'monthly',
        currency: currency,
        target_amount: target,
        actual_saved: actualSaved,
        progress_percentage: parseFloat(progress.toFixed(1)),
        goal_met: progress >= 100,
        notes: goal.notes,
      };
    }));

    // Racha: solo meses pasados con objetivos mensuales cumplidos
    let streak = 0;
    const monthlyGoals = enriched
      .filter(g => g.period_type === 'monthly')
      .filter(g => {
        const [y, m] = g.month_year.split('-');
        return new Date(y, m - 1, 1) < new Date();
      })
      .sort((a, b) => b.month_year.localeCompare(a.month_year));

    for (const g of monthlyGoals) {
      if (g.goal_met) streak++;
      else break;
    }

    res.json({ goals: enriched, streak });
  } catch (err) {
    console.error('[Goals] GET error:', err);
    res.status(500).json({ error: 'Error al obtener objetivos' });
  }
});

// POST /api/goals
router.post('/', auth, async (req, res) => {
  try {
    const { month_year, target_amount, notes, period_type, currency } = req.body;
    if (!month_year || !target_amount)
      return res.status(400).json({ error: 'month_year y target_amount son requeridos' });

    const [goal, created] = await SavingsGoal.findOrCreate({
      where: { user_id: req.user.id, month_year, period_type: period_type || 'monthly' },
      defaults: {
        target_amount: parseFloat(target_amount),
        notes: notes || null,
        period_type: period_type || 'monthly',
        currency: currency || 'USD',
      }
    });

    if (!created) {
      await goal.update({
        target_amount: parseFloat(target_amount),
        notes: notes || null,
        currency: currency || 'USD',
      });
    }

    res.status(created ? 201 : 200).json(goal);
  } catch (err) {
    console.error('[Goals] POST error:', err);
    res.status(500).json({ error: 'Error al guardar objetivo' });
  }
});

// DELETE /api/goals/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const goal = await SavingsGoal.findOne({ where: { id: req.params.id, user_id: req.user.id } });
    if (!goal) return res.status(404).json({ error: 'Objetivo no encontrado' });
    await goal.destroy();
    res.json({ message: 'Objetivo eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar objetivo' });
  }
});

module.exports = router;