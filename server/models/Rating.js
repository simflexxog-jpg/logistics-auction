const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Rating = sequelize.define('Rating', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  // Legacy fields (for backward compatibility)
  listingId: { type: DataTypes.UUID },
  customerId: { type: DataTypes.UUID },
  partnerId: { type: DataTypes.UUID },
  // New tier-based fields (shipment model)
  shipmentId: { type: DataTypes.UUID },
  fromUserId: { type: DataTypes.UUID },
  toUserId: { type: DataTypes.UUID },
  orgId: { type: DataTypes.UUID },
  score: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 5 } },
  stars: { type: DataTypes.INTEGER, validate: { min: 1, max: 5 } }, // Legacy field
  comment: { type: DataTypes.TEXT },
}, { 
  timestamps: true,
  indexes: [
    { fields: ['shipmentId', 'fromUserId'], unique: true }, // One rating per shipment per rater
    { fields: ['toUserId'] } // For computing avg rating
  ]
});

module.exports = Rating;
