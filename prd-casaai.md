# PRD — CasaAI: Marketplace Immobiliare con AI
**Versione:** 1.2 | **Data:** Marzo 2026 | **Destinato a:** Claude Code + Ralph Loop
**Changelog v1.1:** Onboarding pre-chat (budget, distanza, esigenze), import automatico da portali
**Changelog v1.2:** Roadmap completa MVP→V2→V3 con 22 feature aggiuntive su 4 aree (buyer, agenzie, monetizzazione, fiducia)

---

## 1. VISIONE DEL PRODOTTO

CasaAI è un marketplace immobiliare italiano che integra intelligenza artificiale conversazionale per trasformare il modo in cui le persone cercano casa e le agenzie gestiscono i propri annunci.

**Differenziatore chiave:** invece di usare filtri statici (zona, prezzo, mq), il buyer descrive la propria vita ideale in linguaggio naturale ("voglio stare a 10 minuti dal mare, con un giardino per il cane, vicino a buone scuole") e l'AI trova le proprietà più compatibili.

**Target utenti:**
- **Buyer/Locatari:** cercano casa tramite AI conversazionale
- **Agenzie immobiliari:** gestiscono annunci, lead, analytics tramite dashboard SaaS
- **Privati:** pubblicano annunci con supporto AI per descrizioni e valutazione

---

## 2. STACK TECNOLOGICO

### Frontend
- **Next.js 15** (App Router, TypeScript)
- **Tailwind CSS** + **shadcn/ui** per i componenti
- **Zustand** per state management
- **React Hook Form** + **Zod** per validazione form
- **Mapbox GL JS** per mappe interattive
- **Framer Motion** per animazioni

### Backend & Database
- **Supabase** come backend principale:
  - PostgreSQL con estensione **pgvector** (ricerca semantica embeddings)
  - Auth integrato (email/password + Google OAuth)
  - Storage per foto immobili
  - Realtime subscriptions per notifiche
- **Supabase Edge Functions** per logica server-side

### AI
- **Claude API** (claude-sonnet-4-6) per:
  - Chatbot conversazionale ricerca casa
  - Generazione descrizioni annunci
  - Analisi e scoring lead
  - Valutazione AI immobili
- **OpenAI text-embedding-3-small** (via API) per embeddings vettoriali degli annunci

### Pagamenti & Infrastruttura
- **Stripe** per abbonamenti agenzie e listing premium
- **Vercel** per deploy frontend
- **Resend** per email transazionali
- **Uploadthing** per upload foto lato client

### Import Annunci da Portali Esterni
- **Playwright** (via Supabase Edge Function o servizio separato) per scraping headless
- **Cheerio** per parsing HTML statico
- **Bull/BullMQ** su Redis per job queue asincroni di importazione
- **Upstash Redis** (serverless Redis compatibile con Vercel/Edge)
- **node-cron** per import schedulati automatici

---

## 3. ARCHITETTURA DATABASE (Supabase/PostgreSQL)

### Tabelle principali

```sql
-- Profili utente (estende auth.users di Supabase)
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

-- Agenzie immobiliari
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

-- Annunci immobiliari
CREATE TABLE listings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID REFERENCES agencies(id),
  agent_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  ai_description TEXT, -- generata dall'AI
  type TEXT CHECK (type IN ('sale', 'rent')) NOT NULL,
  property_type TEXT CHECK (property_type IN ('apartment', 'house', 'villa', 'commercial', 'land', 'garage', 'other')) NOT NULL,
  price NUMERIC NOT NULL,
  price_period TEXT, -- 'month' per affitti
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
  ai_valuation NUMERIC, -- stima AI del valore
  ai_valuation_confidence TEXT, -- 'high', 'medium', 'low'
  embedding VECTOR(1536), -- per ricerca semantica pgvector
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessioni chat AI per ricerca casa
CREATE TABLE chat_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  session_token TEXT UNIQUE, -- per utenti non autenticati
  messages JSONB DEFAULT '[]', -- array di {role, content, timestamp}
  filters_extracted JSONB DEFAULT '{}', -- parametri estratti dall'AI
  recommended_listing_ids UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lead generati
CREATE TABLE leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID REFERENCES listings(id),
  agency_id UUID REFERENCES agencies(id),
  buyer_id UUID REFERENCES profiles(id),
  buyer_name TEXT,
  buyer_email TEXT,
  buyer_phone TEXT,
  message TEXT,
  ai_score INT CHECK (ai_score BETWEEN 0 AND 100), -- lead scoring AI
  ai_score_reason TEXT,
  status TEXT CHECK (status IN ('new', 'contacted', 'visit_scheduled', 'negotiating', 'closed_won', 'closed_lost')) DEFAULT 'new',
  ai_reply_used BOOLEAN DEFAULT FALSE,   -- bozza AI usata per risposta
  source TEXT CHECK (source IN ('chat', 'contact_form', 'phone', 'visit')) DEFAULT 'contact_form',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Preferenze e ricerche salvate
CREATE TABLE saved_searches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  name TEXT,
  natural_query TEXT, -- query in linguaggio naturale
  filters JSONB DEFAULT '{}',
  notify_email BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Annunci salvati (preferiti)
CREATE TABLE saved_listings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  listing_id UUID REFERENCES listings(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, listing_id)
);

-- Analytics visite annunci
CREATE TABLE listing_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID REFERENCES listings(id),
  user_id UUID REFERENCES profiles(id),
  session_id TEXT,
  ip_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici necessari
CREATE INDEX ON listings USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX ON listings (city, status, type);
CREATE INDEX ON listings (agency_id, status);
CREATE INDEX ON leads (agency_id, status, created_at DESC);

-- Contesto pre-chat (onboarding wizard)
-- Salvato prima che l'utente inizi a scrivere al chatbot
CREATE TABLE chat_contexts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,                     -- corrisponde a chat_sessions.session_token
  intent TEXT CHECK (intent IN ('sale','rent')) NOT NULL,
  budget_min NUMERIC,
  budget_max NUMERIC NOT NULL,
  location_lat NUMERIC,                         -- punto di riferimento scelto dall'utente
  location_lng NUMERIC,
  location_label TEXT,                          -- es. "Via Roma 1, Napoli"
  max_distance_km INT,                          -- raggio massimo dal punto
  must_have TEXT[] DEFAULT '{}',               -- es. ['has_elevator','has_parking','has_garden']
  nice_to_have TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job di importazione annunci da portali esterni
CREATE TABLE import_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID REFERENCES agencies(id),
  source TEXT CHECK (source IN ('idealista','immobiliare_it','csv','url_manuale')) NOT NULL,
  source_url TEXT,                              -- URL profilo agenzia sul portale
  source_agency_id TEXT,                        -- ID agenzia sul portale esterno
  status TEXT CHECK (status IN ('pending','running','completed','failed','partial')) DEFAULT 'pending',
  total_found INT DEFAULT 0,
  imported INT DEFAULT 0,
  updated INT DEFAULT 0,
  skipped INT DEFAULT 0,
  errors JSONB DEFAULT '[]',                    -- array di {url, reason}
  schedule TEXT,                                -- cron expression es. '0 6 * * *' (ogni giorno alle 6)
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mapping listing importati (evita duplicati)
CREATE TABLE imported_listings_map (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  source_listing_id TEXT NOT NULL,              -- ID sul portale originale
  source_url TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source, source_listing_id)
);
```

---

## 4. STRUTTURA DEL PROGETTO

