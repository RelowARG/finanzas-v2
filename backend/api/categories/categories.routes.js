// api/categories/categories.routes.js
const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const { Category } = require('../../models');
const { Op } = require('sequelize');

// GET /api/categories - devuelve default + personalizadas del user
router.get('/', auth, async (req, res) => {
  try {
    const categories = await Category.findAll({
      where: {
        [Op.or]: [
          { is_default: true },
          { user_id: req.user.id }
        ]
      },
      order: [['is_default', 'DESC'], ['name', 'ASC']]
    });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
});

// POST /api/categories - crear categoría personalizada
router.post('/', auth, async (req, res) => {
  try {
    const { name, icon, color, type } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre es requerido' });

    const cat = await Category.create({
      name, icon: icon || '📦', color: color || '#6366f1',
      type: type || 'expense', is_default: false, user_id: req.user.id
    });
    res.status(201).json(cat);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear categoría' });
  }
});

// DELETE /api/categories/:id - solo las personalizadas
router.delete('/:id', auth, async (req, res) => {
  try {
    const cat = await Category.findOne({
      where: { id: req.params.id, user_id: req.user.id, is_default: false }
    });
    if (!cat) return res.status(404).json({ error: 'Categoría no encontrada o no eliminable' });
    await cat.destroy();
    res.json({ message: 'Categoría eliminada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar categoría' });
  }
});

module.exports = router;
