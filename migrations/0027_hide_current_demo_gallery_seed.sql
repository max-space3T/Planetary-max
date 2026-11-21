-- Migration 0016 recognizes an earlier set of image URLs. Hide the exact
-- unchanged, unpurchased examples from 0004 as well, including on databases
-- where 0016 has already run. Preserve edited and purchased artwork.
UPDATE artworks SET is_demo = 1
WHERE is_demo = 0 AND metadata_hash IS NULL AND fulfillment_uri IS NULL
  AND NOT EXISTS (SELECT 1 FROM marketplace_orders WHERE artwork_id = artworks.id)
  AND NOT EXISTS (SELECT 1 FROM transactions WHERE artwork_id = artworks.id)
  AND (
    (id = 'art_001' AND artist_id = 'artist_1' AND title = 'Signal Bloom' AND medium = 'Digital print' AND dimensions = '36 x 48 in' AND price_cents = 1800 AND status = 'available' AND image_url = 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1400&q=85')
    OR (id = 'art_002' AND artist_id = 'artist_1' AND title = 'Afterimage Atlas' AND medium = 'Mixed media' AND dimensions = '24 x 36 in' AND price_cents = 2400 AND status = 'available' AND image_url = 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?auto=format&fit=crop&w=1400&q=85')
    OR (id = 'art_003' AND artist_id = 'artist_2' AND title = 'Lunar Archive' AND medium = 'Archival pigment print' AND dimensions = '30 x 40 in' AND price_cents = 2100 AND status = 'reserved' AND image_url = 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=1400&q=85')
    OR (id = 'art_004' AND artist_id = 'artist_3' AND title = 'Static Horizon' AND medium = 'Acrylic and ink' AND dimensions = '22 x 30 in' AND price_cents = 1600 AND status = 'available' AND image_url = 'https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?auto=format&fit=crop&w=1400&q=85')
  );
