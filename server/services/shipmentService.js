const { Shipment, ShipmentLocation } = require('../models');
const { SHIPMENT_STATUS, VALID_TRANSITIONS } = require('../constants');

/**
 * Shipment Service - handles shipment business logic and state machine
 */

exports.updateStatus = async (shipmentId, newStatus, carrierId, orgId) => {
  const shipment = await Shipment.findByPk(shipmentId);
  if (!shipment) throw new Error('Shipment not found');

  // Authorization: only carrier can update
  if (shipment.carrierId !== carrierId) {
    throw new Error('Not your shipment');
  }

  // Multi-tenancy check
  if (orgId && shipment.orgId && shipment.orgId !== orgId) {
    throw new Error('Access denied - different organization');
  }

  // Validate state transition
  const validTransitions = VALID_TRANSITIONS[shipment.status] || [];
  if (!validTransitions.includes(newStatus)) {
    throw new Error(`Cannot transition from ${shipment.status} to ${newStatus}`);
  }

  // Update timestamp based on new status
  const updates = { status: newStatus };
  if (newStatus === SHIPMENT_STATUS.PICKUP_CONFIRMED) {
    updates.confirmedAt = new Date();
  }
  if (newStatus === SHIPMENT_STATUS.DELIVERED) {
    updates.deliveredAt = new Date();
  }

  await shipment.update(updates);
  return shipment;
};

exports.addLocation = async (shipmentId, lat, lng, carrierId, orgId) => {
  const shipment = await Shipment.findByPk(shipmentId);
  if (!shipment) throw new Error('Shipment not found');

  // Authorization
  if (shipment.carrierId !== carrierId) {
    throw new Error('Not your shipment');
  }

  // Multi-tenancy check
  if (orgId && shipment.orgId && shipment.orgId !== orgId) {
    throw new Error('Access denied');
  }

  // Only accept locations if IN_TRANSIT
  if (shipment.status !== SHIPMENT_STATUS.IN_TRANSIT) {
    throw new Error(`Cannot add location - shipment status is ${shipment.status}`);
  }

  const location = await ShipmentLocation.create({
    shipmentId,
    lat,
    lng,
    timestamp: new Date(),
    orgId
  });

  return location;
};

exports.getLocations = async (shipmentId, orgId) => {
  const shipment = await Shipment.findByPk(shipmentId);
  if (!shipment) throw new Error('Shipment not found');

  // Multi-tenancy check
  if (orgId && shipment.orgId && shipment.orgId !== orgId) {
    throw new Error('Access denied');
  }

  const locations = await ShipmentLocation.findAll({
    where: { shipmentId },
    order: [['timestamp', 'ASC']]
  });

  return locations;
};

exports.getShipmentsByCarrier = async (carrierId, orgId) => {
  const where = { carrierId };
  if (orgId) where.orgId = orgId;

  const shipments = await Shipment.findAll({
    where,
    include: [
      { association: 'customer', attributes: ['id', 'name', 'email'] },
      { association: 'carrier', attributes: ['id', 'name'] },
      { association: 'locations', order: [['timestamp', 'DESC']] }
    ],
    order: [['createdAt', 'DESC']]
  });

  return shipments;
};

exports.getShipmentsByCustomer = async (customerId, orgId) => {
  const where = { customerId };
  if (orgId) where.orgId = orgId;

  const shipments = await Shipment.findAll({
    where,
    include: [
      { association: 'customer', attributes: ['id', 'name'] },
      { association: 'carrier', attributes: ['id', 'name', 'avgRating'] }
    ],
    order: [['createdAt', 'DESC']]
  });

  return shipments;
};

exports.getShipmentDetail = async (shipmentId, userId, orgId) => {
  const shipment = await Shipment.findByPk(shipmentId, {
    include: [
      { association: 'customer', attributes: ['id', 'name', 'email', 'phone'] },
      { association: 'carrier', attributes: ['id', 'name', 'avgRating', 'companyName'] },
      { association: 'locations' },
      { association: 'ratings' },
      { association: 'invoice' }
    ]
  });

  if (!shipment) throw new Error('Shipment not found');

  // Multi-tenancy check
  if (orgId && shipment.orgId && shipment.orgId !== orgId) {
    throw new Error('Access denied');
  }

  // Authorization: only customer, carrier, or admin can view
  if (shipment.customerId !== userId && shipment.carrierId !== userId) {
    throw new Error('Access denied');
  }

  return shipment;
};

module.exports = exports;
