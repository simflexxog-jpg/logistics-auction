const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { SHIPMENT_STATUS } = require('../constants');

const Shipment = sequelize.define('Shipment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  auctionId: { type: DataTypes.UUID, allowNull: false },
  customerId: { type: DataTypes.UUID, allowNull: false },
  carrierId: { type: DataTypes.UUID, allowNull: false },
  status: {
    type: DataTypes.ENUM(...Object.values(SHIPMENT_STATUS)),
    defaultValue: SHIPMENT_STATUS.AWARDED
  },
  awardedPrice: { type: DataTypes.FLOAT, allowNull: false },
  pickupAt: { type: DataTypes.DATE },
  confirmedAt: { type: DataTypes.DATE },
  deliveredAt: { type: DataTypes.DATE },
  orgId: { type: DataTypes.UUID }
}, { timestamps: true });

module.exports = Shipment;
