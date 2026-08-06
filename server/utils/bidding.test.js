const test = require('node:test');
const assert = require('node:assert/strict');
const { validateReverseAuctionBid } = require('./bidding');

test('allows the first bid when there is no latest bid', () => {
  const result = validateReverseAuctionBid({ amount: 7000, latestBidAmount: null });
  assert.equal(result.valid, true);
  assert.equal(result.error, undefined);
});

test('rejects bids that are equal to or above the latest bid', () => {
  const result = validateReverseAuctionBid({ amount: 7000, latestBidAmount: 7000 });
  assert.equal(result.valid, false);
  assert.match(result.error, /lower than the latest bid/);
});

test('allows a lower follow-up bid than the latest bid', () => {
  const result = validateReverseAuctionBid({ amount: 6500, latestBidAmount: 7000 });
  assert.equal(result.valid, true);
});
