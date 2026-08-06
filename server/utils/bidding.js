function validateReverseAuctionBid({ amount, latestBidAmount }) {
  const amountNumber = Number(amount);
  if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
    return { valid: false, error: 'Invalid bid amount' };
  }

  if (latestBidAmount == null) {
    return { valid: true };
  }

  if (amountNumber >= latestBidAmount) {
    return {
      valid: false,
      error: `You must bid lower than the latest bid (${latestBidAmount})`
    };
  }

  return { valid: true };
}

module.exports = { validateReverseAuctionBid };
