const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM('customer', 'partner', 'ADMIN', 'CARRIER', 'SHIPPER', 'VIEWER'), allowNull: false, defaultValue: 'customer' },
  phone: { type: DataTypes.STRING },
  // Multi-tenancy: Organization ID
  orgId: { type: DataTypes.UUID },
  // Partner specific
  truckType: { type: DataTypes.STRING },
  truckCapacity: { type: DataTypes.FLOAT },
  licensePlate: { type: DataTypes.STRING },
  truckPhoto: { type: DataTypes.STRING },
  licenseDoc: { type: DataTypes.STRING },
  isVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
  avgRating: { type: DataTypes.FLOAT, defaultValue: 0 },
  totalRatings: { type: DataTypes.INTEGER, defaultValue: 0 },
  totalEarnings: { type: DataTypes.FLOAT, defaultValue: 0 },
}, { timestamps: true });

module.exports = User;
