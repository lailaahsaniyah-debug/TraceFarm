CREATE TABLE IF NOT EXISTS products (
    batch_id VARCHAR(50) PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL,
    commodity VARCHAR(100),
    farmer_name VARCHAR(255),
    quantity VARCHAR(100),
    harvest_date DATE,
    location TEXT,
    status VARCHAR(50) DEFAULT 'Pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tracking_events (
    id BIGSERIAL PRIMARY KEY,
    batch_id VARCHAR(50) NOT NULL REFERENCES products(batch_id) ON DELETE CASCADE,
    stage VARCHAR(100) NOT NULL,
    status VARCHAR(50),
    location TEXT,
    event_date DATE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verification_history (
    id BIGSERIAL PRIMARY KEY,
    batch_id VARCHAR(50) NOT NULL REFERENCES products(batch_id) ON DELETE CASCADE,
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    decision VARCHAR(50),
    verified_by VARCHAR(255),
    verified_at TIMESTAMPTZ DEFAULT NOW(),
    note TEXT,
    audit_id VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_tracking_batch
ON tracking_events(batch_id);

CREATE INDEX IF NOT EXISTS idx_verification_batch
ON verification_history(batch_id);
