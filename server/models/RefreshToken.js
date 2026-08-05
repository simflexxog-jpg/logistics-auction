const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RefreshToken = sequelize.define('RefreshToken', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tokenHash: { field: 'token_hash', type: DataTypes.STRING, allowNull: false, unique: true },
  userId: { field: 'user_id', type: DataTypes.UUID, allowNull: false },
  expiresAt: { field: 'expires_at', type: DataTypes.DATE, allowNull: false },
  revoked: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { timestamps: true, tableName: 'refresh_tokens' });

module.exports = RefreshToken;
