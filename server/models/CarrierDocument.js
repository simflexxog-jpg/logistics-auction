const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { DOCUMENT_TYPE } = require('../constants');

const CarrierDocument = sequelize.define('CarrierDocument', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  carrierId: { type: DataTypes.UUID, allowNull: false },
  docType: {
    type: DataTypes.ENUM(...Object.values(DOCUMENT_TYPE)),
    allowNull: false
  },
  fileUrl: { type: DataTypes.STRING, allowNull: false },
  expiresAt: { type: DataTypes.DATE }, // Nullable for docs that don't expire
  orgId: { type: DataTypes.UUID }
}, { 
  timestamps: true,
  indexes: [
    { fields: ['carrierId'] }
  ]
});

module.exports = CarrierDocument;
