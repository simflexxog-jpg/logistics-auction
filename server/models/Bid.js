const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Bid = sequelize.define('Bid', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  listingId: { type: DataTypes.UUID, allowNull: false },
  partnerId: { type: DataTypes.UUID, allowNull: false },
  amount: { type: DataTypes.FLOAT, allowNull: false },
  note: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM('pending', 'won', 'lost', 'accepted', 'rejected'), defaultValue: 'pending' },
}, { timestamps: true });

module.exports = Bid;
