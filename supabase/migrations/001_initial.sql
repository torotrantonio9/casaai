-- ============================================
-- CasaAI - Schema iniziale
-- ============================================

-- Abilita estensioni necessarie
CREATE EXTENSION IF NOT EXISTS "pgvector";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Profili utente (estende auth.users di Supabase)
-- ============================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT CHECK (role IN ('buyer', 'agent', 'admin')) DEFAULT 'buyer',
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Agenzie immobiliari
-- ============================================
CREATE TABLE agencies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES profiles(id),
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  address TEXT,
  city TEXT,
  province TEXT,
  website TEXT,
  phone TEXT,
  email TEXT,
  vat_number TEXT,
  subscription_tier TEXT CHECK (subscription_tier IN ('free', 'starter', 'pro', 'enterprise')) DEFAULT 'free',
  subscription_expires_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  listings_count INT DEFAULT 0,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Annunci immobiliari
-- ============================================
CREATE TABLE listings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID REFERENCES agencies(id),
  agent_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  ai_description TEXT,
  type TEXT CHECK (type IN ('sale', 'rent')) NOT NULL,
  property_type TEXT CHECK (property_type IN ('apartment', 'house', 'villa', 'commercial', 'land', 'garage', 'other')) NOT NULL,
  price NUMERIC NOT NULL,
  price_period TEXT,
  surface_sqm NUMERIC,
  rooms INT,
  bathrooms INT,
  floor INT,
  total_floors INT,
  year_built INT,
  energy_class TEXT CHECK (energy_class IN ('A4','A3','A2','A1','B','C','D','E','F','G')),
  heating_type TEXT,
  has_parking BOOLEAN DEFAULT FALSE,
  has_garden BOOLEAN DEFAULT FALSE,
  has_terrace BOOLEAN DEFAULT FALSE,
  has_elevator BOOLEAN DEFAULT FALSE,
  has_cellar BOOLEAN DEFAULT FALSE,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  province TEXT NOT NULL,
  zip_code TEXT,
  lat NUMERIC,
  lng NUMERIC,
  neighborhood TEXT,
  photos TEXT[] DEFAULT '{}',
  virtual_tour_url TEXT,
  status TEXT CHECK (status IN ('draft', 'active', 'sold', 'rented', 'archived')) DEFAULT 'draft',
  is_featured BOOLEAN DEFAULT FALSE,
  views_count INT DEFAULT 0,
  leads_count INT DEFAULT 0,
  ai_valuation NUMERIC,
  ai_valuation_confidence TEXT,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Sessioni chat AI per ricerca casa
-- ============================================
CREATE TABLE chat_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  session_token TEXT UNIQUE,
  messages JSONB DEFAULT '[]',
  filters_extracted JSONB DEFAULT '{}',
  recommended_listing_ids UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Lead generati
-- ============================================
CREATE TABLE leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID REFERENCES listings(id),
  agency_id UUID REFERENCES agencies(id),
  buyer_id UUID REFERENCES profiles(id),
  buyer_name TEXT,
  buyer_email TEXT,
  buyer_phone TEXT,
  message TEXT,
  ai_score INT CHECK (ai_score BETWEEN 0 AND 100),
  ai_score_reason TEXT,
  status TEXT CHECK (status IN ('new', 'contacted', 'visit_scheduled', 'negotiating', 'closed_won', 'closed_lost')) DEFAULT 'new',
  ai_reply_used BOOLEAN DEFAULT FALSE,
  source TEXT CHECK (source IN ('chat', 'contact_form', 'phone', 'visit')) DEFAULT 'contact_form',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Preferenze e ricerche salvate
-- ============================================
CREATE TABLE saved_searches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  name TEXT,
  natural_query TEXT,
  filters JSONB DEFAULT '{}',
  notify_email BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Annunci salvati (preferiti)
-- ============================================
CREATE TABLE saved_listings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  listing_id UUID REFERENCES listings(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, listing_id)
);

-- ============================================
-- Analytics visite annunci
-- ============================================
CREATE TABLE listing_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID REFERENCES listings(id),
  user_id UUID REFERENCES profiles(id),
  session_id TEXT,
  ip_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Contesto pre-chat (onboarding wizard)
-- ============================================
CREATE TABLE chat_contexts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  intent TEXT CHECK (intent IN ('sale','rent')) NOT NULL,
  budget_min NUMERIC,
  budget_max NUMERIC NOT NULL,
  location_lat NUMERIC,
  location_lng NUMERIC,
  location_label TEXT,
  max_distance_km INT,
  must_have TEXT[] DEFAULT '{}',
  nice_to_have TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Job di importazione annunci da portali esterni
-- ============================================
CREATE TABLE import_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID REFERENCES agencies(id),
  source TEXT CHECK (source IN ('idealista','immobiliare_it','csv','url_manuale')) NOT NULL,
  source_url TEXT,
  source_agency_id TEXT,
  status TEXT CHECK (status IN ('pending','running','completed','failed','partial')) DEFAULT 'pending',
  total_found INT DEFAULT 0,
  imported INT DEFAULT 0,
  updated INT DEFAULT 0,
  skipped INT DEFAULT 0,
  errors JSONB DEFAULT '[]',
  schedule TEXT,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Mapping listing importati (evita duplicati)
-- ============================================
CREATE TABLE imported_listings_map (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  source_listing_id TEXT NOT NULL,
  source_url TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source, source_listing_id)
);

-- ============================================
-- Indici
-- ============================================
CREATE INDEX ON listings USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX ON listings (city, status, type);
CREATE INDEX ON listings (agency_id, status);
CREATE INDEX ON leads (agency_id, status, created_at DESC);

-- ============================================
-- RLS (Row Level Security)
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE imported_listings_map ENABLE ROW LEVEL SECURITY;

-- Profiles: utenti leggono il proprio profilo, admin legge tutti
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Listings: tutti leggono annunci attivi, agenti gestiscono i propri
CREATE POLICY "Anyone can view active listings" ON listings
  FOR SELECT USING (status = 'active');
CREATE POLICY "Agents can manage own listings" ON listings
  FOR ALL USING (agent_id = auth.uid());

-- Saved listings: utenti gestiscono i propri preferiti
CREATE POLICY "Users manage own saved listings" ON saved_listings
  FOR ALL USING (user_id = auth.uid());

-- Leads: agenzie vedono i propri lead
CREATE POLICY "Agencies view own leads" ON leads
  FOR SELECT USING (agency_id IN (
    SELECT id FROM agencies WHERE owner_id = auth.uid()
  ));

-- Chat sessions: utenti vedono le proprie sessioni
CREATE POLICY "Users view own chat sessions" ON chat_sessions
  FOR ALL USING (user_id = auth.uid());

-- Saved searches: utenti gestiscono le proprie ricerche
CREATE POLICY "Users manage own saved searches" ON saved_searches
  FOR ALL USING (user_id = auth.uid());

-- Trigger per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER listings_updated_at
  BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER chat_sessions_updated_at
  BEFORE UPDATE ON chat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER import_jobs_updated_at
  BEFORE UPDATE ON import_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger per creare profilo alla registrazione
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
