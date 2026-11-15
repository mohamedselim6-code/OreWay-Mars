/* Mission geometry, NASA data endpoints, and raster-sample validation. */
(function (global) {
  'use strict';
  var data = {
    target: {
      name: 'Syrtis Major Planum',
      quadrangle: 'MC-13',
      lat: 8.4,
      lon: 69.5,
      latitude: 8.4,
      longitude: 69.5
    },
    map: {
      width: 800,
      height: 700,
      longitudeSpan: 0.125,
      latitudeSpan: 0.108,
      route: 'M100,580 C150,540 210,450 250,400 C250,260 400,170 560,230 C660,265 740,340 690,450',
      traverseKm: 8.3,
      returnMinutes: 120
    },
    stations: [{
      id: 'base',
      marker: 'A',
      label: 'Base Camp Alpha',
      subtitle: 'Landing Reference',
      x: 100,
      y: 580,
      anchor: 'middle',
      labelX: 100,
      labelY: 628,
      km: 0,
      name: 'Base Camp Alpha',
      tag: 'Landing reference point',
      note: 'Configured landing and communications reference point. Confirm terrain conditions against the source products before mission use.'
    }, {
      id: 's1',
      marker: '1',
      label: 'Site 1',
      subtitle: 'Ti-Fe Ridge',
      x: 250,
      y: 400,
      anchor: 'end',
      labelX: 214,
      labelY: 392,
      km: 2.4,
      name: 'Site 1: Ti-Fe ridge',
      tag: 'Mineral assessment area',
      note: 'Configured mineral-assessment waypoint. No species-level composition is verified for this site in the regional CRISM catalog.'
    }, {
      id: 's2',
      marker: '2',
      label: 'Site 2',
      subtitle: 'Nili Patera',
      x: 560,
      y: 230,
      anchor: 'start',
      labelX: 596,
      labelY: 204,
      km: 5.5,
      name: 'Site 2: Nili Patera',
      tag: 'Alteration assessment area',
      note: 'Configured alteration-assessment waypoint. The regional CRISM service does not report a species-level detection at this coordinate.'
    }, {
      id: 's3',
      marker: '3',
      label: 'Site 3',
      subtitle: 'Dark Dunes',
      x: 690,
      y: 450,
      anchor: 'end',
      labelX: 650,
      labelY: 444,
      km: 8.3,
      name: 'Site 3: Dark dunes',
      tag: 'Dune field assessment area',
      note: 'Configured dune-avoidance waypoint. The exclusion geometry is a mission-planning feature, not a current NASA hazard product.'
    }],
    hazard: {
      id: 'haz',
      name: 'Crater-margin planning exclusion',
      tag: 'Planning feature · slope not evaluated',
      x: 400,
      y: 330,
      radius: 120,
      chips: [
        ['Feature', 'Planning exclusion'],
        ['Slope data', 'Not evaluated']
      ],
      note: 'This exclusion geometry is configured for route planning. The MOLA color-shaded mosaic is not a slope-classification product.'
    },
    layers: {
      mola: {
        id: 'mola',
        label: 'MOLA Color-Shaded Relief',
        instrument: 'Mars Orbiter Laser Altimeter',
        source: 'NASA Mars Trek · MGS MOLA color-shaded relief',
        sourceUrl: 'https://trek.nasa.gov/mars/',
        tileUrl: 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg',
        maxNativeZoom: 6
      },
      thermal: {
        id: 'thermal',
        label: 'THEMIS Thermal & Environment',
        instrument: 'Thermal Emission Imaging System',
        source: 'NASA Mars Trek · THEMIS controlled IR mosaics',
        sourceUrl: 'https://trek.nasa.gov/mars/',
        dayTileUrl: 'https://trek.nasa.gov/tiles/Mars/EQ/THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018/1.0.0/default/default028mm/{z}/{y}/{x}.png',
        nightTileUrl: 'https://trek.nasa.gov/tiles/Mars/EQ/THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018/1.0.0/default/default028mm/{z}/{y}/{x}.png',
        maxNativeZoom: 9
      },
      crism: {
        id: 'crism',
        label: 'CRISM Mineral & Geology',
        instrument: 'Compact Reconnaissance Imaging Spectrometer for Mars',
        source: 'NASA Mars Trek hydrous-mineral detections catalog',
        sourceUrl: 'https://trek.nasa.gov/mars/trekarcgis/rest/services/Hydrous_Mineral_Detections_OMEGA_CRISM_clon0/MapServer/0',
        queryUrl: 'https://trek.nasa.gov/mars/trekarcgis/rest/services/Hydrous_Mineral_Detections_OMEGA_CRISM_clon0/MapServer/0/query',
        regionalBounds: {
          south: 5,
          north: 12,
          west: 64,
          east: 75
        },
        classificationNote: 'Catalog classification only; species-level composition is not provided.'
      },
      radiation: {
        id: 'radiation',
        label: 'Radiation Risk',
        instrument: 'Solar Energetic Particle events',
        source: 'NASA DONKI',
        sourceUrl: 'https://api.nasa.gov/DONKI/SEP',
        lookbackDays: 30,
        limitation: 'Event context only; DONKI does not provide local Mars surface dose.'
      }
    },
    processed: null,
    getProcessedStation: function (id) {
      if (!this.processed) {
        return null;
      }
      for (var i = 0; i < this.processed.stations.length; i += 1) {
        if (this.processed.stations[i].id === id) {
          return this.processed.stations[i];
        }
      }
      return null;
    },
    setProcessedDataset: function (dataset) {
      if (
        !dataset ||
        dataset.schemaVersion !== 1 ||
        !dataset.layers ||
        !dataset.layers.mola ||
        !Array.isArray(dataset.stations) ||
        dataset.stations.length === 0
      ) {
        throw new TypeError('Processed Mars dataset does not match schema version 1.');
      }
      var seen = {};
      dataset.stations.forEach(function (station) {
        var knownStation = station && this.stations.some(function (known) {
          return known.id === station.id;
        });
        var hasValidCrismValue = station && (
          station.crismBandValue === null ||
          station.crismBandValue === undefined ||
          (
            typeof station.crismBandValue === 'number' &&
            isFinite(station.crismBandValue)
          )
        );
        if (
          !station ||
          typeof station.id !== 'string' ||
          seen[station.id] ||
          !knownStation ||
          typeof station.elevationMeters !== 'number' ||
          !isFinite(station.elevationMeters) ||
          typeof station.slopeDegrees !== 'number' ||
          !isFinite(station.slopeDegrees) ||
          station.slopeDegrees < 0 ||
          station.slopeDegrees > 90 ||
          !hasValidCrismValue
        ) {
          throw new TypeError('Processed Mars dataset contains an invalid station sample.');
        }
        seen[station.id] = true;
      }, this);
      this.processed = dataset;
    }
  };
  global.OreWayData = data;
}
(window));
