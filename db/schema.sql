-- Baseline schema (SQLite). PRAGMA foreign_keys enabled at connection time.
-- Amounts are integer minor units (e.g. cents).

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  wx_openid TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'buyer',
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS artist_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  verification_status TEXT NOT NULL DEFAULT 'none',
  service_tags TEXT,
  rating REAL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_risk_scores (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  risk_level TEXT NOT NULL DEFAULT 'low',
  reason_codes TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS trade_items (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  price INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'LISTED',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trade_items_seller ON trade_items(seller_id, status);

CREATE TABLE IF NOT EXISTS trade_orders (
  id TEXT PRIMARY KEY,
  buyer_id TEXT NOT NULL REFERENCES users(id),
  seller_id TEXT NOT NULL REFERENCES users(id),
  item_id TEXT NOT NULL REFERENCES trade_items(id),
  status TEXT NOT NULL,
  total_amount INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trade_orders_status_updated ON trade_orders(status, updated_at);

CREATE TABLE IF NOT EXISTS trade_fulfillments (
  id TEXT PRIMARY KEY,
  trade_order_id TEXT NOT NULL REFERENCES trade_orders(id) ON DELETE CASCADE,
  ship_mode TEXT,
  tracking_no TEXT,
  proof_url TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS artist_slots (
  id TEXT PRIMARY KEY,
  artist_id TEXT NOT NULL REFERENCES users(id),
  slot_start INTEGER NOT NULL,
  slot_end INTEGER NOT NULL,
  slot_status TEXT NOT NULL DEFAULT 'AVAILABLE',
  created_at INTEGER NOT NULL,
  UNIQUE (artist_id, slot_start, slot_end)
);

CREATE INDEX IF NOT EXISTS idx_artist_slots_artist_start ON artist_slots(artist_id, slot_start);

CREATE TABLE IF NOT EXISTS service_orders (
  id TEXT PRIMARY KEY,
  buyer_id TEXT NOT NULL REFERENCES users(id),
  artist_id TEXT NOT NULL REFERENCES users(id),
  slot_id TEXT NOT NULL REFERENCES artist_slots(id),
  status TEXT NOT NULL,
  deposit_amount INTEGER NOT NULL DEFAULT 0,
  final_amount INTEGER NOT NULL DEFAULT 0,
  hold_expires_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_service_orders_status_updated ON service_orders(status, updated_at);

CREATE TABLE IF NOT EXISTS service_attendance_proofs (
  id TEXT PRIMARY KEY,
  service_order_id TEXT NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  proof_type TEXT NOT NULL,
  proof_url TEXT NOT NULL,
  confirmed_by TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS unified_orders (
  id TEXT PRIMARY KEY,
  order_type TEXT NOT NULL CHECK (order_type IN ('trade', 'service')),
  domain_order_id TEXT NOT NULL,
  buyer_id TEXT NOT NULL REFERENCES users(id),
  seller_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (order_type, domain_order_id)
);

CREATE INDEX IF NOT EXISTS idx_unified_buyer_updated ON unified_orders(buyer_id, updated_at);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  scope TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  unified_order_id TEXT NOT NULL REFERENCES unified_orders(id) ON DELETE CASCADE,
  request_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, scope, idempotency_key)
);

CREATE TABLE IF NOT EXISTS order_payments (
  id TEXT PRIMARY KEY,
  unified_order_id TEXT NOT NULL REFERENCES unified_orders(id) ON DELETE CASCADE,
  order_type TEXT NOT NULL,
  order_id TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  amount INTEGER NOT NULL,
  wx_txn_id TEXT,
  idempotency_key TEXT UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS order_disputes (
  id TEXT PRIMARY KEY,
  unified_order_id TEXT NOT NULL REFERENCES unified_orders(id) ON DELETE CASCADE,
  order_type TEXT NOT NULL,
  order_id TEXT NOT NULL,
  dispute_status TEXT NOT NULL,
  reason TEXT,
  sla_due_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_disputes_status_created ON order_disputes(dispute_status, created_at);

CREATE TABLE IF NOT EXISTS dispute_evidences (
  id TEXT PRIMARY KEY,
  dispute_id TEXT NOT NULL REFERENCES order_disputes(id) ON DELETE CASCADE,
  uploader_id TEXT NOT NULL REFERENCES users(id),
  evidence_type TEXT NOT NULL,
  evidence_url TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settlement_ledger (
  id TEXT PRIMARY KEY,
  unified_order_id TEXT REFERENCES unified_orders(id) ON DELETE SET NULL,
  order_type TEXT NOT NULL,
  order_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER,
  trace_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settlement_jobs (
  id TEXT PRIMARY KEY,
  unified_order_id TEXT REFERENCES unified_orders(id) ON DELETE SET NULL,
  order_type TEXT NOT NULL,
  order_id TEXT NOT NULL,
  job_status TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at INTEGER,
  created_at INTEGER NOT NULL
);

-- WeChat payment notify idempotency (transaction_id unique per provider)
CREATE TABLE IF NOT EXISTS wechat_webhook_events (
  transaction_id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES order_payments(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id),
  image_url TEXT NOT NULL,
  caption TEXT,
  status TEXT NOT NULL DEFAULT 'published',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS post_conversion_cards (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  card_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_status TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id, created_at);
CREATE INDEX IF NOT EXISTS idx_post_cards_post ON post_conversion_cards(post_id);

-- 同城面交核销：一单一码；存 hash 不存明文；幂等完成态
CREATE TABLE IF NOT EXISTS trade_local_verifications (
  id TEXT PRIMARY KEY,
  trade_order_id TEXT NOT NULL UNIQUE REFERENCES trade_orders(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'COMPLETED', 'EXPIRED', 'FAILED')),
  expires_at INTEGER NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 8,
  fulfillment_id TEXT REFERENCES trade_fulfillments(id) ON DELETE SET NULL,
  trace_id_issue TEXT,
  trace_id_redeem TEXT,
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tlv_expires ON trade_local_verifications(status, expires_at);
