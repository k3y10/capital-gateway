CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('admin', 'partner', 'founder', 'viewer')),
  wallet_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  name text NOT NULL,
  organization text NOT NULL,
  email text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('LP', 'GP', 'advisor', 'builder', 'founder', 'strategic_partner')),
  access_level text NOT NULL CHECK (access_level IN ('standard', 'strategic', 'admin-review')),
  portal_token_hash text,
  joined_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS referral_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  url text NOT NULL,
  visits integer NOT NULL DEFAULT 0 CHECK (visits >= 0),
  wallet_connects integer NOT NULL DEFAULT 0 CHECK (wallet_connects >= 0),
  submitted_interests integer NOT NULL DEFAULT 0 CHECK (submitted_interests >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  short_description text NOT NULL,
  category text NOT NULL,
  stage text NOT NULL,
  funding_status text NOT NULL,
  preferred_partner_type text NOT NULL,
  dataroom_availability text NOT NULL CHECK (dataroom_availability IN ('available', 'restricted', 'coming_soon')),
  pool text NOT NULL,
  priority text NOT NULL CHECK (priority IN ('active', 'watchlist', 'future')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS capital_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  organization text NOT NULL,
  wallet_address text NOT NULL DEFAULT '',
  connected_wallet_provider text NOT NULL CHECK (connected_wallet_provider IN ('Coinbase Wallet', 'MetaMask', 'Injected Wallet', 'Not connected')),
  referral_code text NOT NULL REFERENCES referral_links(code) ON UPDATE CASCADE,
  project_slug text NOT NULL REFERENCES projects(slug) ON UPDATE CASCADE,
  pool_of_interest text NOT NULL,
  intended_amount_usdc numeric(20, 2) NOT NULL CHECK (intended_amount_usdc >= 0),
  role_type text NOT NULL CHECK (role_type IN ('LP', 'GP', 'advisor', 'builder', 'founder', 'strategic_partner')),
  accredited_self_attestation boolean NOT NULL DEFAULT false,
  jurisdiction text NOT NULL,
  notes text NOT NULL DEFAULT '',
  status text NOT NULL CHECK (status IN ('New', 'Wallet Connected', 'Interest Submitted', 'Pending Review', 'Needs Documents', 'Dataroom Requested', 'Dataroom Granted', 'Accredited Verified', 'Approved', 'Rejected', 'Soft Committed', 'Funded', 'Closed')),
  confirmation_accepted boolean NOT NULL DEFAULT false,
  acknowledgements jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS capital_interests
  ADD COLUMN IF NOT EXISTS acknowledgements jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS wallet_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code text NOT NULL REFERENCES referral_links(code) ON UPDATE CASCADE,
  wallet_address text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('Coinbase Wallet', 'MetaMask', 'Injected Wallet')),
  project_slug text REFERENCES projects(slug) ON UPDATE CASCADE,
  connected_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dataroom_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_slug text NOT NULL REFERENCES projects(slug) ON UPDATE CASCADE,
  title text NOT NULL,
  category text NOT NULL CHECK (category IN ('Overview', 'Pitch Deck', 'Financial Model', 'Legal / Formation', 'USDC Model', 'Technical Architecture', 'Roadmap', 'Diligence Notes', 'Partner Updates', 'Investment Memo', 'Risk Notes')),
  storage_uri text,
  upload_date date NOT NULL DEFAULT CURRENT_DATE,
  version text NOT NULL,
  visibility text NOT NULL CHECK (visibility IN ('partner', 'admin', 'founder', 'viewer')),
  status text NOT NULL CHECK (status IN ('ready', 'coming_soon')),
  views integer NOT NULL DEFAULT 0 CHECK (views >= 0),
  downloads integer NOT NULL DEFAULT 0 CHECK (downloads >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dataroom_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  project_slug text NOT NULL REFERENCES projects(slug) ON UPDATE CASCADE,
  level text NOT NULL CHECK (level IN ('locked', 'requested', 'granted', 'revoked')),
  granted_by text,
  granted_at timestamptz,
  requested_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partner_id, project_slug)
);

