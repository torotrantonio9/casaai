-- ============================================
-- CasaAI - RLS Complete per tutti i ruoli
-- ============================================

-- Tabella multi-agente (se non esiste già)
CREATE TABLE IF NOT EXISTS agency_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID REFERENCES agencies(id),
  profile_id UUID REFERENCES profiles(id),
  role TEXT CHECK (role IN ('admin','agent','assistant')) DEFAULT 'agent',
  invited_by UUID REFERENCES profiles(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(agency_id, profile_id)
);

ALTER TABLE agency_members ENABLE ROW LEVEL SECURITY;

-- Colonne sponsorizzazione
ALTER TABLE listings ADD COLUMN IF NOT EXISTS is_sponsored BOOLEAN DEFAULT FALSE;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS sponsored_until TIMESTAMPTZ;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS sponsored_position INT;

-- Tabella consent log GDPR
CREATE TABLE IF NOT EXISTS consent_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id),
  category TEXT NOT NULL,
  granted BOOLEAN NOT NULL,
  ip_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE consent_logs ENABLE ROW LEVEL SECURITY;

-- Funzione helper: controlla se l'utente è admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Funzione helper: controlla se l'utente appartiene a un'agenzia
CREATE OR REPLACE FUNCTION user_agency_ids()
RETURNS SETOF UUID AS $$
  SELECT agency_id FROM agency_members WHERE profile_id = auth.uid()
  UNION
  SELECT id FROM agencies WHERE owner_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================
-- PROFILES
-- ============================================
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (id = auth.uid() OR is_admin());

CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "profiles_insert" ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- ============================================
-- AGENCIES
-- ============================================
CREATE POLICY "agencies_select_public" ON agencies FOR SELECT
  USING (true); -- Agenzie visibili a tutti (pagina directory)

CREATE POLICY "agencies_update_owner" ON agencies FOR UPDATE
  USING (owner_id = auth.uid() OR is_admin());

CREATE POLICY "agencies_insert" ON agencies FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- ============================================
-- LISTINGS — policy granulari
-- ============================================
DROP POLICY IF EXISTS "Anyone can view active listings" ON listings;
DROP POLICY IF EXISTS "Agents can manage own listings" ON listings;

-- Chiunque vede annunci attivi
CREATE POLICY "listings_select_active" ON listings FOR SELECT
  USING (status = 'active' OR agent_id = auth.uid() OR is_admin());

-- Agenti inseriscono i propri annunci
CREATE POLICY "listings_insert_agent" ON listings FOR INSERT
  WITH CHECK (agent_id = auth.uid());

-- Agenti aggiornano i propri annunci, admin tutti
CREATE POLICY "listings_update_own" ON listings FOR UPDATE
  USING (agent_id = auth.uid() OR is_admin());

-- Agenti cancellano i propri annunci
CREATE POLICY "listings_delete_own" ON listings FOR DELETE
  USING (agent_id = auth.uid() OR is_admin());

-- ============================================
-- LEADS
-- ============================================
DROP POLICY IF EXISTS "Agencies view own leads" ON leads;

-- Buyer vede i propri lead inviati
CREATE POLICY "leads_select_buyer" ON leads FOR SELECT
  USING (buyer_id = auth.uid());

-- Agenzie vedono i lead dei propri annunci
CREATE POLICY "leads_select_agency" ON leads FOR SELECT
  USING (agency_id IN (SELECT user_agency_ids()));

-- Admin vede tutto
CREATE POLICY "leads_select_admin" ON leads FOR SELECT
  USING (is_admin());

-- Chiunque può creare un lead (form contatto pubblico)
CREATE POLICY "leads_insert_public" ON leads FOR INSERT
  WITH CHECK (true);

-- Agenzie aggiornano status dei propri lead
CREATE POLICY "leads_update_agency" ON leads FOR UPDATE
  USING (agency_id IN (SELECT user_agency_ids()) OR is_admin());

-- ============================================
-- CHAT SESSIONS
-- ============================================
DROP POLICY IF EXISTS "Users view own chat sessions" ON chat_sessions;

CREATE POLICY "chat_sessions_select" ON chat_sessions FOR SELECT
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "chat_sessions_insert" ON chat_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "chat_sessions_update" ON chat_sessions FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================
-- SAVED SEARCHES
-- ============================================
DROP POLICY IF EXISTS "Users manage own saved searches" ON saved_searches;

CREATE POLICY "saved_searches_all" ON saved_searches FOR ALL
  USING (user_id = auth.uid());

-- ============================================
-- SAVED LISTINGS
-- ============================================
DROP POLICY IF EXISTS "Users manage own saved listings" ON saved_listings;

CREATE POLICY "saved_listings_all" ON saved_listings FOR ALL
  USING (user_id = auth.uid());

-- ============================================
-- LISTING VIEWS — inserimento pubblico, lettura da agente/admin
-- ============================================
CREATE POLICY "listing_views_insert" ON listing_views FOR INSERT
  WITH CHECK (true);

CREATE POLICY "listing_views_select" ON listing_views FOR SELECT
  USING (
    listing_id IN (SELECT id FROM listings WHERE agent_id = auth.uid())
    OR is_admin()
  );

-- ============================================
-- CHAT CONTEXTS — inserimento pubblico
-- ============================================
CREATE POLICY "chat_contexts_insert" ON chat_contexts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "chat_contexts_select" ON chat_contexts FOR SELECT
  USING (true); -- Needed by API routes via service role

-- ============================================
-- IMPORT JOBS — solo agenzia proprietaria
-- ============================================
CREATE POLICY "import_jobs_select" ON import_jobs FOR SELECT
  USING (agency_id IN (SELECT user_agency_ids()) OR is_admin());

CREATE POLICY "import_jobs_insert" ON import_jobs FOR INSERT
  WITH CHECK (agency_id IN (SELECT user_agency_ids()));

CREATE POLICY "import_jobs_update" ON import_jobs FOR UPDATE
  USING (agency_id IN (SELECT user_agency_ids()) OR is_admin());

-- ============================================
-- IMPORTED LISTINGS MAP
-- ============================================
CREATE POLICY "imported_map_select" ON imported_listings_map FOR SELECT
  USING (
    listing_id IN (SELECT id FROM listings WHERE agent_id = auth.uid())
    OR is_admin()
  );

-- ============================================
-- AGENCY MEMBERS
-- ============================================
CREATE POLICY "agency_members_select" ON agency_members FOR SELECT
  USING (agency_id IN (SELECT user_agency_ids()) OR is_admin());

CREATE POLICY "agency_members_insert" ON agency_members FOR INSERT
  WITH CHECK (agency_id IN (SELECT id FROM agencies WHERE owner_id = auth.uid()));

CREATE POLICY "agency_members_delete" ON agency_members FOR DELETE
  USING (agency_id IN (SELECT id FROM agencies WHERE owner_id = auth.uid()) OR is_admin());

-- ============================================
-- CONSENT LOGS (GDPR)
-- ============================================
CREATE POLICY "consent_logs_own" ON consent_logs FOR ALL
  USING (profile_id = auth.uid());

-- ============================================
-- Funzione per incrementare views/leads count
-- ============================================
CREATE OR REPLACE FUNCTION increment_leads_count(listing_id_param UUID)
RETURNS VOID AS $$
  UPDATE listings SET leads_count = leads_count + 1 WHERE id = listing_id_param;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_views_count(listing_id_param UUID)
RETURNS VOID AS $$
  UPDATE listings SET views_count = views_count + 1 WHERE id = listing_id_param;
$$ LANGUAGE sql SECURITY DEFINER;
