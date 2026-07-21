const sequelize = require('../config/database');
const User = require('./User');
const Listing = require('./Listing');
const Bid = require('./Bid');
const Payment = require('./Payment');
const ChatMessage = require('./ChatMessage');
const Rating = require('./Rating');
const AddOn = require('./AddOn');

// Associations
User.hasMany(Listing, { foreignKey: 'customerId', as: 'listings' });
Listing.belongsTo(User, { foreignKey: 'customerId', as: 'customer' });

Listing.hasMany(Bid, { foreignKey: 'listingId', as: 'bids' });
Bid.belongsTo(Listing, { foreignKey: 'listingId' });
Bid.belongsTo(User, { foreignKey: 'partnerId', as: 'partner' });

Listing.hasMany(ChatMessage, { foreignKey: 'listingId', as: 'messages' });
Listing.hasOne(Payment, { foreignKey: 'listingId', as: 'payment' });
Listing.hasOne(Rating, { foreignKey: 'listingId', as: 'rating' });

const syncDB = async () => {
  await sequelize.sync({ alter: true });
  console.log('Database synced');
};

module.exports = { sequelize, syncDB, User, Listing, Bid, Payment, ChatMessage, Rating, AddOn };