CREATE TABLE IF NOT EXISTS dataroom_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES dataroom_documents(id) ON DELETE SET NULL,
  project_slug text NOT NULL REFERENCES projects(slug) ON UPDATE CASCADE,
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('view', 'download', 'request_access')),
  timestamp timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interest_id uuid NOT NULL REFERENCES capital_interests(id) ON DELETE CASCADE,
  from_status text NOT NULL,
  to_status text NOT NULL,
  actor text NOT NULL CHECK (actor IN ('admin', 'partner', 'system')),
  timestamp timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interest_id uuid NOT NULL REFERENCES capital_interests(id) ON DELETE CASCADE,
  author text NOT NULL,
  body text NOT NULL,
  private boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor text NOT NULL,
  action text NOT NULL,
  project_slug text REFERENCES projects(slug) ON UPDATE CASCADE,
  referral_code text REFERENCES referral_links(code) ON UPDATE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compliance_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interest_id uuid NOT NULL REFERENCES capital_interests(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('not_started', 'pending', 'needs_documents', 'verified', 'rejected', 'expired')),
  provider text,
  external_reference text,
  reviewed_by text,
  reviewed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (interest_id)
);

CREATE TABLE IF NOT EXISTS approved_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  partner_id uuid REFERENCES partners(id) ON DELETE SET NULL,
  interest_id uuid REFERENCES capital_interests(id) ON DELETE SET NULL,
  chain_id integer NOT NULL DEFAULT 8453,
  approved_by text NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_approved_wallets_wallet_chain_unique
  ON approved_wallets (lower(wallet_address), chain_id);

CREATE TABLE IF NOT EXISTS settlement_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interest_id uuid NOT NULL REFERENCES capital_interests(id) ON DELETE RESTRICT,
  wallet_address text NOT NULL,
  chain_id integer NOT NULL DEFAULT 8453,
  usdc_amount numeric(20, 2) NOT NULL CHECK (usdc_amount > 0),
  status text NOT NULL CHECK (status IN ('draft', 'approved', 'pending_signature', 'submitted', 'confirmed', 'cancelled', 'expired')),
  tx_hash text,
  created_by text NOT NULL,
  approved_by text,
  approved_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS partners_set_updated_at ON partners;
CREATE TRIGGER partners_set_updated_at BEFORE UPDATE ON partners FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS projects_set_updated_at ON projects;
CREATE TRIGGER projects_set_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS dataroom_documents_set_updated_at ON dataroom_documents;
CREATE TRIGGER dataroom_documents_set_updated_at BEFORE UPDATE ON dataroom_documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS dataroom_access_set_updated_at ON dataroom_access;
CREATE TRIGGER dataroom_access_set_updated_at BEFORE UPDATE ON dataroom_access FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS compliance_reviews_set_updated_at ON compliance_reviews;
CREATE TRIGGER compliance_reviews_set_updated_at BEFORE UPDATE ON compliance_reviews FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS settlement_intents_set_updated_at ON settlement_intents;
CREATE TRIGGER settlement_intents_set_updated_at BEFORE UPDATE ON settlement_intents FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_referral_links_partner_id ON referral_links(partner_id);
CREATE INDEX IF NOT EXISTS idx_capital_interests_referral_code ON capital_interests(referral_code);
CREATE INDEX IF NOT EXISTS idx_capital_interests_project_slug ON capital_interests(project_slug);
CREATE INDEX IF NOT EXISTS idx_capital_interests_status ON capital_interests(status);
CREATE INDEX IF NOT EXISTS idx_capital_interests_amount ON capital_interests(intended_amount_usdc);
CREATE INDEX IF NOT EXISTS idx_wallet_connections_referral_code ON wallet_connections(referral_code);
CREATE INDEX IF NOT EXISTS idx_dataroom_documents_project_slug ON dataroom_documents(project_slug);
CREATE INDEX IF NOT EXISTS idx_dataroom_access_partner_project ON dataroom_access(partner_id, project_slug);
CREATE INDEX IF NOT EXISTS idx_dataroom_events_partner_id ON dataroom_events(partner_id);
CREATE INDEX IF NOT EXISTS idx_status_events_interest_id ON status_events(interest_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_referral_code ON activity_logs(referral_code);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_reviews_status ON compliance_reviews(status);
CREATE INDEX IF NOT EXISTS idx_approved_wallets_partner_id ON approved_wallets(partner_id);
CREATE INDEX IF NOT EXISTS idx_approved_wallets_interest_id ON approved_wallets(interest_id);
CREATE INDEX IF NOT EXISTS idx_settlement_intents_interest_id ON settlement_intents(interest_id);
CREATE INDEX IF NOT EXISTS idx_settlement_intents_status ON settlement_intents(status);
CREATE INDEX IF NOT EXISTS idx_open_capital_interests_review
  ON capital_interests(submitted_at DESC)
  WHERE status IN ('New', 'Wallet Connected', 'Interest Submitted', 'Pending Review', 'Needs Documents', 'Dataroom Requested');
