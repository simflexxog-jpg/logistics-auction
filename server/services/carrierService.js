const turf = require('@turf/turf');
const { Listing, CarrierProfile, Rating } = require('../models');
const { sequelize } = require('../models');
const { AUCTION_STATUS } = require('../constants');

/**
 * Carrier Service - handles carrier profiles, load filtering, and analytics
 */

exports.getAvailableLoads = async (carrierId, orgId) => {
  // Get carrier profile with service lanes
  const carrierProfile = await CarrierProfile.findOne({
    where: { userId: carrierId }
  });

  if (!carrierProfile || !carrierProfile.serviceLanes || carrierProfile.serviceLanes.length === 0) {
    // Return empty if no service lanes defined
    return [];
  }

  // Get all open auctions in the organization
  const where = { status: AUCTION_STATUS.OPEN };
  if (orgId) where.orgId = orgId;

  const listings = await Listing.findAll({
    where,
    include: [
      { association: 'customer', attributes: ['id', 'name'] },
      {
        association: 'bids',
        where: { partnerId: carrierId },
        required: false // Left join - show loads even if carrier already bid
      }
    ]
  });

  // Filter by service lanes using Turf.js
  const matchingLoads = listings.filter(listing => {
    const pickupPoint = turf.point([listing.pickupLng, listing.pickupLat]);

    // Check if pickup point is within any of the carrier's service lanes
    return carrierProfile.serviceLanes.some(lane => {
      try {
        return turf.booleanPointInPolygon(pickupPoint, lane);
      } catch (err) {
        console.warn('Error checking service lane:', err.message);
        return false;
      }
    });
  });

  return matchingLoads;
};

exports.updateCarrierProfile = async (userId, profileData, orgId) => {
  let profile = await CarrierProfile.findOne({
    where: { userId }
  });

  if (!profile) {
    profile = await CarrierProfile.create({
      userId,
      orgId,
      ...profileData
    });
  } else {
    // Multi-tenancy check
    if (orgId && profile.orgId && profile.orgId !== orgId) {
      throw new Error('Access denied');
    }

    await profile.update(profileData);
  }

  return profile;
};

exports.getCarrierProfile = async (userId, orgId) => {
  const profile = await CarrierProfile.findOne({
    where: { userId },
    include: [
      { association: 'documents' }
    ]
  });

  if (!profile) throw new Error('Carrier profile not found');

  // Multi-tenancy check
  if (orgId && profile.orgId && profile.orgId !== orgId) {
    throw new Error('Access denied');
  }

  return profile;
};

exports.computeCarrierStats = async (carrierId, orgId) => {
  // Get all ratings for this carrier
  const ratings = await Rating.findAll({
    where: { toUserId: carrierId }
  });

  // Compute average rating
  const avgRating = ratings.length > 0
    ? (ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length).toFixed(2)
    : 0;

  // Update carrier profile with computed stats
  await CarrierProfile.update(
    { avgRating: parseFloat(avgRating) },
    { where: { userId: carrierId } }
  );

  return {
    avgRating: parseFloat(avgRating),
    totalRatings: ratings.length
  };
};

exports.getCarrierEarnings = async (carrierId, orgId) => {
  // Get all delivered shipments for this carrier
  const { Shipment, Invoice } = require('../models');

  const where = { carrierId, status: 'DELIVERED' };
  if (orgId) where.orgId = orgId;

  const shipments = await Shipment.findAll({
    where,
    include: [
      { association: 'invoice' }
    ]
  });

  const totalEarnings = shipments.reduce((sum, s) => sum + (s.invoice?.amount || 0), 0);
  const totalShipments = shipments.length;

  // Update carrier profile
  await CarrierProfile.update(
    { totalEarnings, totalShipments },
    { where: { userId: carrierId } }
  );

  return {
    totalEarnings,
    totalShipments,
    shipments
  };
};

exports.getCarrierAnalytics = async (carrierId, orgId) => {
  // Lane performance: shipments per pickup lane
  const { Shipment } = require('../models');

  const where = { carrierId };
  if (orgId) where.orgId = orgId;

  const shipments = await Shipment.findAll({
    where,
    include: [
      { association: 'auction', attributes: ['pickupAddress', 'pickupLat', 'pickupLng', 'dropoffAddress'] }
    ]
  });

  // Aggregate by pickup location (simplified)
  const laneStats = {};
  shipments.forEach(s => {
    const lane = s.auction?.pickupAddress || 'Unknown';
    if (!laneStats[lane]) {
      laneStats[lane] = { count: 0, totalEarnings: 0, avgRating: 0 };
    }
    laneStats[lane].count++;
  });

  return {
    lanePerformance: laneStats,
    totalShipments: shipments.length
  };
};

module.exports = exports;
