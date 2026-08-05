const sequelize = require('../config/database');
const User = require('./User');
const Listing = require('./Listing');
const Bid = require('./Bid');
const Payment = require('./Payment');
const ChatMessage = require('./ChatMessage');
const Rating = require('./Rating');
const AddOn = require('./AddOn');
const RefreshToken = require('./RefreshToken');

const logger = require('../config/logger');

// Associations
User.hasMany(Listing, { foreignKey: 'customerId', as: 'listings' });
Listing.belongsTo(User, { foreignKey: 'customerId', as: 'customer' });

Listing.hasMany(Bid, { foreignKey: 'listingId', as: 'bids' });
Bid.belongsTo(Listing, { foreignKey: 'listingId' });
Bid.belongsTo(User, { foreignKey: 'partnerId', as: 'partner' });

Listing.hasMany(ChatMessage, { foreignKey: 'listingId', as: 'messages' });
Listing.hasOne(Payment, { foreignKey: 'listingId', as: 'payment' });
Listing.hasOne(Rating, { foreignKey: 'listingId', as: 'rating' });
Payment.belongsTo(User, { foreignKey: 'customerId', as: 'customer' });
Payment.belongsTo(User, { foreignKey: 'partnerId', as: 'partner' });

const syncDB = async () => {
  try {
    // Only use alter for Postgres to avoid incompatible ALTER statements on SQLite
    const dialect = sequelize.getDialect && sequelize.getDialect();
    if (dialect === 'postgres') {
      await sequelize.sync({ alter: true });
    } else {
      await sequelize.sync();
    }
    logger.info('Database synced successfully');
  } catch (err) {
    logger.error({ err }, 'Database sync error');
  }
};

module.exports = { sequelize, syncDB, User, Listing, Bid, Payment, ChatMessage, Rating, AddOn, RefreshToken };
