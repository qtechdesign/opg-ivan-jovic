-- M1: plot boundary as GeoJSON Polygon (lng, lat). Measured on the land — no invented GPS in seed.
ALTER TABLE plots ADD COLUMN geom_json TEXT;
