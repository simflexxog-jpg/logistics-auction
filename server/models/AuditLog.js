const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID },
  action: { type: DataTypes.STRING, allowNull: false }, // e.g., 'CREATE', 'UPDATE', 'DELETE'
  entity: { type: DataTypes.STRING, allowNull: false }, // e.g., 'Listing', 'Bid', 'Payment'
  entityId: { type: DataTypes.UUID },
  metadata: { type: DataTypes.JSON }, // Additional context
  orgId: { type: DataTypes.UUID }, // For multi-tenancy
}, { timestamps: true });

module.exports = AuditLog;
