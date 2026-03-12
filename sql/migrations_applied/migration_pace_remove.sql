-- Migration: pace-Spalte leeren (Werte werden on-the-fly berechnet)
-- Die Spalte bleibt erhalten um Schema-Kompatibilität zu wahren,
-- wird aber nicht mehr befüllt.
UPDATE ergebnisse SET pace = NULL WHERE pace IS NOT NULL AND pace != '';
UPDATE ergebnisse_strasse SET pace = NULL WHERE pace IS NOT NULL AND pace != '';
