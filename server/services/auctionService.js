const { Listing, Bid, Shipment, Invoice } = require('../models');
const { AUCTION_STATUS, SHIPMENT_STATUS, INVOICE_STATUS } = require('../constants');

/**
 * Auction Service - handles bidding and award logic
 */

exports.awardAuction = async (auctionId, winningBidId, customerId, orgId) => {
  // Validate auction exists and user owns it
  const listing = await Listing.findByPk(auctionId);
  if (!listing) throw new Error('Auction not found');
  if (listing.customerId !== customerId) throw new Error('Not your auction');
  if (listing.status !== AUCTION_STATUS.OPEN) throw new Error('Auction not open');

  // Multi-tenancy check
  if (orgId && listing.orgId && listing.orgId !== orgId) {
    throw new Error('Access denied');
  }

  // Get the winning bid
  const bid = await Bid.findByPk(winningBidId);
  if (!bid || bid.listingId !== auctionId) {
    throw new Error('Bid not found');
  }

  // Create shipment in AWARDED state
  const shipment = await Shipment.create({
    auctionId,
    customerId,
    carrierId: bid.partnerId,
    awardedPrice: bid.amount,
    status: SHIPMENT_STATUS.AWARDED,
    pickupAt: listing.createdAt,
    orgId
  });

  // Update listing to CLOSED
  await listing.update({
    status: AUCTION_STATUS.CLOSED,
    winnerId: bid.partnerId,
    winningBid: bid.amount
  });

  // Create invoice
  await Invoice.create({
    shipmentId: shipment.id,
    customerId,
    carrierId: bid.partnerId,
    amount: bid.amount,
    status: INVOICE_STATUS.PENDING,
    orgId
  });

  // Update bid status
  await bid.update({ status: 'accepted' });

  return shipment;
};

exports.validateCarrierCanBid = async (carrierId, orgId) => {
  const { CarrierProfile } = require('../models');
  const { CARRIER_VERIFICATION_STATUS } = require('../constants');

  const profile = await CarrierProfile.findOne({
    where: { userId: carrierId }
  });

  if (!profile) throw new Error('Carrier profile not found');
  if (profile.verificationStatus !== CARRIER_VERIFICATION_STATUS.VERIFIED) {
    throw new Error('Carrier not verified');
  }

  // Multi-tenancy check
  if (orgId && profile.orgId && profile.orgId !== orgId) {
    throw new Error('Access denied');
  }

  return profile;
};

exports.getAuctionWithBids = async (auctionId, orgId) => {
  const listing = await Listing.findByPk(auctionId, {
    include: [
      {
        association: 'bids',
        include: [{ association: 'partner', attributes: ['id', 'name', 'avgRating', 'companyName'] }]
      }
    ]
  });

  if (!listing) throw new Error('Auction not found');

  // Multi-tenancy check
  if (orgId && listing.orgId && listing.orgId !== orgId) {
    throw new Error('Access denied');
  }

  return listing;
};

module.exports = exports;