```
casaai/
├── app/
│   ├── (public)/
│   │   ├── page.tsx                    # Homepage con hero + chatbot
│   │   ├── cerca/page.tsx              # Pagina ricerca + mappa
│   │   ├── annunci/
│   │   │   ├── page.tsx                # Listing grid con filtri
│   │   │   └── [id]/page.tsx           # Dettaglio annuncio
│   │   ├── agenzie/
│   │   │   ├── page.tsx                # Directory agenzie
│   │   │   └── [id]/page.tsx           # Profilo agenzia
│   │   └── valutazione/page.tsx        # Tool valutazione AI gratuita
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── registrati/page.tsx
│   │   └── layout.tsx
│   ├── dashboard/
│   │   ├── layout.tsx                  # Layout dashboard agenzie
│   │   ├── page.tsx                    # Overview con metriche
│   │   ├── annunci/
│   │   │   ├── page.tsx                # Lista annunci agenzia
│   │   │   ├── nuovo/page.tsx          # Crea annuncio + AI
│   │   │   └── [id]/modifica/page.tsx  # Modifica annuncio
│   │   ├── lead/
│   │   │   ├── page.tsx                # CRM lead con AI scoring
│   │   │   └── [id]/page.tsx           # Dettaglio lead
│   │   ├── analytics/page.tsx          # Statistiche e report AI
│   │   ├── importa/
│   │   │   ├── page.tsx                # ← NUOVO: hub import annunci
│   │   │   └── [job_id]/page.tsx       # ← NUOVO: dettaglio job import con log
│   │   ├── abbonamento/page.tsx        # Gestione piano + Stripe
│   │   └── impostazioni/page.tsx       # Profilo agenzia
│   └── api/
│       ├── chat/route.ts               # Streaming chat AI
│       ├── chat/context/route.ts       # ← NUOVO: salva contesto pre-chat
│       ├── listings/
│       │   ├── route.ts                # CRUD annunci
│       │   ├── search/route.ts         # Ricerca semantica
│       │   └── [id]/route.ts
│       ├── ai/
│       │   ├── valuation/route.ts      # Valutazione AI immobile
│       │   ├── generate-description/route.ts
│       │   └── score-lead/route.ts
│       ├── import/
│       │   ├── route.ts                # ← NUOVO: crea job import
│       │   ├── [job_id]/route.ts       # ← NUOVO: status + log job
│       │   ├── scrape/idealista/route.ts    # ← NUOVO: scraper Idealista
│       │   └── scrape/immobiliare/route.ts  # ← NUOVO: scraper Immobiliare.it
│       ├── leads/route.ts
│       ├── agencies/route.ts
│       └── webhooks/stripe/route.ts
├── components/
│   ├── ai/
│   │   ├── ChatWidget.tsx              # Widget chat flottante
│   │   ├── ChatOnboarding.tsx          # ← NUOVO: wizard pre-chat (budget, distanza, esigenze)
│   │   ├── ChatOnboardingStep.tsx      # ← NUOVO: singolo step del wizard
│   │   ├── ChatMessages.tsx
│   │   ├── ValuationForm.tsx
│   │   └── DescriptionGenerator.tsx
│   ├── listings/
│   │   ├── ListingCard.tsx
│   │   ├── ListingGrid.tsx
│   │   ├── ListingMap.tsx
│   │   ├── ListingDetail.tsx
│   │   ├── ListingForm.tsx             # Form creazione/modifica
│   │   └── PhotoUploader.tsx
│   ├── dashboard/
│   │   ├── MetricCard.tsx
│   │   ├── LeadCard.tsx
│   │   ├── LeadScoreBadge.tsx
│   │   └── AnalyticsChart.tsx
│   ├── search/
│   │   ├── SearchBar.tsx
│   │   ├── FilterPanel.tsx
│   │   └── SearchResults.tsx
│   └── ui/                             # shadcn/ui components
├── lib/
│   ├── supabase/
│   │   ├── client.ts                   # Browser client
│   │   ├── server.ts                   # Server client
│   │   └── admin.ts                    # Admin client (service role)
│   ├── ai/
│   │   ├── claude.ts                   # Claude API wrapper
│   │   ├── embeddings.ts               # OpenAI embeddings
│   │   ├── prompts.ts                  # Tutti i system prompt
│   │   └── search.ts                   # Ricerca semantica pgvector
│   ├── stripe.ts
│   └── utils.ts
├── types/
│   └── database.ts                     # Tipi generati da Supabase
└── middleware.ts                        # Auth middleware
```

---

## 5. FEATURES DETTAGLIATE

### 5.0 — Onboarding Pre-Chat (Wizard di Contestualizzazione)

**Descrizione:** Prima che l'utente scriva al chatbot, un wizard a 4 step raccoglie il contesto base. Questo rende il chatbot immediatamente utile senza che l'utente debba spiegare tutto via testo. Il wizard è leggero, visivo, e si completa in ~30 secondi.

**Flusso UX — 4 step sequenziali:**

```
Step 1: Intenzione
  ┌─────────────────────────────────────┐
  │  Stai cercando per...               │
  │  [🏠 Acquisto]  [🔑 Affitto]       │
  └─────────────────────────────────────┘

Step 2: Budget
  ┌─────────────────────────────────────┐
  │  Qual è il tuo budget massimo?      │
  │  [────●──────────────] €320.000     │
  │  Min: €50k      Max: €1.5M         │
  │  (Per affitti: €500 - €5.000/mese)  │
  └─────────────────────────────────────┘

Step 3: Punto di riferimento + distanza
  ┌─────────────────────────────────────┐
  │  Da dove vuoi partire?              │
  │  [📍 Inserisci indirizzo o zona ]   │
  │  → Autocomplete Google Places       │
  │                                     │
  │  Distanza massima:                  │
  │  [5km] [10km] [20km] [30km] [Oltre] │
  └─────────────────────────────────────┘

Step 4: Esigenze imprescindibili
  ┌─────────────────────────────────────┐
  │  Cosa non può mancare?              │
  │  (Seleziona tutto ciò che vuoi)     │
  │                                     │
  │  [🛗 Ascensore]  [🚗 Posto auto]   │
  │  [🌿 Giardino]   [🏖️ Terrazzo]    │
  │  [🐕 Pet-friendly][♿ Accessibile]  │
  │  [🔇 Piano terra] [📦 Cantina]     │
  │  [⚡ Classe A/B]  [🏊 Piscina]     │
  │                                     │
  │  Esigenze speciali (opzionale):     │
  │  [Testo libero: "vicino ospedale..."]│
  └─────────────────────────────────────┘
  → [Avvia la ricerca →]
```

**Componente `ChatOnboarding.tsx`:**

```typescript
// Stato del wizard
interface ChatContext {
  intent: 'sale' | 'rent'
  budget_max: number
  budget_min?: number
  location: {
    lat: number
    lng: number
    label: string        // indirizzo leggibile
  } | null
  max_distance_km: 5 | 10 | 20 | 30 | null
  must_have: FeatureKey[]
  nice_to_have: FeatureKey[]
  custom_note?: string  // testo libero esigenze speciali
}

type FeatureKey =
  | 'has_elevator'
  | 'has_parking'
  | 'has_garden'
  | 'has_terrace'
  | 'pet_friendly'
  | 'accessible'
  | 'ground_floor'
  | 'has_cellar'
  | 'energy_class_ab'
  | 'has_pool'
```

**Flusso tecnico al completamento wizard:**
1. `POST /api/chat/context` → salva in `chat_contexts` e ritorna `session_id`
2. Il contesto viene passato come **system message iniziale** a Claude, PRIMA del primo messaggio utente:
```
[CONTEXT PREIMPOSTATO - non mostrare all'utente]
L'utente ha già configurato questi parametri:
- Intenzione: Acquisto
- Budget massimo: €320.000
- Zona di riferimento: Piazza Garibaldi, Napoli (lat: 40.853, lng: 14.272)
- Distanza massima: 10 km
- Imprescindibili: Ascensore, Posto auto
- Note aggiuntive: "vicino a buone scuole elementari"

Usa questi parametri come filtri base in ogni ricerca.
Non chiedere nuovamente queste informazioni. Inizia subito con una ricerca contestualizzata
e chiedi solo dettagli aggiuntivi se necessario (es. numero di locali, piano preferito).
```
3. ChatWidget mostra direttamente un messaggio di benvenuto personalizzato:
   *"Ciao! Ho già impostato la tua ricerca: acquisto fino a €320.000 nel raggio di 10km da Piazza Garibaldi, con ascensore e posto auto. Vuoi dirmi altro o vuoi che ti mostri subito le prime proposte?"*

**Barra di progresso:** indicatore visivo 1/4, 2/4, 3/4, 4/4 in cima al wizard.
**Skip:** link "Salta e parla direttamente con l'AI" in fondo ad ogni step.
**Persistenza:** contesto salvato in localStorage + DB. Se l'utente torna entro 24h, il wizard non si ripete.

---

### 5.1 — AI Chatbot per Ricerca Casa

**Descrizione:** Widget di chat che appare su homepage e pagina cerca. Riceve il contesto dall'onboarding (5.0) e partenza già contestualizzata. L'utente può affinare in linguaggio libero.

**Flusso tecnico:**
1. Utente completa onboarding → `session_id` salvato
2. ChatWidget invia messaggi a `/api/chat` con `session_id` + `context_id`
3. Claude riceve: system prompt + contesto pre-chat + storico messaggi
4. Claude estrae/aggiorna filtri: `{type, city, price_max, rooms_min, features[], lifestyle_keywords[]}`
5. `lifestyle_keywords[]` convertiti in embedding OpenAI
6. Query pgvector con bounding box geografico (da `location` + `max_distance_km`) + filtri SQL
7. Top 5 risultati inclusi nel context Claude per risposta finale
8. Risposta streammata, card annunci mostrate in real-time

**System Prompt per il chatbot:**
```
Sei l'assistente AI di CasaAI, il marketplace immobiliare italiano più avanzato.
Il tuo compito è aiutare gli utenti a trovare la casa perfetta attraverso una conversazione naturale.

COMPORTAMENTO:
- Parla sempre in italiano, in modo friendly e professionale
- Il contesto base è già stato raccolto (budget, zona, esigenze) — non ripetere queste domande
- Fai al massimo 1-2 domande di follow-up per dettagli mancanti (locali, piano, stile)
- Quando hai abbastanza informazioni, mostra subito i risultati
- Spiega PERCHÉ ogni immobile è compatibile con le esigenze dell'utente

PARAMETRI DA ESTRARRE/AGGIORNARE (JSON silenzioso):
{
  "type": "sale|rent|null",
  "property_types": ["apartment","house","villa",...],
  "city": "stringa|null",
  "price_max": number|null,
  "price_min": number|null,
  "rooms_min": number|null,
  "surface_min": number|null,
  "features": ["has_garden","has_parking","has_elevator",...],
  "lifestyle_keywords": ["vicino metro","quartiere tranquillo","buone scuole",...]
}

Quando rispondi con risultati:
1. Breve intro personalizzata che fa riferimento alle preferenze dell'utente
2. Risultati (il frontend li renderizza come card)
3. Invito a raffinare o contattare l'agenzia
```

