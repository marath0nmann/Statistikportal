-- Geburtsjahr als eigenes Feld, Geburtsdatum entfernen
ALTER TABLE athleten ADD COLUMN geburtsjahr SMALLINT NULL AFTER geschlecht;
UPDATE athleten SET geburtsjahr = YEAR(geburtsdatum) WHERE geburtsdatum IS NOT NULL AND geburtsjahr IS NULL;
ALTER TABLE athleten DROP COLUMN geburtsdatum;
