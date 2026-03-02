-- Finanzas App v2 - Schema inicial

CREATE DATABASE IF NOT EXISTS finanzas_v2;
USE finanzas_v2;

-- Usuarios (para uso familiar, máximo ~5 personas)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_color VARCHAR(7) DEFAULT '#6366f1',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categorías
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(10) DEFAULT '📦',
  color VARCHAR(7) DEFAULT '#6366f1',
  type ENUM('expense', 'income') DEFAULT 'expense',
  is_default BOOLEAN DEFAULT FALSE,
  user_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Transacciones
CREATE TABLE IF NOT EXISTS transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  date DATE NOT NULL,
  description VARCHAR(255) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  type ENUM('expense', 'income') NOT NULL,
  category_id INT,
  source ENUM('pdf', 'manual') DEFAULT 'manual',
  bank VARCHAR(50) NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Objetivos de ahorro mensuales
CREATE TABLE IF NOT EXISTS savings_goals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  month_year VARCHAR(7) NOT NULL, -- formato: "2025-01"
  target_amount DECIMAL(15,2) NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_month (user_id, month_year),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Categorías por defecto
INSERT IGNORE INTO categories (name, icon, color, type, is_default) VALUES
('Supermercado', '🛒', '#10b981', 'expense', TRUE),
('Restaurantes', '🍽️', '#f59e0b', 'expense', TRUE),
('Transporte', '🚗', '#3b82f6', 'expense', TRUE),
('Combustible', '⛽', '#6b7280', 'expense', TRUE),
('Salud', '🏥', '#ef4444', 'expense', TRUE),
('Farmacia', '💊', '#ec4899', 'expense', TRUE),
('Ropa', '👕', '#8b5cf6', 'expense', TRUE),
('Entretenimiento', '🎬', '#f97316', 'expense', TRUE),
('Servicios', '💡', '#14b8a6', 'expense', TRUE),
('Educación', '📚', '#6366f1', 'expense', TRUE),
('Viajes', '✈️', '#0ea5e9', 'expense', TRUE),
('Hogar', '🏠', '#84cc16', 'expense', TRUE),
('Tecnología', '💻', '#a855f7', 'expense', TRUE),
('Delivery', '📦', '#fb923c', 'expense', TRUE),
('Suscripciones', '📺', '#7c3aed', 'expense', TRUE),
('Efectivo / Varios', '💵', '#9ca3af', 'expense', TRUE),
('Sueldo', '💼', '#22c55e', 'income', TRUE),
('Freelance', '🧑‍💻', '#06b6d4', 'income', TRUE),
('Inversiones', '📈', '#eab308', 'income', TRUE),
('Otros ingresos', '💰', '#10b981', 'income', TRUE);