**API Route `/api/chat`:**
- Method: POST
- Body: `{ messages: Message[], session_id: string, context_id?: string }`
- Response: Streaming text/event-stream
- Rate limit: 20 richieste/ora per IP

**API Route `/api/chat/context`:**
- Method: POST
- Body: `ChatContext` (vedi interfaccia sopra)
- Response: `{ context_id: string, session_id: string }`
- Salva in `chat_contexts`

### 5.2 — Valutazione AI Istantanea

**Descrizione:** Tool pubblico (anche senza login) che stima il valore di mercato di un immobile basandosi su caratteristiche e confronto con annunci simili nel DB.

**Flusso tecnico:**
1. Utente inserisce: indirizzo, tipo, superficie, anno costruzione, piano, classe energetica, caratteristiche
2. `/api/ai/valuation` cerca annunci simili per zona/tipo/dimensione
3. Claude analizza i dati comparabili + trend di mercato noti e restituisce:
   - Stima valore (range min-max)
   - Confidenza: alta/media/bassa
   - Fattori che aumentano/diminuiscono il valore
   - Confronto con media zona
4. Risultato mostrato con report scaricabile (PDF generato lato server)

**Output JSON da Claude:**
```json
{
  "valuation_min": 280000,
  "valuation_max": 320000,
  "valuation_central": 298000,
  "confidence": "high",
  "price_per_sqm": 2650,
  "zone_average_price_sqm": 2480,
  "positive_factors": ["Classe energetica A", "Piano alto con vista", "Posto auto incluso"],
  "negative_factors": ["Anno costruzione datato (1975)", "Senza ascensore"],
  "market_trend": "Il mercato in questa zona è in crescita del 3.2% rispetto all'anno scorso.",
  "comparable_listings": [/* array di annunci simili dal DB */]
}
```

### 5.3 — Dashboard Agenzie con Lead Scoring AI

**Descrizione:** Area privata per le agenzie con CRM integrato e AI che analizza la qualità dei lead.

**Lead Scoring:** Quando arriva un nuovo lead, Claude analizza:
- Messaggio del buyer (urgenza, specificità, budget chiaro)
- Comportamento precedente (ha già contattato altri annunci? Ha un profilo?)
- Compatibilità con l'annuncio
- Ora e giorno della richiesta

Output: score 0-100 + motivazione testuale brevissima (es. "Alta probabilità: budget chiaro, visita richiesta entro questa settimana")

**Metriche dashboard:**
- Annunci attivi / bozze / venduti
- Lead ricevuti (oggi / settimana / mese) con trend
- Tasso di conversione per annuncio
- Annunci con più visualizzazioni
- Lead per stadio CRM (kanban view)

**Grafici:**
- Visualizzazioni per annuncio nel tempo (line chart)
- Distribuzione lead per fonte (pie chart)
- Lead per giorno della settimana (bar chart)
- Conversion funnel (views → lead → contatto → vendita)

### 5.4 — Generazione Automatica Annunci AI

**Descrizione:** Nell'editor annunci, l'agente inserisce i dati tecnici (stanze, mq, caratteristiche) e con un click Claude genera una descrizione professionale e accattivante.

**Prompt per generazione:**
```
Sei un copywriter esperto di immobiliare italiano.
Genera una descrizione di vendita/affitto professionale e convincente per questo immobile.

CARATTERISTICHE:
[dati tecnici dell'immobile]

REGOLE:
- Max 250 parole
- Inizia con il punto di forza principale
- Usa linguaggio evocativo ma non esagerato
- Menziona il quartiere/zona se noto
- Termina con call-to-action per contattare l'agenzia
- NON inventare caratteristiche non fornite
- Tono: professionale ma caldo, adatto al mercato italiano
```

**Varianti:** l'agente può scegliere tra 3 toni (Professionale / Elegante / Giovane) e rigenerare.

### 5.5 — Import Automatico Annunci da Portali Esterni

**Descrizione:** Le agenzie possono sincronizzare automaticamente i propri annunci già pubblicati su Idealista, Immobiliare.it e altri portali, importandoli in CasaAI con un click. Il sistema evita duplicati, aggiorna prezzi/status, e con AI arricchisce i dati mancanti.

**⚠️ Nota Legale Importante:** Lo scraping di siti terzi può violare i loro Termini di Servizio. CasaAI implementa questo in modo responsabile:
- Si scrapa SOLO il profilo pubblico dell'agenzia (annunci già pubblici sul web)
- Rispetto del `robots.txt` di ogni sito
- Rate limiting aggressivo (1 richiesta ogni 3-5 secondi)
- Header User-Agent dichiarativi
- L'agenzia dichiara di essere il legittimo proprietario degli annunci
- Alternativa raccomandata: CSV export dai portali (Idealista e Immobiliare.it offrono export per le agenzie registrate)

---

**Metodi di Import (in ordine di preferenza):**

#### Metodo A — URL Profilo Agenzia (raccomandato)
L'agente incolla l'URL del proprio profilo sul portale:
- `https://www.idealista.it/pro/nome-agenzia/`
- `https://www.immobiliare.it/agenzie-immobiliari/napoli/nome-agenzia/`

Il sistema fa scraping degli annunci pubblici di quella specifica agenzia.

#### Metodo B — Import CSV
Idealista e Immobiliare.it permettono alle agenzie di esportare i propri annunci in CSV dal pannello di controllo. L'agente carica il file CSV e il sistema fa il parsing + import.

**Schema CSV accettato (formato flessibile con mapping AI-assistito):**
```csv
titolo,prezzo,superficie,locali,indirizzo,citta,tipo,descrizione,...
```
Claude normalizza automaticamente i nomi delle colonne (es. "Prezzo richiesto" → `prezzo`).

#### Metodo C — Import Singolo Annuncio via URL
L'agente incolla l'URL di un singolo annuncio per importarlo manualmente.

---

**Flusso Tecnico — Import da URL Profilo:**

```
1. Agenzia inserisce URL profilo + sceglie frequenza sync (manuale / giornaliera / settimanale)
2. POST /api/import → crea import_job con status 'pending'
3. Job Queue (BullMQ su Upstash Redis) processa il job:
   a. Playwright apre URL profilo agenzia
   b. Estrae lista URL annunci della pagina + paginazione
   c. Per ogni annuncio URL:
      - Carica pagina annuncio
      - Cheerio estrae: titolo, prezzo, superficie, locali, indirizzo, foto, descrizione, caratteristiche
      - Verifica se già in imported_listings_map (skip se esiste e non è cambiato)
      - Se nuovo: normalizza dati → INSERT in listings
      - Se esistente con prezzo/status cambiato: UPDATE listing
      - Download foto → Supabase Storage
      - Genera embedding OpenAI per la descrizione
      - Genera AI description arricchita (se descrizione originale < 100 parole)
4. Aggiorna import_job con stats (imported, updated, skipped, errors[])
5. Email/notifica all'agente al completamento
```

**Struttura scraper per Idealista (`lib/scrapers/idealista.ts`):**
```typescript
interface ScrapedListing {
  source_id: string          // ID annuncio su Idealista
  source_url: string
  title: string
  price: number
  price_period?: 'month'
  type: 'sale' | 'rent'
  property_type: string
  surface_sqm?: number
  rooms?: number
  bathrooms?: number
  address: string
  city: string
  province: string
  lat?: number
  lng?: number
  photos: string[]
  description: string
  features: string[]         // caratteristiche grezze dal portale
  energy_class?: string
  floor?: number
}

// Mapping caratteristiche Idealista → schema CasaAI
const IDEALISTA_FEATURE_MAP: Record<string, keyof Listing> = {
  'Con ascensore': 'has_elevator',
  'Box / Posto auto': 'has_parking',
  'Con giardino': 'has_garden',
  'Con terrazzo': 'has_terrace',
  'Con cantina': 'has_cellar',
}
```

**API Routes Import:**

```typescript
// POST /api/import — avvia nuovo job
Request: {
  source: 'idealista' | 'immobiliare_it' | 'csv' | 'url_manuale'
  source_url?: string
  csv_data?: string           // base64 del file CSV
  schedule?: string           // cron expression, null = solo manuale
}
Response: {
  job_id: string
  status: 'pending'
  estimated_duration_minutes: number
}

// GET /api/import/[job_id] — status in tempo reale
Response: {
  job_id: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'partial'
  progress: {
    total_found: number
    imported: number
    updated: number
    skipped: number
    errors: { url: string, reason: string }[]
  }
  started_at?: string
  completed_at?: string
}
```

