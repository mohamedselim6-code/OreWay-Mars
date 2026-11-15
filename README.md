# OreWay

OreWay is a static planetary-surface planning interface for Syrtis Major Planum
(MC-13). The overview globe is a visual orientation element. The interactive GIS
map uses NASA Mars Trek orbital layers and keeps configured route geometry
separate from instrument observations.

## Architecture

- `index.html` — accessible page structure and external script/style links.
- `style.css` — responsive map, telemetry, drawer, and Day/Night Ops styling.
- `data.js` — Syrtis Major coordinates, NASA layer endpoints, and product metadata.
- `telemetry.js` — route and reserve calculations, audio cues, and snapshot generation.
- `app.js` — Leaflet map, NASA catalog/API requests, route controls, and telemetry UI.
- `nasa_data_processor.py` — summaries of operator-supplied MOLA and CRISM rasters.
- `nasa_surface_data.json` — optional output from the raster processor.

The browser scripts load in dependency order: `data.js`, `telemetry.js`, then
`app.js`. Three.js and Leaflet are loaded from CDNs. An internet connection is
required for NASA map tiles and live catalog requests.

## NASA data

- **MOLA base map:** NASA Mars Trek
  `Mars_MGS_MOLA_ClrShade_merge_global_463m` color-shaded relief tiles
  (`.jpg`, native zoom through 6).
- **THEMIS overlay:** NASA Mars Trek 100 m controlled Day IR and Night IR
  mosaics (`.png`, native zoom through 9). Night Ops selects the Night IR mosaic.
- **CRISM detections:** NASA Mars Trek hydrous-mineral detections service. The
  app queries CRISM records in a regional Syrtis Major window and plots the
  catalog coordinates. The service's `Type` field is a generic detection class;
  it does not identify a mineral species. Product details are available from
  the linked NASA catalog.
- **Radiation context:** NASA DONKI Solar Energetic Particle (SEP) events from
  the preceding 30 days. The browser uses NASA's public `DEMO_KEY`, which has
  request limits. DONKI events are global space-weather context, not radiation
  measurements at Mars or a surface-dose map.

The HUD risk score is a 0-100 planning index, not a measured exposure value.
It updates with route position and active layers. When a local numeric MOLA
slope sample is available within 250 m, slope contributes up to 60 points;
otherwise MOLA contributes a proximity term (up to 60 points within 1.5 km)
from the bounding envelope of the configured crater-margin exclusion. That
geometry is not a NASA slope or hazard product. Selecting THEMIS adds a
10-point Day Ops or
20-point Night Ops context weight; these are not derived from tile colors or
temperature measurements. DONKI adds 25 points when SEP events are reported,
10 while event status is loading or unavailable, and zero when the query
reports none. DONKI remains global event context, not local Mars surface dose.
The score is capped at 100 and color-coded green below 30, yellow from 30
through 70, and red above 70. Numeric MOLA samples, THEMIS temperatures, and
local radiation dose are not inferred from rendered imagery or global events.

## Optional raster summaries

The processor accepts already prepared rasters; it does not download data,
georeference images, classify minerals, or validate product provenance. Confirm
the product documentation, coordinate system, and units before processing.
Install dependencies with:

```text
python -m pip install numpy rasterio
```

Provide pixel locations for the four waypoints:

```powershell
python nasa_data_processor.py `
  --mola mola_site.tif `
  --mola-pixel base=120,90 `
  --mola-pixel s1=240,140 `
  --mola-pixel s2=390,210 `
  --mola-pixel s3=510,300 `
  --output nasa_surface_data.json
```

An optional single-band CRISM index raster can be supplied with `--crism` and
`--crism-pixel ID=COLUMN,ROW`. Index values are reported without assigning a
mineral interpretation. MOLA samples need a valid one-pixel neighborhood for
slope calculation; elevations default to metres.

## Deployment

Deploy this directory to a static host such as Vercel. No build step is required.
Use a local HTTP server during development so the optional JSON dataset can be
loaded; the browser skips that local-file request under `file://`.
