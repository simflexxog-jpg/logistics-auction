const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Listing = sequelize.define('Listing', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  customerId: { type: DataTypes.UUID, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  cargoType: { type: DataTypes.STRING, allowNull: false },
  weight: { type: DataTypes.FLOAT, allowNull: false },
  dimensions: { type: DataTypes.STRING },
  pickupAddress: { type: DataTypes.STRING, allowNull: false },
  pickupLat: { type: DataTypes.FLOAT, allowNull: false },
  pickupLng: { type: DataTypes.FLOAT, allowNull: false },
  dropoffAddress: { type: DataTypes.STRING, allowNull: false },
  dropoffLat: { type: DataTypes.FLOAT, allowNull: false },
  dropoffLng: { type: DataTypes.FLOAT, allowNull: false },
  auctionEndsAt: { type: DataTypes.DATE, allowNull: false },
  status: {
    type: DataTypes.ENUM('open', 'auction_ended', 'accepted', 'in_transit', 'delivered', 'cancelled'),
    defaultValue: 'open'
  },
  winnerId: { type: DataTypes.UUID },
  winningBid: { type: DataTypes.FLOAT },
  isAddOnEligible: { type: DataTypes.BOOLEAN, defaultValue: false },
  maxAddOnWeight: { type: DataTypes.FLOAT, defaultValue: 100 },
}, { timestamps: true });

module.exports = Listing;