**Pagina Dashboard `/dashboard/importa`:**

Layout con 3 sezioni:
1. **Configura Import** — form con metodo (URL/CSV/singolo), input URL, scelta frequenza sync
2. **Job Attivi e Storici** — tabella con: fonte, data, totale trovati, importati, errori, status badge
3. **Annunci Importati** — lista annunci con badge fonte originale, link sorgente, ultima sync

**Indicatori visivi per annunci importati:**
- Badge "da Idealista" / "da Immobiliare.it" nel pannello annunci
- Campo `source` visibile solo agli agenti (non ai buyer)
- Icona sync con data ultima sincronizzazione

**Abbonamento: Import disponibile dai piani:**
- Free: CSV manuale (max 10 annunci)
- Starter: URL import (max 2 sync/settimana, max 25 annunci)
- Pro: Sync automatica giornaliera, illimitata
- Enterprise: Multi-portale, API accesso, sync in tempo reale

---

## 6. PAGINE CHIAVE — SPECIFICHE UI

### Homepage (`/`)
- Hero section con chatbox AI grande e prominente
- **Prima della chat: wizard onboarding a 4 step** (vedi 5.0):
  - Step 1: Acquisto / Affitto (2 grandi bottoni)
  - Step 2: Slider budget con valore live
  - Step 3: Autocomplete indirizzo (Google Places) + selezione distanza
  - Step 4: Grid esigenze (checkbox visuali con icone)
  - CTA finale "Avvia la ricerca →"
- Placeholder chat: "Descrivi la casa dei tuoi sogni..." (appare DOPO wizard)
- Sotto hero: ultimi annunci in evidenza (6 card)
- Sezione "Come funziona" (3 step: Configura → Descrivi → Trova)
- Sezione agenzie partner (logo grid)
- Sezione valutazione gratuita (CTA)
- Footer con link legali

### Dashboard Import (`/dashboard/importa`)
- Header con spiegazione del tool e badge "Pro / Starter"
- **Card configura import:**
  - Selettore fonte: [Idealista] [Immobiliare.it] [Carica CSV] [URL singolo]
  - Input URL con placeholder specifico per fonte
  - Select frequenza: Manuale / Ogni giorno / Ogni settimana
  - Bottone [Avvia Import]
- **Tabella job storici:** fonte, data/ora, trovati, importati, aggiornati, errori, status
- **Progress bar live** per job in running (polling ogni 3 secondi via `/api/import/[job_id]`)
- **Lista errori** espandibile per ogni job (URL che hanno fallito + motivo)

### Pagina Cerca (`/cerca`)
- Layout a 3 colonne: filtri (sx) | risultati (centro) | mappa (dx)
- Su mobile: tab "Lista" / "Mappa"
- Filtri: tipo (vendita/affitto), provincia/città, prezzo range, superficie, locali, caratteristiche (checkbox), classe energetica
- Ordinamento: rilevanza AI | prezzo asc/desc | più recenti | più visti
- Ogni card annuncio: foto principale, prezzo, mq, locali, indirizzo, badge AI score
- Paginazione infinita (load more)

### Dettaglio Annuncio (`/annunci/[id]`)
- Galleria foto full-width (swiper)
- Dati tecnici in grid (mq, locali, piano, anno, energia)
- Descrizione AI-generated con badge "Descrizione ottimizzata con AI"
- Mappa con punto esatto e POI vicini (scuole, metro, supermercati)
- Box contatto agenzia con form lead
- "Valutazione AI" sezione: stima valore con gauge
- Annunci simili (6 card)
- Breadcrumb: Home > Città > Tipo > Titolo

### Dashboard Overview (`/dashboard`)
- 4 metric card in alto: annunci attivi, lead totali, lead settimana, tasso conversione
- Grafico visualizzazioni (ultimi 30 giorni)
- Tabella lead recenti (ultimi 10) con AI score badge colorato
- Quick actions: Pubblica annuncio | Visualizza lead | Vai ad analytics

---

## 7. MODELLO ABBONAMENTI (Stripe)

### Piani Agenzie

| Feature | Free | Starter (€99/mo) | Pro (€249/mo) | Enterprise (€499/mo) |
|---------|------|---------|-----|-----------|
| Annunci attivi | 3 | 25 | 100 | Illimitati |
| Lead/mese | 10 | 100 | Illimitato | Illimitato |
| AI descrizioni | 3/mese | 50/mese | Illimitato | Illimitato |
| Lead scoring AI | ✗ | ✓ | ✓ | ✓ |
| Analytics avanzate | ✗ | ✗ | ✓ | ✓ |
| API access | ✗ | ✗ | ✗ | ✓ |
| Supporto | Email | Email | Prioritario | Dedicato |

### Listing Premium (una tantum)
- **Featured listing:** €49 per 30 giorni (appare in alto nei risultati)
- **Boost:** €29 per 14 giorni (evidenziato con badge)

---

## 8. API ROUTES — CONTRATTI

### POST `/api/chat`
```typescript
Request: {
  messages: { role: 'user' | 'assistant', content: string }[]
  session_id?: string
}
Response: ReadableStream (SSE)
// Events: data: { type: 'text', content: string }
//         data: { type: 'listings', data: Listing[] }
//         data: { type: 'done' }
```

### GET `/api/listings/search`
```typescript
Query params: {
  q?: string          // query testuale
  type?: 'sale'|'rent'
  city?: string
  price_min?: number
  price_max?: number
  rooms_min?: number
  surface_min?: number
  has_garden?: boolean
  has_parking?: boolean
  energy_class?: string
  page?: number       // default 1
  limit?: number      // default 20, max 50
  sort?: 'relevance'|'price_asc'|'price_desc'|'newest'|'views'
}
Response: {
  listings: Listing[]
  total: number
  page: number
  has_more: boolean
}
```

### POST `/api/ai/valuation`
```typescript
Request: {
  address: string
  city: string
  province: string
  type: 'apartment'|'house'|'villa'
  surface_sqm: number
  rooms: number
  floor?: number
  year_built?: number
  energy_class?: string
  has_parking?: boolean
  has_garden?: boolean
  has_elevator?: boolean
}
Response: {
  valuation_min: number
  valuation_max: number
  valuation_central: number
  price_per_sqm: number
  confidence: 'high'|'medium'|'low'
  positive_factors: string[]
  negative_factors: string[]
  market_trend: string
  comparable_listings: Listing[]
}
```

### POST `/api/ai/generate-description`
```typescript
// Richiede auth (agente loggato)
Request: {
  listing_data: Partial<Listing>
  tone: 'professional'|'elegant'|'modern'
  type: 'sale'|'rent'
}
Response: {
  description: string
  word_count: number
}
```

### POST `/api/ai/score-lead`
```typescript
// Chiamata interna (non esposta pubblicamente)
Request: {
  lead_id: string
  listing_id: string
  message: string
  buyer_profile?: Partial<Profile>
}
Response: {
  score: number       // 0-100
  reason: string      // Max 100 caratteri
  priority: 'high'|'medium'|'low'
}
```

---

## 9. SICUREZZA & PERFORMANCE

### Auth & Autorizzazioni
- Supabase Auth con Row Level Security (RLS) su tutte le tabelle
- Policy: un agente vede solo i propri annunci e lead
- Admin può vedere tutto
- Listing pubblici leggibili da tutti (anche non autenticati)
- Middleware Next.js che protegge `/dashboard/*`

### Rate Limiting
- Chat AI: 20 richieste/ora per IP (Redis o Supabase rate limiter)
- Valutazione AI: 5 richieste/giorno per IP (non autenticati), 20 per autenticati
- Generate description: limitato dal piano abbonamento

### Performance
- Immagini: Next.js Image con ottimizzazione automatica
- Listings page: ISR (Incremental Static Regeneration) ogni 60 secondi
- Dettaglio annuncio: SSR con cache 30 secondi
- Mappa: lazy load del componente Mapbox
- Embeddings: precalcolati e aggiornati solo al salvataggio annuncio

### SEO
- Sitemap dinamica generata da Supabase
- Metadata dinamici per ogni annuncio (Open Graph)
- Schema.org markup per immobili (RealEstateListing)
- URL SEO-friendly: `/annunci/vendita-appartamento-napoli-123`

---

## 10. VARIABILI D'AMBIENTE

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI
ANTHROPIC_API_KEY=
OPENAI_API_KEY=              # solo per embeddings

# Stripe
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_PRO=
STRIPE_PRICE_ENTERPRISE=

# Mappa
NEXT_PUBLIC_MAPBOX_TOKEN=

# Email
RESEND_API_KEY=
FROM_EMAIL=noreply@casaai.it

