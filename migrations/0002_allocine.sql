-- Allociné's press and spectator ratings (out of 5) are refreshed from its
-- weekly release agenda; the film's Allociné id links to its page there.
ALTER TABLE movies ADD COLUMN allocine_id INTEGER;
ALTER TABLE movies ADD COLUMN ratings_fetched_at TEXT;
