-- Feature films and documentaries from the nationalities the household
-- watches only: films already offered in New that the sync now skips leave
-- it. The sync stores such films without an entry, as it does re-releases.
-- Films the household already kept, watched or archived stay.

-- Under an hour (an unknown runtime of 0 counts as a film).
DELETE FROM entries
WHERE status = 'new'
  AND tmdb_id IN (SELECT tmdb_id FROM movies WHERE runtime > 0 AND runtime < 60);

-- No origin country in ORIGIN_COUNTRIES as it stood when this was written. A
-- co-production stays when any of its countries is listed, and a film with
-- no nationality on file stays.
DELETE FROM entries
WHERE status = 'new'
  AND tmdb_id IN (
    SELECT tmdb_id FROM movies
    WHERE json_array_length(tmdb_json, '$.origin_country') > 0
      AND NOT EXISTS (
        SELECT 1 FROM json_each(tmdb_json, '$.origin_country')
        WHERE value IN ('FR', 'US', 'BE', 'JP', 'KR', 'GB', 'IT', 'ES', 'NO', 'SE', 'DK', 'FI', 'IS')
      )
  );