# App
NEXT_PUBLIC_APP_URL=https://casaai.it
```

---

## 11. CRITERI DI COMPLETAMENTO MVP

Il MVP è considerato completo quando **TUTTI** i seguenti criteri sono soddisfatti:

### Core Funzionali
- [ ] Registrazione/login funzionante (email + Google)
- [ ] **Wizard onboarding pre-chat** funzionante (4 step: intent, budget, location+distanza, esigenze)
- [ ] Il contesto onboarding viene passato correttamente al chatbot come system message
- [ ] Un'agenzia può creare/modificare/pubblicare un annuncio con foto
- [ ] Gli annunci appaiono nella pagina /cerca con filtri funzionanti
- [ ] La pagina dettaglio annuncio mostra tutti i dati + mappa
- [ ] Il chatbot AI risponde e mostra annunci rilevanti (streaming)
- [ ] Il tool di valutazione AI restituisce una stima con fattori
- [ ] Il form contatto crea un lead nel DB dell'agenzia
- [ ] La dashboard mostra metriche reali (annunci, lead, visualizzazioni)
- [ ] Il lead scoring AI si attiva su ogni nuovo lead
- [ ] La generazione AI di descrizioni funziona nell'editor
- [ ] **Import da URL profilo agenzia** funzionante (almeno per Idealista)
- [ ] **Import da CSV** funzionante con mapping AI colonne
- [ ] La pagina `/dashboard/importa` mostra job storici e progress live

### Abbonamenti
- [ ] I piani Starter/Pro/Enterprise sono acquistabili via Stripe
- [ ] I limiti per piano sono enforced (es: free non può avere >3 annunci)
- [ ] Il webhook Stripe aggiorna correttamente subscription_tier

### Qualità
- [ ] Tutti i test unitari passano (copertura >70%)
- [ ] Nessun errore TypeScript
- [ ] ESLint senza errori
- [ ] Le pagine pubbliche caricano in <3 secondi (LCP)
- [ ] Il sito è responsive su mobile (320px+)
- [ ] Auth protegge correttamente /dashboard (redirect se non loggato)
- [ ] RLS Supabase impedisce cross-agency data access

### Output finale
Quando tutti i criteri sono soddisfatti, output: `<promise>MVP_CASAAI_COMPLETE</promise>`

---

## 12. COMANDI RALPH LOOP CONSIGLIATI

### Setup iniziale (una volta sola)
```bash
# Nella directory del progetto
npx create-next-app@latest casaai --typescript --tailwind --app --src-dir=no
cd casaai
npx shadcn@latest init

# Installa il plugin Ralph Loop
/plugin install ralph-wiggum@claude-plugins-official
```

### Fase 1 — Foundation (Settimana 1-2)
```
/ralph-loop "
Leggi il PRD in prd-casaai.md sezione 2,3,4.
Implementa:
1. Setup Next.js 15 con Supabase (client + server + admin)
2. Schema SQL completo (tutte le tabelle da sezione 3) tramite migration Supabase
3. Tipi TypeScript generati dallo schema
4. Auth middleware (protezione /dashboard)
5. Layout base: navbar, footer, responsive
6. Pagine: / , /cerca, /annunci/[id] con dati mock

Criteri completamento:
- npm run build senza errori
- npm run type-check senza errori
- Le 3 pagine si caricano senza errori
- Auth redirect funzionante

Output: <promise>FASE1_DONE</promise>
" --max-iterations 25
```

---

## ═══════════════════════════════════════
## MVP — LANCIO (Settimane 1–10)
## Obiettivo: piattaforma funzionante con agenzie pilota
## ═══════════════════════════════════════

### Fase 1 — Foundation & DB (Settimana 1-2)
```
/ralph-loop "
Leggi il PRD in prd-casaai.md sezione 2, 3, 4.
Implementa:
1. Setup Next.js 15 + Supabase (client/server/admin) + TypeScript strict
2. Schema SQL completo (TUTTE le tabelle da sezione 3 incluse v1.2) via migration
3. Tipi TypeScript generati dallo schema
4. Auth middleware (protezione /dashboard)
5. Layout base: navbar, footer, responsive mobile-first
6. Pagine stub: /, /cerca, /annunci/[id] con dati mock
7. Tabelle nuove v1.2: saved_searches, listing_views, notifications, reviews,
   sponsored_listings, blog_posts, service_bookings, mortgage_requests

Criteri completamento:
- npm run build senza errori TypeScript
- Le 3 pagine si caricano senza errori runtime
- Auth redirect /dashboard → /login funzionante
- Migration Supabase applicata senza errori

Output: <promise>FASE1_DONE</promise>
" --max-iterations 25
```

### Fase 2 — AI Core + Onboarding (Settimana 3-4)
```
/ralph-loop "
Leggi il PRD in prd-casaai.md sezione 5.0, 5.1, 5.2, 8.
Implementa:
1. ChatOnboarding.tsx wizard 4 step (sezione 5.0)
2. /api/chat/context salva ChatContext
3. /api/chat streaming Claude API con context pre-chat iniettato
4. Embeddings OpenAI + pgvector + filtro geografico (bounding box km)
5. ChatWidget.tsx con streaming UI
6. Confronto annunci (sezione MVP-COMPARE):
   - Zustand CompareStore con add/remove/clear (max 4 ids)
   - Checkbox "Confronta" su ogni ListingCard
   - Barra fissa bottom con count selezionati + CTA
   - CompareDrawer.tsx: tabella affiancata con diff verde/rosso
   - URL condivisibile /confronta?ids=...
   - Limite: Free max 3, Premium max 4
7. /api/ai/valuation + pagina /valutazione

Criteri completamento:
- Wizard onboarding completa e salva contesto
- Chatbot risponde in streaming con contesto corretto
- Ricerca geografica filtra per distanza
- Confronto apre drawer con ≥2 annunci, diff verde/rosso visibili
- URL /confronta?ids=... carica correttamente il drawer
- Valutazione AI ritorna range prezzo

