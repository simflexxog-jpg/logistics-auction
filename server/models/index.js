const sequelize = require('../config/database');
const User = require('./User');
const Listing = require('./Listing');
const Bid = require('./Bid');
const Payment = require('./Payment');
const ChatMessage = require('./ChatMessage');
const Rating = require('./Rating');
const AddOn = require('./AddOn');
const RefreshToken = require('./RefreshToken');
const AuditLog = require('./AuditLog');
// Tier-based models
const Shipment = require('./Shipment');
const ShipmentLocation = require('./ShipmentLocation');
const CarrierProfile = require('./CarrierProfile');
const LoadTemplate = require('./LoadTemplate');
const CarrierDocument = require('./CarrierDocument');
const Invoice = require('./Invoice');

// Associations
User.hasMany(Listing, { foreignKey: 'customerId', as: 'listings' });
Listing.belongsTo(User, { foreignKey: 'customerId', as: 'customer' });

Listing.hasMany(Bid, { foreignKey: 'listingId', as: 'bids' });
Bid.belongsTo(Listing, { foreignKey: 'listingId' });
Bid.belongsTo(User, { foreignKey: 'partnerId', as: 'partner' });

Listing.hasMany(ChatMessage, { foreignKey: 'listingId', as: 'messages' });
Listing.hasOne(Payment, { foreignKey: 'listingId', as: 'payment' });
Listing.hasOne(Rating, { foreignKey: 'listingId', as: 'rating' });

// Tier-based associations
// Shipment associations
Shipment.belongsTo(Listing, { foreignKey: 'auctionId', as: 'auction' });
Shipment.belongsTo(User, { foreignKey: 'customerId', as: 'customer' });
Shipment.belongsTo(User, { foreignKey: 'carrierId', as: 'carrier' });
Shipment.hasMany(ShipmentLocation, { foreignKey: 'shipmentId', as: 'locations' });
Shipment.hasMany(Rating, { foreignKey: 'shipmentId', as: 'ratings' });
Shipment.hasOne(Invoice, { foreignKey: 'shipmentId', as: 'invoice' });

// ShipmentLocation
ShipmentLocation.belongsTo(Shipment, { foreignKey: 'shipmentId' });

// CarrierProfile
User.hasOne(CarrierProfile, { foreignKey: 'userId', as: 'carrierProfile' });
CarrierProfile.belongsTo(User, { foreignKey: 'userId' });
CarrierProfile.hasMany(CarrierDocument, { foreignKey: 'carrierId', as: 'documents' });

// CarrierDocument
CarrierDocument.belongsTo(CarrierProfile, { foreignKey: 'carrierId' });

// LoadTemplate
User.hasMany(LoadTemplate, { foreignKey: 'userId', as: 'templates' });
LoadTemplate.belongsTo(User, { foreignKey: 'userId' });

// Invoice
Invoice.belongsTo(Shipment, { foreignKey: 'shipmentId' });
Invoice.belongsTo(User, { foreignKey: 'customerId', as: 'customer' });
Invoice.belongsTo(User, { foreignKey: 'carrierId', as: 'carrier' });

const syncDB = async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log('Database synced successfully');
  } catch (err) {
    // Log error but don't crash - the server will continue without DB
    console.error('Database sync error:', err.message);
  }
};

module.exports = {
  sequelize,
  syncDB,
  User,
  Listing,
  Bid,
  Payment,
  ChatMessage,
  Rating,
  AddOn,
  RefreshToken,
  AuditLog,
  // Tier-based models
  Shipment,
  ShipmentLocation,
  CarrierProfile,
  LoadTemplate,
  CarrierDocument,
  Invoice
};
