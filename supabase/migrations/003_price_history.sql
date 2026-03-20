-- Price history tracking
CREATE TABLE IF NOT EXISTS listing_price_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  old_price NUMERIC,
  new_price NUMERIC,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_price_history_listing ON listing_price_history(listing_id);

-- Trigger function
CREATE OR REPLACE FUNCTION track_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.price IS DISTINCT FROM NEW.price THEN
    INSERT INTO listing_price_history (listing_id, old_price, new_price)
    VALUES (NEW.id, OLD.price, NEW.price);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
DROP TRIGGER IF EXISTS trg_listing_price_change ON listings;
CREATE TRIGGER trg_listing_price_change
  BEFORE UPDATE ON listings
  FOR EACH ROW
  EXECUTE FUNCTION track_price_change();
