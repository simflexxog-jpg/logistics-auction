const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payment = sequelize.define('Payment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  listingId: { type: DataTypes.UUID, allowNull: false },
  customerId: { type: DataTypes.UUID, allowNull: false },
  partnerId: { type: DataTypes.UUID, allowNull: false },
  amount: { type: DataTypes.FLOAT, allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'completed', 'refunded'), defaultValue: 'pending' },
  transactionId: { type: DataTypes.STRING },
  method: { type: DataTypes.STRING, defaultValue: 'card' },
}, { timestamps: true });

module.exports = Payment;
