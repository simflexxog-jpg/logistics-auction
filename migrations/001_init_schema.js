/* Conditional migration: creates refresh_tokens, audit_logs, adds roles to users, and creates recommended indexes if columns exist. */
exports.shorthands = undefined;

exports.up = (pgm) => {
  // Ensure uuid generation function available
  pgm.sql(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
  // Add roles column to users if not exists
  pgm.sql(`DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='"Users"' AND column_name='roles') THEN
      ALTER TABLE "Users" ADD COLUMN roles text[] DEFAULT ARRAY[]::text[];
    END IF;
  END$$;`);

  // Create refresh_tokens table
  pgm.sql(`CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );`);

  // Create audit_logs table
  pgm.sql(`CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES "Users"(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    old_value JSONB,
    new_value JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );`);

  // Create indexes conditionally on common column names
  pgm.sql(`DO $$
  BEGIN
    -- bids: listingId or listing_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='"Bids"' AND column_name='"listingId"') THEN
      CREATE INDEX IF NOT EXISTS idx_bids_listingId ON "Bids"("listingId");
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='"Bids"' AND column_name='listingid') THEN
      CREATE INDEX IF NOT EXISTS idx_bids_listingid ON "Bids"(listingid);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='"Bids"' AND column_name='"partnerId"') THEN
      CREATE INDEX IF NOT EXISTS idx_bids_partnerId ON "Bids"("partnerId");
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='"Bids"' AND column_name='partnerid') THEN
      CREATE INDEX IF NOT EXISTS idx_bids_partnerid ON "Bids"(partnerid);
    END IF;

    -- createdAt indexes
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='"Bids"' AND column_name='"createdAt"') THEN
      CREATE INDEX IF NOT EXISTS idx_bids_createdAt ON "Bids"("createdAt" DESC);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='"Listings"' AND column_name='"status"') THEN
      CREATE INDEX IF NOT EXISTS idx_listings_status ON "Listings"("status");
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='"Listings"' AND column_name='"auctionEndsAt"') THEN
      CREATE INDEX IF NOT EXISTS idx_listings_endTime ON "Listings"("auctionEndsAt");
    END IF;

    -- partial index for active auctions (status = 'open')
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='"Listings"' AND column_name='"auctionEndsAt"') THEN
      CREATE INDEX IF NOT EXISTS idx_active_listings ON "Listings"("auctionEndsAt") WHERE "status" = 'open';
    END IF;

    -- unique index for refresh_tokens.token_hash
    CREATE UNIQUE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
  END$$;`);
};

exports.down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS idx_refresh_tokens_hash;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_active_listings;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_listings_endTime;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_listings_status;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_bids_createdAt;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_bids_partnerId;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_bids_partnerid;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_bids_listingId;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_bids_listingid;`);

  pgm.sql(`DROP TABLE IF EXISTS audit_logs;`);
  pgm.sql(`DROP TABLE IF EXISTS refresh_tokens;`);

  pgm.sql(`DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='"Users"' AND column_name='roles') THEN
      ALTER TABLE "Users" DROP COLUMN roles;
    END IF;
  END$$;`);
};
