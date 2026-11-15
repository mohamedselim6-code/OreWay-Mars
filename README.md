# OreWay

OreWay is a static planetary-surface planning interface for Syrtis Major Planum
(MC-13). The route, terrain relief, mineral proxies, and hazard graphics shown
in the browser are illustrative planning models, not operational data or mission
recommendations.

## Architecture

- `index.html` — accessible page structure and script/style links.
- `style.css` — responsive map, telemetry, drawer, and Day/Night Ops styling.
- `data.js` — Syrtis Major target, modeled stations, route, layer metadata, and optional processed-data validation.
- `telemetry.js` — route and reserve calculations, slope classification, Web Audio cues, and PNG snapshot generation.
- `app.js` — globe and map rendering, controls, map layers, route simulation, and optional JSON loading.
- `nasa_data_processor.py` — summarizes operator-supplied MOLA elevation and optional CRISM index rasters.
- `nasa_surface_data.json` — schema-valid placeholder replaced by processed raster samples when available.

The browser scripts use classic deferred scripts in dependency order: data,
telemetry, then the application controller. For full globe rendering, Three.js
is loaded from a CDN; when unavailable, the page displays a static Mars globe.
NASA Mars Trek tiles load independently of the procedural fallback; delayed or
failed imagery leaves the fallback visible with an updated map status.

## NASA data sources

Use the archives to locate and download products, then verify product documentation, coordinate reference systems, units, and processing history before use:

- [NASA Mars Trek](https://trek.nasa.gov/mars/)
- [MGS MOLA archive](https://pds-geosciences.wustl.edu/missions/mgs/mola.html)
- [Mars Odyssey THEMIS archive](https://pds-geosciences.wustl.edu/missions/odyssey/themis.html)
- [MRO CRISM archive](https://pds-geosciences.wustl.edu/missions/mro/crism.htm)

The included processor does not download data, georeference imagery, classify
minerals, or verify provenance. It requires a site-clipped MOLA raster in a
projected CRS with known linear units, and uses explicit pixel locations rather
than assuming that Mars coordinates can be treated as Earth coordinates. Its
optional CRISM input is a single-band index raster; index values are reported
without assigning a mineral interpretation.

## Process raster summaries

Install the Python dependencies in the environment used for processing:

```text
python -m pip install numpy rasterio
```

Provide pixel columns and rows for the four site markers in the input MOLA raster:

```powershell
python nasa_data_processor.py `
  --mola mola_site.tif `
  --mola-pixel base=120,90 `
  --mola-pixel s1=240,140 `
  --mola-pixel s2=390,210 `
  --mola-pixel s3=510,300 `
  --output nasa_surface_data.json
```

If supplying a CRISM single-band index raster, provide pixel locations for the sites to sample:

```powershell
python nasa_data_processor.py `
  --mola mola_site.tif `
  --mola-pixel base=120,90 `
  --mola-pixel s1=240,140 `
  --mola-pixel s2=390,210 `
  --mola-pixel s3=510,300 `
  --crism crism_index.tif `
  --crism-pixel s1=90,80 `
  --crism-pixel s2=170,135 `
  --output nasa_surface_data.json
```

`--mola-pixel` uses `ID=COLUMN,ROW` and is required once for each of `base`,
`s1`, `s2`, and `s3`. CRISM pixel locations are independent because the rasters
may use different grids. MOLA sample pixels need a valid one-pixel neighborhood
to calculate slope. Elevations default to metres; use `--elevation-unit km` if
the raster stores kilometres. The output contains schema version 1, MOLA
elevation/slope summaries and station samples, and optional raw CRISM index
samples.

The checked-in `nasa_surface_data.json` is a placeholder with no raster samples.
Running the processor with its default output replaces it with the processed
dataset. Over HTTP, the app validates that dataset and displays available site
samples while continuing to label the rendered map as illustrative. When opened
with `file://`, the app skips the optional fetch because browsers restrict local
file requests; use a local HTTP server or static host to load processed samples.

## Static deployment

Deploy the files in this directory to any static host, including Vercel. No
build step is required. The placeholder JSON can remain in the deployment;
replace it with processor output when raster samples are available.
