const { Queue, Worker } = require('bullmq');
const redis = require('../config/redis');
const logger = require('../config/logger');

const connection = {
  // BullMQ requires a redis connection object. ioredis instance is compatible.
  // Provide connection as { host, port } when needed; here we pass ioredis instance
  // by using the `connection` option with `redis` client instance.
  // BullMQ will accept an ioredis instance directly.
  client: redis,
  // fallback: leave empty
};

const auctionQueue = new Queue('auction-expiry', { connection: redis });

// Example worker which closes auctions when job runs
const worker = new Worker('auction-expiry', async (job) => {
  try {
    logger.info({ jobId: job.id, name: job.name }, 'Processing auction expiry job');
    const { auctionId } = job.data;
    // Implement closeAuction logic where appropriate; this is a placeholder
    // require('../services/auctionService').closeAuction(auctionId);
    logger.info({ auctionId }, 'Auction expiry processed (placeholder)');
  } catch (err) {
    logger.error({ err }, 'Auction worker error');
    throw err;
  }
}, { connection: redis });

worker.on('failed', (job, err) => {
  logger.error({ jobId: job.id, err }, 'Auction job failed');
});

module.exports = { auctionQueue, worker };
