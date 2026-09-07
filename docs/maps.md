# Maps

## Layer 1: Basemap
This contains streets, terrain, and city labels.

Options:
- Carto Positron: free for non-commercial civic apps. No API key needed. Our likely pick for now.
- Stadia Maps: requires a free API key.
- Self-hosted PMTiles: ~15-20MB for all cities and roads is SW Ohio, stored right in the repo.
- Google Maps: not a good fit, due to the need for API keys, billing, etc. Usage cost would likely be low or simply in the free tier, but it would be additional work to manage for anyone making a fork to work on.

Tracking historical information at this layer is not a priority.

## Layer 2: Geographic Context
**Counties:** Available from US Census Bureau TIGER or Ohio Geographically Referenced Information Program (OGRIP)
**AES service territory outline:** Available from the US Energy Information Administration (EIA)

These should be periodically updated. AES service area should maybe retain historical versions, but counties should be stable enough for any changes to be noise.

## Layer 3: Outage Incidents
This is the outage data; see [schema.md](schema.md)
