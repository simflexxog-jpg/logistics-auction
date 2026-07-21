const { Listing, Bid } = require('./models');
const { Op } = require('sequelize');

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
          // Notify room
          io?.to(`listing:${listing.id}`).emit('auction:ended', {
            listingId: listing.id,
            winnerId: lowestBid.partnerId,
            lowestBid: lowestBid.amount
          });
          console.log(`Auction ended for listing ${listing.id}, lowest bid: ${lowestBid.amount}`);
        } else {
          // No bids — mark as ended with no winner
          await listing.update({ status: 'auction_ended' });
          io?.to(`listing:${listing.id}`).emit('auction:ended', { listingId: listing.id, noBids: true });
        }
      }
    } catch (err) {
      console.error('Cron error:', err.message);
    }
  };

  // Run immediately then every 30s
  closeExpiredAuctions();
  setInterval(closeExpiredAuctions, 30000);
  console.log('Auction cron started');
};

module.exports = { startAuctionCron };