Output: <promise>FASE2_DONE</promise>
" --max-iterations 35
```

### Fase 3 — Dashboard Agenzie + Chat Buyer-Agente (Settimana 5-7)
```
/ralph-loop "
Leggi il PRD in prd-casaai.md sezione 5.3, 5.4, 5.5, 6, 7.
Implementa:
1. Dashboard completa /dashboard/* (layout, sidebar nav)
2. CRUD annunci con foto (Uploadthing) + generazione AI descrizioni
3. CRM lead con AI scoring + vista kanban drag&drop (react-beautiful-dnd)
4. Analytics con grafici Recharts
5. Integrazione Stripe (piani Starter/Pro/Enterprise + webhook)
6. Import annunci: scraper Idealista + CSV + job queue BullMQ/Upstash
7. Chat diretta buyer-agente (sezione MVP-C):
   - Supabase Realtime channels per ogni listing_id
   - /dashboard/messaggi: inbox agente con threads per annuncio
   - Pagina annuncio: pulsante 'Scrivi all\'agente' apre chat inline
   - Notifiche realtime su nuovi messaggi
8. QR code per annuncio (sezione MVP-Q):
   - /api/listings/[id]/qr: genera PNG qrcode npm
   - Pulsante 'Scarica QR' in dashboard annuncio
   - URL QR → /annunci/[id]?utm_source=qr
9. Multi-agente per agenzia (sezione MVP-M):
   - Tabella agency_members (agency_id, profile_id, role: admin|agent|assistant)
   - RLS: agenti vedono solo i propri lead
   - /dashboard/team: invita agenti via email

Criteri completamento:
- Agente crea annuncio completo con foto
- Lead arrivano con AI score
- Kanban lead funziona con drag&drop
- Stripe checkout in test mode
- Import Idealista importa 3+ annunci
- Chat buyer-agente funziona in realtime
- QR code scaricabile per ogni annuncio
- Invito agente via email + RLS corretto

Output: <promise>FASE3_DONE</promise>
" --max-iterations 50
```

### Fase 4 — Trust MVP + Monetizzazione base (Settimana 8-9)
```
/ralph-loop "
Leggi il PRD in prd-casaai.md sezione 9, 11, 14.1, 14.2, 14.3.
Implementa:
1. Alert annunci in tempo reale (sezione MVP-A):
   - Supabase Realtime su INSERT listings filtrato per saved_searches
   - Cron job alternativo: ogni ora controlla nuovi listing vs saved_searches
   - Email notifica via Resend con preview annuncio
   - Toggle 'Attiva alert' su ogni ricerca salvata
2. GDPR compliance (sezione MVP-G):
   - /account/privacy: scarica dati (JSON export Supabase), cancella account
   - Banner cookie con consenso granulare (Zustand persist)
   - Log audit accessi dati in access_logs table
3. Annunci sponsorizzati base (sezione MVP-S):
   - Campo is_sponsored + sponsored_until in listings
   - /dashboard/promuovi/[id]: Stripe one-time payment (€29/14gg, €49/30gg)
   - Listing sponsorizzati appaiono in cima con badge 'In evidenza'
4. Rate limiting, RLS Supabase completo, SEO (sitemap, metadata, schema.org)
5. Test unitari >70%, TypeScript/ESLint zero errori, LCP <3s

Criteri completamento:
- Alert email arriva entro 5 min da nuovo annuncio compatibile
- Export dati GDPR scaricabile
- Listing sponsorizzato appare in cima dopo pagamento
- Tutti i criteri sezione 11 soddisfatti

Output: <promise>MVP_CASAAI_COMPLETE</promise>
" --max-iterations 45
```

---

## ═══════════════════════════════════════
## V2 — CRESCITA (Mesi 3–6)
## Obiettivo: retention, più revenue, fiducia della piattaforma
## ═══════════════════════════════════════

### Fase 5 — Engagement & Conversione (Mese 3-4)
```
/ralph-loop "
Leggi il PRD in prd-casaai.md sezione 14 (V2).
Implementa:
1. Calcolatore mutuo integrato (sezione V2-MORT):
   - Componente MortgageCalculator.tsx su ogni pagina annuncio
   - Input: prezzo, anticipo %, durata anni → rata mensile, TAEG, totale interessi
   - Formula: M = P[r(1+r)^n]/[(1+r)^n-1]
   - CTA 'Richiedi preventivo mutuo' → form mortgage_requests in DB
2. Storico prezzi annuncio (sezione V2-HIST):
   - Tabella listing_price_history (listing_id, price, changed_at)
   - Trigger Supabase su UPDATE listings.price
   - Grafico sparkline Chart.js su pagina dettaglio annuncio
3. Report AI quartiere (sezione V2-ZONE):
   - Pagina /quartieri/[citta]/[quartiere]
   - Claude genera report markdown: prezzi medi, trend 12 mesi, POI (da OSM/Overpass API)
   - Cache Supabase: rigenera se >7 giorni
4. Prenotazione visite online (sezione V2-CAL):
   - Tabella visit_slots (agent_id, datetime, listing_id, status)
   - /dashboard/calendario: agente imposta disponibilità (griglia settimanale)
   - Pagina annuncio: 'Prenota visita' → picker slot liberi
   - Email conferma buyer + agente via Resend
5. Report AI settimanale per agenti (sezione V2-REP):
   - Cron Supabase Edge Function ogni lunedì 08:00
   - Claude genera report personalizzato (ultimi 7gg, best annunci, trend lead)
   - Email HTML formattata via Resend
6. Risposte email AI per agenti (sezione V2-EMAIL):
   - Bozza AI automatica sotto ogni nuovo lead con messaggio
   - /api/ai/draft-reply: Claude genera risposta da messaggio+dati annuncio
   - 3 toni (Professionale/Cordiale/Urgente), pulsanti Invia/Modifica/Ignora
   - Tracciamento leads.ai_reply_used per analytics
   - Limiti per piano: Free 5/mese, Starter+ illimitato

Criteri completamento:
- Calcolatore mutuo calcola correttamente (test con valori noti)
- Storico prezzi mostra grafico su almeno 1 annuncio
- Report quartiere genera e cachea correttamente
- Prenotazione visita invia email a entrambi
- Report settimanale inviato in test mode
- Bozza AI appare su lead con messaggio, 3 toni funzionanti
- Invio diretto bozza AI registra ai_reply_used = true

Output: <promise>FASE5_DONE</promise>
" --max-iterations 45
```

### Fase 6 — Trust & Revenue V2 (Mese 5-6)
```
/ralph-loop "
Leggi il PRD in prd-casaai.md sezione 14 (V2-TRUST, V2-REV).
Implementa:
1. Recensioni verificate (sezione V2-REV1):
   - Tabella reviews (from_id, to_id, listing_id, rating 1-5, text, verified)
   - Solo chi ha una trattativa closed_won può recensire
   - Widget stelle su profilo agenzia e pagina annuncio
   - Media rating nella card agenzia
2. Verifica agenzie (sezione V2-VER):
   - /dashboard/verifica: upload P.IVA + documento identità (Uploadthing)
   - Tabella verification_requests (agency_id, docs[], status, reviewed_by)
   - Admin panel /admin/verifiche: approva/rifiuta con nota
   - Badge 'Agenzia Verificata' su profilo e card
3. Rilevamento annunci falsi AI (sezione V2-FRAUD):
   - Webhook Supabase su INSERT listings → chiama /api/ai/fraud-check
   - Claude analizza: prezzo vs media zona (>50% sotto = flag), foto duplicate (hash MD5), testo copiato
   - Listing flaggato → status 'under_review', notifica admin
4. Mini-sito agenzia pubblico (sezione V2-SITE):
   - Pagina /agenzie/[slug] con layout brandizzato (logo, descrizione, tutti gli annunci)
   - URL personalizzabile dal dashboard
   - Meta tags Open Graph per condivisione social
5. Piano Premium Buyer €9,90/mese (sezione V2-PREM):
   - Stripe subscription + feature flag in profiles.subscription_tier
   - Feature: alert immediati (vs 24h), storico prezzi completo, report quartiere full
   - /account/premium: upgrade/downgrade con Stripe Customer Portal

Criteri completamento:
- Recensione salvata solo dopo trattativa chiusa
- Badge verificato appare su agenzia dopo approvazione admin
- Annuncio con prezzo -60% media zona viene flaggato
- Mini-sito agenzia accessibile e brandizzato
- Stripe Premium Buyer checkout funzionante

Output: <promise>FASE6_DONE</promise>
" --max-iterations 45
```

---

## ═══════════════════════════════════════
## V3 — SCALE (Mesi 7–12)
## Obiettivo: revenue moltiplicato, espansione EU
## ═══════════════════════════════════════

### Fase 7 — Monetizzazione Avanzata (Mese 7-9)
```
/ralph-loop "
Leggi il PRD in prd-casaai.md sezione 14 (V3).
Implementa:
1. Marketplace mutui e assicurazioni (sezione V3-MORT):
   - Integrazione API MutuiOnline o Facile.it (affiliate)
   - Widget 'Migliori offerte mutuo' su ogni annuncio di vendita
   - Tabella mortgage_requests con tracking conversioni
   - Revenue share: €50-200 per lead qualificato
2. Tour virtuale 3D Matterport (sezione V3-3D):
   - Campo virtual_tour_url in listings
   - Iframe embed Matterport nel dettaglio annuncio
   - Badge '3D Tour' nella card annuncio
   - /dashboard/annunci: link 'Aggiungi tour 3D' con istruzioni Matterport
3. Blog AI con contenuti SEO locali (sezione V3-BLOG):
   - Tabella blog_posts (slug, city, title, content_mdx, generated_at)
   - Cron settimanale: Claude genera 3 articoli per le top 5 città
   - Argomenti: 'prezzi {quartiere} {mese}', 'migliori zone per famiglie {città}', ecc.
   - Pagina /blog + /blog/[slug] con MDX rendering
   - Sitemap dinamica include blog posts
4. API dati B2B (sezione V3-API):
   - /api/v1/market-data: prezzi medi per zona, trend, volume compravendite
   - API key management in /dashboard/api (genera, revoca chiavi)
   - Rate limiting per tier (1k/gg free, 10k/gg Pro, illimitato Enterprise)
   - Documentazione OpenAPI auto-generata
5. Analisi documenti AI (sezione V3-DOC):
   - Upload APE, visura catastale, planimetria (PDF/immagine)
   - Claude Vision analizza: classe energetica effettiva, difformità urbanistiche, ipoteche
   - Report PDF scaricabile con semaforo verde/giallo/rosso
   - Crediti AI: 3 gratis poi €5 cad (Stripe)

Criteri completamento:
- Link mutuo genera lead tracciato
- Tour 3D si carica correttamente nel dettaglio annuncio
- Blog genera 3 articoli e li indicizza in sitemap
- API key funzionante con rate limiting
- Analisi documento PDF ritorna report

Output: <promise>FASE7_DONE</promise>
" --max-iterations 50
```

### Fase 8 — Marketplace Servizi + Match AI (Mese 10-12)
```
/ralph-loop "
Leggi il PRD in prd-casaai.md sezione 14 (V3-SERV, V3-MATCH).
Implementa:
1. Marketplace servizi casa post-acquisto (sezione V3-SERV):
   - Tabella service_providers (name, category, cities[], rating, price_range)
   - Categorie: traslochi, ristrutturatori, architetti, fotografi, geometri, notai
   - /servizi: directory con filtro per città e categoria
   - Prenotazione: form → email provider → CasaAI prende 10% via Stripe
   - Integrazione automatica: dopo marcato 'venduto' → email buyer con servizi consigliati
2. Match AI proattivo buyer-agenzia (sezione V3-MATCH):
   - Cron giornaliero: per ogni buyer con saved_search attiva, Claude valuta
     compatibilità con ogni agenzia (specializzazione zona, storico prezzi, rating)
   - Se match score >80: notifica buyer 'Abbiamo trovato l'agenzia giusta per te'
   - Notifica agenzia 'Nuovo buyer compatibile con il tuo portfolio'
   - Tracciamento conversioni match → trattativa
3. Checklist acquisto guidata AI (sezione V3-CHECK):
   - /guida-acquisto: wizard interattivo 8 step
   - Claude genera checklist personalizzata in base a: prima casa/investimento, mutuo/contanti, città
   - Step: proposta → compromesso → mutuo → perizia → rogito → voltura
   - Ogni step: documenti necessari, tempi medi, costi stimati, FAQ
4. Crediti AI pay-per-use (sezione V3-CRED):
   - Tabella ai_credits (profile_id, balance, transactions[])
   - 3 crediti gratis all'iscrizione
   - Valutazione AI: 1 credito, Analisi documento: 2 crediti, Report quartiere full: 1 credito
   - Stripe one-time: pacchetti 10 crediti €9, 50 crediti €35, 200 crediti €99

Criteri completamento:
- Prenotazione servizio invia email provider + tracking Stripe
- Email post-vendita inviata automaticamente
- Match AI genera notifiche per almeno 1 coppia buyer-agenzia di test
- Checklist genera step personalizzati correttamente
- Crediti scalano correttamente su ogni azione AI

Output: <promise>V3_CASAAI_COMPLETE</promise>
" --max-iterations 55
```

---

## 14. FEATURE ROADMAP COMPLETA (v1.2)

---

### 14.1 — MVP: Feature Aggiuntive

#### MVP-C — Chat diretta buyer-agente
**Tech:** Supabase Realtime channels
- Tabella `messages (id, channel_id, sender_id, content, read_at, created_at)`
- Tabella `channels (id, listing_id, buyer_id, agent_id, created_at)`
- Ogni annuncio ha un canale univoco per coppia buyer-agente
- Inbox `/dashboard/messaggi`: lista thread con badge messaggi non letti
- Pagina annuncio: button "Scrivi all'agente" → apre drawer chat inline (no redirect)
- Notifica push/email se agente non risponde entro 2h

#### MVP-Q — QR code per cartelli fisici
**Tech:** `qrcode` npm package
- Endpoint `GET /api/listings/[id]/qr` → genera PNG 300×300px
- URL codificato: `https://casaai.it/annunci/[id]?utm_source=qr_sign&utm_medium=offline`
- In dashboard: pulsante "Scarica QR" accanto ad ogni annuncio attivo
- Opzione: QR con logo CasaAI sovrapposto (canvas merge)
- Analytics: visualizzazioni da QR tracciate separatamente

#### MVP-M — Multi-agente per agenzia
**Tech:** Supabase RLS + ruoli
```sql
CREATE TABLE agency_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID REFERENCES agencies(id),
  profile_id UUID REFERENCES profiles(id),
  role TEXT CHECK (role IN ('admin','agent','assistant')) DEFAULT 'agent',
  invited_by UUID REFERENCES profiles(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(agency_id, profile_id)
);
```
- `/dashboard/team`: lista membri, invita via email, cambia ruolo, rimuovi
- RLS: agenti vedono solo lead dei propri annunci, admin vede tutto
- Email invito con link accettazione (token JWT temporaneo)

#### MVP-A — Alert annunci in tempo reale
**Tech:** Supabase Realtime + Resend
- Supabase Realtime subscription su `INSERT listings` filtrato per `city` e `type`
- Confronto con tutte le `saved_searches` attive che hanno `notify_email = true`
- Se match: `POST /api/notifications/email` → Resend con template HTML annuncio
- Toggle "Attiva alert" su `/cerca` dopo ogni ricerca
- Frequenza: immediata (Piano Premium) o digest giornaliero (Piano Free)

#### MVP-G — GDPR compliance
- `/account/privacy`: export dati JSON (tutti i dati utente da Supabase)
- Cancellazione account: anonimizza leads, elimina profilo, cancella sessioni
- Banner cookie con Zustand persist: necessari | preferenze | analytics | marketing
- Tabella `consent_logs (profile_id, category, granted, ip_hash, created_at)`
- Policy privacy + cookie in `/legal/privacy` e `/legal/cookie`

#### MVP-S — Annunci sponsorizzati base
```sql
ALTER TABLE listings ADD COLUMN is_sponsored BOOLEAN DEFAULT FALSE;
ALTER TABLE listings ADD COLUMN sponsored_until TIMESTAMPTZ;
ALTER TABLE listings ADD COLUMN sponsored_position INT; -- 1=top, 2=secondo, ecc.
```
- `/dashboard/promuovi/[id]`: Stripe Payment Intent one-time
  - €29 → 14 giorni in evidenza
  - €49 → 30 giorni in evidenza
  - €79 → 30 giorni + posizione #1 in città
- Badge "In evidenza" nella card annuncio (stile distinto ma non aggressivo)
- Cron Supabase Edge Function: ogni ora → `sponsored_until < NOW()` → `is_sponsored = false`
- Webhook Stripe `payment_intent.succeeded` → attiva sponsorizzazione

---

### 14.2 — V2: Feature di Crescita

#### MVP-COMPARE — Confronto annunci affiancato
**Tech:** Zustand store + drawer React
```typescript
// Store selezione annunci da confrontare
interface CompareStore {
  ids: string[]           // max 4
  add: (id: string) => void
  remove: (id: string) => void
  clear: () => void
}
```
- Ogni card annuncio ha un checkbox discreto in alto a dx: "Confronta"
- Barra fissa in fondo allo schermo appare quando ≥2 selezionati:
  `"2 annunci selezionati  [+ Aggiungi]  [Confronta ora →]  [✕]"`
- Click "Confronta ora" → drawer full-height da destra (Framer Motion)
- Tabella affiancata con righe: prezzo, €/mq, superficie, locali, piano, anno, energia, caratteristiche, distanza dal punto (se context onboarding)
- Differenze evidenziate: valore migliore in verde, peggiore in rosso
- Pulsante "Contatta agenzia" per ogni colonna
- Condivisibile: `/confronta?ids=uuid1,uuid2,uuid3` (URL params)
- Limite: Free = max 3, Premium = max 4

#### V2-MORT — Calcolatore mutuo integrato
- Componente `MortgageCalculator.tsx` su sidebar pagina annuncio
- Input: prezzo immobile (pre-compilato), anticipo % (slider 10-40%), durata anni (10/15/20/25/30)
- Output: rata mensile, totale interessi, LTV%, importo finanziato
- Formula: `M = P × [r(1+r)^n] / [(1+r)^n - 1]` dove r = tasso/12, n = mesi
- CTA: "Richiedi preventivo gratuito" → form `mortgage_requests` + notifica agente
- In futuro: integrazione API MutuiOnline per rate reali (V3)

#### V2-HIST — Storico prezzi annuncio
```sql
CREATE TABLE listing_price_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID REFERENCES listings(id),
  old_price NUMERIC,
  new_price NUMERIC,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);
-- Trigger Supabase:
CREATE OR REPLACE FUNCTION track_price_change() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.price != NEW.price THEN
    INSERT INTO listing_price_history(listing_id, old_price, new_price)
    VALUES (NEW.id, OLD.price, NEW.price);
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
```
- Grafico sparkline (Chart.js 40px height) su pagina dettaglio
- Tooltip: "Prezzo abbassato di €10.000 il 15 marzo"
- Badge "Prezzo ridotto" se abbassato negli ultimi 30gg

#### V2-ZONE — Report AI quartiere
- Pagina `/quartieri/[citta]/[quartiere]` (es. `/quartieri/napoli/chiaia`)
- Claude genera report strutturato: prezzi medi (da DB), trend, top POI (OpenStreetMap Overpass API), indice qualità vita
- Cache in `zone_reports (zone_id, content_mdx, generated_at)` → rigenera se >7 giorni
- SEO: pre-render con ISR, metadata dinamici ("Prezzi Chiaia Napoli 2026")
- Link da pagina annuncio → "Scopri il quartiere"

#### V2-CAL — Prenotazione visite online
```sql
CREATE TABLE visit_slots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES profiles(id),
  listing_id UUID REFERENCES listings(id),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status TEXT CHECK (status IN ('available','booked','cancelled')) DEFAULT 'available',
  buyer_id UUID REFERENCES profiles(id),
  buyer_note TEXT
);
```
- `/dashboard/calendario`: griglia settimanale, agente clicca slot per aprirlo/chiuderlo
- Pagina annuncio: "Prenota visita" → mostra slot liberi prossimi 14 giorni
- Buyer sceglie slot → email conferma ad entrambi (Resend) con indirizzo + note
- Reminder automatico 24h prima

#### V2-REP — Report AI settimanale agenti
- Supabase Edge Function cron: ogni lunedì 08:00
- Query: leads settimana, visualizzazioni, annunci top, conversion rate
- Claude genera report HTML personalizzato con insight specifici:
  "Il tuo annuncio in Via Roma ha 3x più visite della media — considera di abbassare il prezzo del 5%"
- Email via Resend con layout branded CasaAI

#### V2-EMAIL — Risposte email AI per agenti
**Tech:** Claude API + Resend + dashboard inbox
- Quando arriva un nuovo lead con messaggio, la dashboard mostra sotto al testo:
  "✨ Bozza AI" con risposta pre-scritta da Claude in 1-2 frasi
- Claude analizza: messaggio buyer + dati annuncio + profilo agenzia → genera risposta professionale e personalizzata
- L'agente può: inviare direttamente | modificare e inviare | ignorare
- 3 toni selezionabili prima di generare: Professionale / Cordiale / Urgente
- Prompt base:
  ```
  Sei un agente immobiliare italiano professionale.
  Scrivi una risposta breve (max 3 frasi) al seguente messaggio di un potenziale cliente.
  Annuncio: [titolo, prezzo, indirizzo]
  Messaggio cliente: [testo lead]
  Tono richiesto: [professionale|cordiale|urgente]
  Includi: ringraziamento, disponibilità per visita, contatto diretto.
  NON inventare dettagli non forniti. Firma con il nome dell'agente.
  ```
- Tracciamento: `leads.ai_reply_used BOOLEAN` per analytics uso feature
- Disponibile da: Piano Starter in su (Free: 5 bozze/mese, Starter+: illimitato)

#### V2-PREM — Piano Premium Buyer (€9,90/mese)
- Stripe Subscription + `profiles.buyer_tier = 'premium'`
- Feature premium: alert immediati (free = digest 24h), storico prezzi completo (free = 3 mesi), report quartiere full (free = summary), confronto annunci illimitato (free = max 3)
- `/account/premium`: Stripe Customer Portal per gestione
- Badge "Premium" discreto nel profilo buyer

#### V2-VER — Verifica agenzie
- `/dashboard/verifica`: upload P.IVA + documento identità (Uploadthing)
- Email automatica admin su nuova richiesta
- `/admin/verifiche`: lista richieste, preview documenti, approva/rifiuta
- Badge SVG "✓ Verificata" su profilo e card agenzia
- Boost algoritmo: agenzie verificate appaiono prima a parità di altri fattori

#### V2-REV1 — Recensioni verificate
```sql
CREATE TABLE reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reviewer_id UUID REFERENCES profiles(id),
  reviewed_agency_id UUID REFERENCES agencies(id),
  lead_id UUID REFERENCES leads(id),  -- solo se lead.status = 'closed_won'
  rating INT CHECK (rating BETWEEN 1 AND 5),
  text TEXT,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```
- Trigger: quando `leads.status → closed_won`, email a buyer con link recensione (token 7gg)
- Widget stelle su pagina agenzia + media rating nella card
- Risposta agenzia alla recensione (1 risposta per recensione)

#### V2-FRAUD — Rilevamento annunci falsi AI
- Webhook Supabase `INSERT listings` → `/api/ai/fraud-check` (async, non blocca pubblicazione)
- Claude analizza: prezzo vs media zona (-50% = alto rischio), descrizione generica/copiata, foto hash duplicato
- Flag levels: `clean | suspicious | high_risk`
- `high_risk` → `status = 'under_review'` + notifica admin
- `suspicious` → badge interno admin, non visibile ai buyer

#### V2-SITE — Mini-sito agenzia pubblico
- `/agenzie/[slug]`: layout brandizzato con logo, colori agenzia, header hero
- Tutti gli annunci dell'agenzia paginati
- Sezione team agenti, info contatto, recensioni
- URL personalizzabile da `/dashboard/impostazioni`
- Open Graph dinamici per condivisione social

#### V2-BLOG — Blog AI con contenuti SEO locali
```sql
CREATE TABLE blog_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE,
  city TEXT,
  title TEXT,
  content_mdx TEXT,
  meta_description TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  published BOOLEAN DEFAULT TRUE
);
```
- Cron settimanale: Claude genera 3 articoli per top 5 città
- Template argomenti: "Prezzi immobili {quartiere} {mese} {anno}", "Guida acquisto prima casa {città}", "Migliori quartieri famiglie {città} {anno}"
- `/blog` + `/blog/[slug]` con MDX rendering + sitemap automatica

---

### 14.3 — V3: Scale & Monetizzazione Avanzata

#### V3-MORT — Marketplace mutui (revenue principale)
- Integrazione affiliazione MutuiOnline/Facile.it (o diretta con banche)
- Widget "Le migliori offerte mutuo per questo immobile" su ogni annuncio vendita
- Tabella `mortgage_leads (listing_id, buyer_id, bank_partner, amount, status, commission_eur)`
- Revenue stimato: €50-200 per lead qualificato → se 500 lead/mese = €25k-100k/mese aggiuntivi

#### V3-3D — Tour virtuale 3D Matterport
- Campo `virtual_tour_url TEXT` in listings (già presente nello schema)
- Iframe embed Matterport nella galleria foto (tab dedicato "Tour 3D")
- Istruzioni per l'agente su come creare tour con smartphone Matterport
- Badge "Tour 3D disponibile" nella card annuncio

#### V3-API — API dati B2B
- `/api/v1/market-data`: prezzi medi per zona (CAP/città/quartiere), CAGR trimestrale, volume transazioni
- API key management: genera chiavi con scadenza e permessi granulari
- Rate limiting: 1k req/gg free, 10k Pro, illimitato Enterprise
- Documentazione Swagger UI su `/api/docs`
- Target: banche, fondi, studi notarili, valuatori → €200-500/mese

#### V3-DOC — Analisi documenti AI
- Upload APE, visura catastale, planimetria (PDF o immagine)
- Claude Vision analizza: classe energetica effettiva, ipoteche/vincoli, difformità planimetria
- Output: report PDF con semaforo per ogni voce (verde = ok, giallo = attenzione, rosso = problema)
- Crediti: 2 crediti per analisi → con 1000 analisi/mese = €10k aggiuntivi

#### V3-SERV — Marketplace servizi post-acquisto
- Directory provider: traslochi, ristrutturatori, architetti, fotografi, geometri, notai
- Email automatica a buyer dopo `lead.status → closed_won`: "Casa tua! Ecco i servizi che potrebbero servirti"
- Prenotazione: form → notifica provider → CasaAI prende 10-15% via Stripe Connect
- Target: 200 prenotazioni/mese × €50 commissione media = €10k/mese

#### V3-MATCH — Match AI proattivo buyer-agenzia
- Cron giornaliero: per ogni `saved_search` attiva, Claude valuta match con portfolio agenzie
- Score 0-100 basato su: zona overlap, fascia prezzo, tipologia, rating agenzia, tempi risposta storici
- Score >80: notifica buyer + notifica agenzia (entrambi opt-in)
- Tracciamento: match → conversazione → trattativa → chiuso

#### V3-CHECK — Checklist acquisto guidata AI
- `/guida-acquisto/[session_id]`: wizard 8 step interattivo
- Step: valuta budget → trovato annuncio → proposta d'acquisto → compromesso → mutuo → perizia → rogito → voltura utenze
- Claude personalizza checklist: prima casa vs investimento, mutuo vs contanti, città (normative regionali)
- Per ogni step: documenti richiesti, tempi medi, costi, FAQ, warning comuni
- Esportabile come PDF personalizzato

#### V3-CRED — Sistema crediti AI
```sql
CREATE TABLE ai_credits (
  profile_id UUID REFERENCES profiles(id) PRIMARY KEY,
  balance INT DEFAULT 3,
  lifetime_used INT DEFAULT 0
);
CREATE TABLE credit_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id),
  amount INT,  -- positivo = acquisto, negativo = utilizzo
  action TEXT, -- 'valuation', 'doc_analysis', 'zone_report', 'purchase'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```
- 3 crediti gratis all'iscrizione
- Pacchetti Stripe one-time: 10 crediti €9, 50 crediti €35, 200 crediti €99
- Utilizzo: valutazione AI = 1cr, analisi documento = 2cr, report quartiere full = 1cr

---

## ═══════════════════════════════════════
## 15. PROIEZIONI REVENUE PER FASE
## ═══════════════════════════════════════

### MVP (mese 1-3)
| Fonte | Ipotesi | Revenue/mese |
|-------|---------|-------------|
| SaaS Agenzie (Starter €99) | 30 agenzie | €2.970 |
| SaaS Agenzie (Pro €249) | 10 agenzie | €2.490 |
| Listing sponsorizzati | 50 boost × €39 avg | €1.950 |
| **Totale MVP** | | **~€7.000/mese** |

### V2 (mese 4-6)
| Fonte | Ipotesi | Revenue/mese |
|-------|---------|-------------|
| SaaS Agenzie (crescita) | 150 agenzie mix | €20.000 |
| Premium Buyer €9,90 | 500 buyer | €4.950 |
| Listing sponsorizzati | 200 boost | €7.800 |
| **Totale V2** | | **~€33.000/mese** |

### V3 (mese 10-12)
| Fonte | Ipotesi | Revenue/mese |
|-------|---------|-------------|
| SaaS Agenzie | 500 agenzie mix | €75.000 |
| Premium Buyer | 2.000 buyer | €19.800 |
| Marketplace mutui | 300 lead × €100 avg | €30.000 |
| Servizi post-acquisto | 200 pren. × €50 comm. | €10.000 |
| API B2B | 20 clienti × €300 avg | €6.000 |
| Crediti AI | 5.000 crediti × €0,7 | €3.500 |
| **Totale V3** | | **~€144.000/mese** |

---

*Fine PRD v1.2 — CasaAI Marketplace*
