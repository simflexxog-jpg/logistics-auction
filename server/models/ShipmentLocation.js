const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ShipmentLocation = sequelize.define('ShipmentLocation', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  shipmentId: { type: DataTypes.UUID, allowNull: false },
  lat: { type: DataTypes.FLOAT, allowNull: false },
  lng: { type: DataTypes.FLOAT, allowNull: false },
  timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  orgId: { type: DataTypes.UUID }
}, { 
  timestamps: true,
  indexes: [
    { fields: ['shipmentId', 'timestamp'] }
  ]
});

module.exports = ShipmentLocation;
