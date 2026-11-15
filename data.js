/* Reference geometry, science-layer metadata, and raster-sample validation. */
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
      subtitle: 'Safe Landing Zone',
      x: 100,
      y: 580,
      anchor: 'middle',
      labelX: 100,
      labelY: 628,
      km: 0,
      name: 'Base Camp Alpha',
      tag: 'Safe landing zone',
      note: 'Modeled flat terrain below 2° slope. Communications and rover support are located here.',
      mineralProxies: [
        ['Basaltic material', 55, '#a4522b'],
        ['Iron-oxide unit', 30, '#d9743c'],
        ['Pyroxene proxy', 15, '#9b82b7']
      ]
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
      resourceLabel: 'Ti-Fe unit',
      note: 'Modeled ridge with a Ti-Fe spectral proxy. Loose surface material may affect traverse speed.',
      mineralProxies: [
        ['Ilmenite proxy', 34, '#c49a5b'],
        ['Magnetite proxy', 24, '#6fb6ff'],
        ['Hematite proxy', 20, '#c66f4c'],
        ['Pyroxene proxy', 22, '#9b82b7']
      ]
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
      resourceLabel: 'alteration unit',
      note: 'Volcanic feature with a summit caldera. Hydrated-silica proxy is shown for assessment; local slopes may exceed 10°.',
      mineralProxies: [
        ['Copper-sulfide proxy', 30, '#4e9b86'],
        ['Hydrated silica proxy', 34, '#68a9bd'],
        ['Pyroxene proxy', 20, '#9b82b7'],
        ['Olivine proxy', 16, '#6fdc7f']
      ]
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
      resourceLabel: 'dark dune field',
      note: 'Wind-shaped basaltic dunes. Loose sand may reduce mobility; remain on modeled traverse corridors.',
      mineralProxies: [
        ['Platinum-group proxy', 18, '#b6b6c8'],
        ['Chromite proxy', 26, '#c28b68'],
        ['Magnetite proxy', 30, '#6fb6ff'],
        ['Basaltic material', 26, '#a4522b']
      ]
    }],
    hazard: {
      id: 'haz',
      name: 'Steep crater hazard',
      tag: 'Avoid · modeled slope exceeds 10°',
      x: 400,
      y: 330,
      radius: 120,
      chips: [
        ['Crater depth', '140 m'],
        ['Wall slope', '38°'],
        ['Assessment', 'Avoid']
      ],
      note: 'The mapped traverse follows the northern rim. Terrain and slope values are illustrative model outputs.',
      mineralProxies: []
    },
    layers: {
      mola: {
        id: 'mola',
        label: 'MOLA Topography & Slope Safety',
        instrument: 'Mars Orbiter Laser Altimeter',
        source: 'NASA MGS MOLA archive',
        sourceUrl: 'https://pds-geosciences.wustl.edu/missions/mgs/mola.html',
        thresholdsDeg: {
          safeMaxExclusive: 2,
          cautionMaxInclusive: 10
        }
      },
      thermal: {
        id: 'thermal',
        label: 'THEMIS Thermal & Environment',
        instrument: 'Thermal Emission Imaging System',
        source: 'NASA Mars Odyssey THEMIS archive',
        sourceUrl: 'https://pds-geosciences.wustl.edu/missions/odyssey/themis.html'
      },
      crism: {
        id: 'crism',
        label: 'CRISM Mineral & Geology',
        instrument: 'Compact Reconnaissance Imaging Spectrometer for Mars',
        source: 'NASA MRO CRISM archive',
        sourceUrl: 'https://pds-geosciences.wustl.edu/missions/mro/crism.htm'
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
