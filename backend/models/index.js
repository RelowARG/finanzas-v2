// models/index.js
const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'finanzas_v2',
  process.env.DB_USER || 'finanzas_user',
  process.env.DB_PASSWORD || 'finanzas_pass_2024',
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    dialect: 'mysql',
    logging: false,
    dialectOptions: { charset: 'utf8mb4' },
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
  }
);

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  email: { type: DataTypes.STRING(150), unique: true, allowNull: false },
  password_hash: { type: DataTypes.STRING(255), allowNull: false },
  avatar_color: { type: DataTypes.STRING(7), defaultValue: '#6366f1' },
}, { tableName: 'users', timestamps: true, createdAt: 'created_at', updatedAt: false });

const Category = sequelize.define('Category', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  icon: { type: DataTypes.STRING(10), defaultValue: '📦' },
  color: { type: DataTypes.STRING(7), defaultValue: '#6366f1' },
  type: { type: DataTypes.ENUM('expense', 'income'), defaultValue: 'expense' },
  is_default: { type: DataTypes.BOOLEAN, defaultValue: false },
  user_id: { type: DataTypes.INTEGER, allowNull: true },
}, { tableName: 'categories', timestamps: true, createdAt: 'created_at', updatedAt: false });

const Transaction = sequelize.define('Transaction', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  description: { type: DataTypes.STRING(255), allowNull: false },
  amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  type: { type: DataTypes.ENUM('expense', 'income', 'savings'), allowNull: false },
  category_id: { type: DataTypes.INTEGER, allowNull: true },
  source: { type: DataTypes.ENUM('pdf', 'manual'), defaultValue: 'manual' },
  bank: { type: DataTypes.STRING(50), allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
  usd_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  exchange_rate: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
}, { tableName: 'transactions', timestamps: true, createdAt: 'created_at', updatedAt: false });

const SavingsGoal = sequelize.define('SavingsGoal', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  month_year: { type: DataTypes.STRING(7), allowNull: false }, // "2026-03" o "2026" para anual
  period_type: { type: DataTypes.ENUM('monthly', 'annual'), defaultValue: 'monthly' },
  currency: { type: DataTypes.ENUM('ARS', 'USD'), defaultValue: 'USD' },
  target_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  notes: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'savings_goals', timestamps: true, createdAt: 'created_at', updatedAt: false });

User.hasMany(Transaction, { foreignKey: 'user_id' });
Transaction.belongsTo(User, { foreignKey: 'user_id' });
Category.hasMany(Transaction, { foreignKey: 'category_id' });
Transaction.belongsTo(Category, { foreignKey: 'category_id' });
User.hasMany(Category, { foreignKey: 'user_id' });
Category.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(SavingsGoal, { foreignKey: 'user_id' });
SavingsGoal.belongsTo(User, { foreignKey: 'user_id' });

module.exports = { sequelize, User, Category, Transaction, SavingsGoal };