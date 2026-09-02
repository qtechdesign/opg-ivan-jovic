-- M1: OPG holding polygon. Fields must sit inside this line.
ALTER TABLE farms ADD COLUMN extent_json TEXT;
ALTER TABLE farms ADD COLUMN extent_name TEXT;
ALTER TABLE farms ADD COLUMN extent_ha REAL;
