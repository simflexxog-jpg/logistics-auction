const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { INVOICE_STATUS } = require('../constants');

const Invoice = sequelize.define('Invoice', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  shipmentId: { type: DataTypes.UUID, allowNull: false },
  customerId: { type: DataTypes.UUID, allowNull: false },
  carrierId: { type: DataTypes.UUID, allowNull: false },
  amount: { type: DataTypes.FLOAT, allowNull: false },
  status: {
    type: DataTypes.ENUM(...Object.values(INVOICE_STATUS)),
    defaultValue: INVOICE_STATUS.PENDING
  },
  issuedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  paidAt: { type: DataTypes.DATE },
  orgId: { type: DataTypes.UUID }
}, { 
  timestamps: true,
  indexes: [
    { fields: ['shipmentId'], unique: true },
    { fields: ['customerId', 'status'] },
    { fields: ['carrierId', 'status'] }
  ]
});

module.exports = Invoice;
