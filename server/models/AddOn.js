const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AddOn = sequelize.define('AddOn', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  customerId: { type: DataTypes.UUID, allowNull: false },
  mainListingId: { type: DataTypes.UUID }, // claimed to this listing
  partnerId: { type: DataTypes.UUID },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  weight: { type: DataTypes.FLOAT, allowNull: false },
  pickupAddress: { type: DataTypes.STRING, allowNull: false },
  pickupLat: { type: DataTypes.FLOAT, allowNull: false },
  pickupLng: { type: DataTypes.FLOAT, allowNull: false },
  dropoffAddress: { type: DataTypes.STRING, allowNull: false },
  dropoffLat: { type: DataTypes.FLOAT, allowNull: false },
  dropoffLng: { type: DataTypes.FLOAT, allowNull: false },
  price: { type: DataTypes.FLOAT, allowNull: false },
  status: { type: DataTypes.ENUM('open', 'claimed', 'delivered'), defaultValue: 'open' },
}, { timestamps: true });

module.exports = AddOn;
