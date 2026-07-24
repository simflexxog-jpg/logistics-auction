const { Sequelize } = require('sequelize');
require('dotenv').config();
const path = require('path');

let sequelize;

if (process.env.NODE_ENV === 'production' || process.env.DATABASE_URL) {
  // Use PostgreSQL in production or if DATABASE_URL is set
  sequelize = new Sequelize(process.env.DATABASE_URL || 'postgresql://localhost:5432/logistics_auction', {
    dialect: 'postgres',
    dialectOptions: process.env.NODE_ENV === 'production' ? {
      ssl: { require: true, rejectUnauthorized: false }
    } : {},
    logging: false,
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
  });
} else {
  // Use SQLite in development if no DATABASE_URL
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../../logistics.db'),
    logging: false
  });
}

module.exports = sequelize;
