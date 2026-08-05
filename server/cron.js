const { Listing, Bid } = require('./models');
const { Op } = require('sequelize');
const logger = require('./config/logger');

// Run every 30 seconds - close expired auctions
const startAuctionCron = (io) => {
  const closeExpiredAuctions = async () => {
    try {
      const expired = await Listing.findAll({
        where: {
          status: 'open',
          auctionEndsAt: { [Op.lt]: new Date() }
        }
      });

      for (const listing of expired) {
        // Find lowest bid
        const lowestBid = await Bid.findOne({
          where: { listingId: listing.id },
          order: [['amount', 'ASC']]
        });

        if (lowestBid) {
          await listing.update({ status: 'auction_ended', winnerId: lowestBid.partnerId, winningBid: lowestBid.amount });
          await listing.reload();
          // Notify room
          io?.to(`listing:${listing.id}`).emit('listing:updated', listing);
          io?.to(`listing:${listing.id}`).emit('auction:ended', {
            listingId: listing.id,
            winnerId: lowestBid.partnerId,
            lowestBid: lowestBid.amount
          });
          logger.info({ listingId: listing.id, lowestBid: lowestBid.amount }, 'Auction ended for listing');
        } else {
          // No bids — mark as ended with no winner
          await listing.update({ status: 'auction_ended' });
          await listing.reload();
          io?.to(`listing:${listing.id}`).emit('listing:updated', listing);
          io?.to(`listing:${listing.id}`).emit('auction:ended', { listingId: listing.id, noBids: true });
        }
      }
    } catch (err) {
      logger.error({ err }, 'Cron error');
    }
  };

  // Run immediately then every 30s
  closeExpiredAuctions();
  setInterval(closeExpiredAuctions, 30000);
  logger.info('Auction cron started');
};

module.exports = { startAuctionCron };
