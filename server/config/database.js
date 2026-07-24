const { Sequelize } = require('sequelize');
require('dotenv').config();
const path = require('path');

let sequelize;
let isPostgres = false;

// Determine which database to use
const shouldUsePostgres = process.env.DATABASE_URL && !process.env.FORCE_SQLITE;

if (shouldUsePostgres) {
  // Create PostgreSQL instance (connection happens on first query)
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: process.env.NODE_ENV === 'production' ? {
      ssl: { require: true, rejectUnauthorized: false }
    } : {},
    logging: false,
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
  });
  isPostgres = true;
} else {
  // Use SQLite in development if no DATABASE_URL
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../../logistics.db'),
    logging: false
  });
}

module.exports = sequelize;
module.exports.isPostgres = isPostgres;
