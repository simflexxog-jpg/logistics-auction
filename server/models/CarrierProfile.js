const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { CARRIER_VERIFICATION_STATUS } = require('../constants');

const CarrierProfile = sequelize.define('CarrierProfile', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false, unique: true },
  companyName: { type: DataTypes.STRING },
  mcNumber: { type: DataTypes.STRING },
  dotNumber: { type: DataTypes.STRING },
  equipmentTypes: { type: DataTypes.JSON, defaultValue: [] }, // ['DRY_VAN', 'FLATBED', 'REEFER']
  fleetSize: { type: DataTypes.INTEGER },
  verificationStatus: {
    type: DataTypes.ENUM(...Object.values(CARRIER_VERIFICATION_STATUS)),
    defaultValue: CARRIER_VERIFICATION_STATUS.PENDING
  },
  insuranceExpiresAt: { type: DataTypes.DATE },
  serviceLanes: { type: DataTypes.JSON, defaultValue: [] }, // Array of Turf.js GeoJSON polygons
  avgRating: { type: DataTypes.FLOAT, defaultValue: 0 }, // Computed from ratings
  totalShipments: { type: DataTypes.INTEGER, defaultValue: 0 },
  totalEarnings: { type: DataTypes.FLOAT, defaultValue: 0 },
  orgId: { type: DataTypes.UUID }
}, { timestamps: true });

module.exports = CarrierProfile;
