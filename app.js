/* Render the overview globe and start the surface-navigation transition. */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* === 1. Procedural Mars texture === */
  function hash(x, y, z) {
    var h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function lerp(a, b, t) {
    return a + (b - a) * t
  }
  function fade(t) {
    return t * t * (3 - 2 * t)
  }
  function noise(x, y, z) {
    var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), u = fade(x - xi), v = fade(y - yi), w = fade(z - zi);
    var lower = lerp(
      lerp(hash(xi, yi, zi), hash(xi + 1, yi, zi), u),
      lerp(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), u),
      v
    );
    var upper = lerp(
      lerp(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), u),
      lerp(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), u),
      v
    );
    return lerp(lower, upper, w);
  }
  function fbm(x, y, z, o) {
    var a = .5, f = 1, s = 0, t = 0;
    for (var i = 0; i < o; i++) {
      s += a * noise(x * f, y * f, z * f);
      t += a;
      a *= .5;
      f *= 2.05
    }
    return s / t;
  }
  function sstep(a, b, x) {
    var t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t)
  }
  function mix(c1, c2, t) {
    return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]
  }
  var SYR = window.OreWayData.target;
  window.__ore = {
    fbm: fbm,
    sstep: sstep,
    mix: mix
  };
  function makeMars() {
    var W = 1024, H = 512;
    var c = document.createElement('canvas');
    var b = document.createElement('canvas');
    c.width = b.width = W;
    c.height = b.height = H;
    var cx = c.getContext('2d');
    var bx = b.getContext('2d');
    var ci = cx.createImageData(W, H);
    var bi = bx.createImageData(W, H);
    var rustD = [118, 52, 30];
    var rustL = [204, 112, 66];
    var ochre = [226, 166, 116];
    var maria = [74, 40, 32];
    var basalt = [26, 18, 22];
    var ice = [240, 244, 247];
    for (var j = 0; j < H; j++) {
      var lat = 90 - (j + .5) / H * 180, la = lat * Math.PI / 180;
      for (var i = 0; i < W; i++) {
        var lon = (i + .5) / W * 360 - 180;
        var lo = lon * Math.PI / 180;
        var x = Math.cos(la) * Math.cos(lo);
        var y = Math.sin(la);
        var z = Math.cos(la) * Math.sin(lo);
        var n1 = fbm(x * 2.4, y * 2.4, z * 2.4, 4);
        var n2 = fbm(x * 9 + 7, y * 9, z * 9, 3);
        var n3 = fbm(x * 1.5 + 11, y * 1.5, z * 1.5 + 3, 3);
        var t = n1 * .62 + n2 * .38;
        var col = mix(rustD, rustL, sstep(.3, .7, t));
        col = mix(col, ochre, sstep(.66, .85, t) * .7);
        col = mix(col, maria, sstep(.52, .64, n3) * .55);
        /* Syrtis Major: elongated dark region */
        var dl = ((lon - SYR.lon + 540) % 360) - 180, dt = lat - SYR.lat;
        var r2 = (dl / 10) * (dl / 10) + (dt / 19) * (dt / 19);
        var m = sstep(.22, .62, Math.exp(-r2 * (1 + (n2 - .5) * 1.3)));
        col = mix(col, basalt, m * .94);
        var cap = Math.abs(lat) - (81 + n2 * 4);
        if (cap > 0) col = mix(col, ice, sstep(0, 3, cap));
        var p = (j * W + i) * 4;
        ci.data[p] = col[0];
        ci.data[p + 1] = col[1];
        ci.data[p + 2] = col[2];
        ci.data[p + 3] = 255;
        var h = Math.max(0, Math.min(255, (t - m * .15) * 300));
        bi.data[p] = bi.data[p + 1] = bi.data[p + 2] = h;
        bi.data[p + 3] = 255;
      }
    }
    cx.putImageData(ci, 0, 0);
    bx.putImageData(bi, 0, 0);
    return {
      color: c,
      bump: b
    };
  }
  /* === 2. Three.js globe and overview controls === */
  var stage = document.getElementById('stage');
  var host = document.getElementById('globe');
  var ret = document.getElementById('reticle');
  if (!window.THREE) {
    window.__oreResume = function () {
      host.classList.add('on')
    };
    stage.classList.add('nogl');
    host.classList.add('on');
    var r = stage.getBoundingClientRect();
    ret.style.opacity = 1;
    ret.style.transform = 'translate(' + (r.width * .58) + 'px,' + (r.height * .5) + 'px) translate(-50%,-50%)';
    return;
  }
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(30, 1, .1, 50);
  var renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
  });
  camera.position.z = 4.6;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  host.appendChild(renderer.domElement);
  var tex = makeMars();
  var map = new THREE.CanvasTexture(tex.color);
  var bump = new THREE.CanvasTexture(tex.bump);
  map.encoding = THREE.sRGBEncoding;
  map.anisotropy = renderer.capabilities.getMaxAnisotropy();
  var pivot = new THREE.Group();
  pivot.rotation.x = .2;
  scene.add(pivot);
  var globe = new THREE.Group();
  pivot.add(globe);
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshStandardMaterial({
    map: map,
    bumpMap: bump,
    bumpScale: .035,
    roughness: 1,
    metalness: 0
  })));
  /* Syrtis Major marker, in the same UV space as the texture */
  var phi = (SYR.lon + 180) / 360 * Math.PI * 2;
  var th = (90 - SYR.lat) / 180 * Math.PI;
  var sv = new THREE.Vector3(
    -Math.cos(phi) * Math.sin(th),
    Math.cos(th),
    Math.sin(phi) * Math.sin(th)
  );
  var marker = new THREE.Object3D();
  marker.position.copy(sv);
  globe.add(marker);
  marker.add(new THREE.Mesh(new THREE.SphereGeometry(.013, 16, 16), new THREE.MeshBasicMaterial({
    color: 0x3dff8f
  })));
  var ring = new THREE.Mesh(new THREE.RingGeometry(.045, .054, 48), new THREE.MeshBasicMaterial({
    color: 0x3dff8f,
    transparent: true,
    opacity: .9,
    side: THREE.DoubleSide,
    depthWrite: false
  }));
  ring.position.copy(sv).multiplyScalar(.004);
  ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), sv);
  marker.add(ring);
  /* dusty atmosphere glow */
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.14, 64, 48), new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexShader: [
      'varying vec3 vN;',
      'void main() {',
      '  vN = normalize(normalMatrix * normal);',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}'
    ].join('\n'),
    fragmentShader: [
      'varying vec3 vN;',
      'void main() {',
      '  float intensity = clamp(pow(max(0.0, 0.62 - dot(vN, vec3(0.0, 0.0, 1.0))), 3.0), 0.0, 1.0);',
      '  gl_FragColor = vec4(1.0, 0.45, 0.25, 1.0) * intensity * 1.1;',
      '}'
    ].join('\n')
  })));
  var sun = new THREE.DirectionalLight(0xfff0e0, 1.7);
  sun.position.set(-3, 1.6, 3.2);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x6f8fb0, .42));
  function resize() {
    var r = stage.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize);
  /* rotation: face Syrtis Major at rest, drift on, slow down when it faces us */
  var psi = Math.atan2(sv.x, sv.z);
  var spin = reduce ? 0 : -2.3;
  var dragging = false;
  var lastX = 0;
  var cv = renderer.domElement;
  cv.addEventListener('pointerdown', function (e) {
    dragging = true;
    lastX = e.clientX;
    cv.setPointerCapture(e.pointerId)
  });
  cv.addEventListener('pointermove', function (e) {
    if (dragging) {
      spin += (e.clientX - lastX) * .007;
      lastX = e.clientX
    }
  });
  ['pointerup', 'pointercancel'].forEach(function (n) {
    cv.addEventListener(n, function () {
      dragging = false
    })
  });
  var wp = new THREE.Vector3();
  var prev = performance.now();
  var t0 = prev;
  var frameQueued = false;
  function scheduleFrame() {
    if (frameQueued || window.__oreHold) return;
    frameQueued = true;
    requestAnimationFrame(function (now) {
      frameQueued = false;
      frame(now)
    });
  }
  function frame(now) {
    var dt = Math.min((now - prev) / 1000, .05);
    prev = now;
    scene.updateMatrixWorld();
    marker.getWorldPosition(wp);
    if (!dragging && !reduce) {
      var away = 1 - Math.max(wp.z, 0);
      spin += dt * (.07 + .55 * away * away);
    }
    globe.rotation.y = -psi + spin;
    ring.scale.setScalar(1 + .35 * Math.sin((now - t0) / 380));
    ring.material.opacity = .55 + .35 * Math.sin((now - t0) / 380);
    scene.updateMatrixWorld();
    marker.getWorldPosition(wp);
    var v = wp.clone().project(camera);
    var r = stage.getBoundingClientRect();
    var px = (v.x * .5 + .5) * r.width;
    var py = (-v.y * .5 + .5) * r.height;
    var vis = sstep(.1, .35, wp.z);
    ret.style.opacity = vis;
    ret.style.transform = 'translate(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px) translate(-50%,-50%)';
    ret.classList.toggle('flip', px > r.width * .58);
    renderer.render(scene, camera);
    scheduleFrame();
  }
  window.__oreResume = function () {
    window.__oreHold = false;
    prev = performance.now();
    scheduleFrame();
  };
  requestAnimationFrame(function (n) {
    prev = n;
    t0 = n;
    host.classList.add('on');
    frame(n)
  });
  /* === 3. Surface initialization === */
  var btn = document.getElementById('start');
  var msg = document.getElementById('msg');
  btn.addEventListener('click', function () {
    btn.disabled = true;
    btn.textContent = 'Initializing telemetry...';
    setTimeout(function () {
      btn.textContent = 'Telemetry initialized';
      msg.textContent = 'Loading the Syrtis Major surface model';
      document.dispatchEvent(new CustomEvent('oreway:start'));
    }, 1100);
  });
})();
/* Coordinate map layers, route state, mission controls, and telemetry. */
(function () {
  'use strict';

  var O = window.__ore;
  var D = window.OreWayData;
  var Telemetry = window.OreWayTelemetry;
  var $ = function (s) {
    return document.querySelector(s)
  }, $$ = function (s) {
    return Array.prototype.slice.call(document.querySelectorAll(s))
  };
  var NS = 'http://www.w3.org/2000/svg', reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ST = D.stations.map(function (station) {
    return {
      id: station.id,
      g: station.marker,
      l1: station.label,
      l2: station.subtitle,
      x: station.x,
      y: station.y,
      ax: station.anchor,
      lx: station.labelX,
      ly: station.labelY,
      km: station.km,
      name: station.name,
      tag: station.tag,
      note: station.note,
      m: station.mineralProxies,
      mine: station.resourceLabel,
      routeLength: 0
    };
  });
  var hazardData = D.hazard;
  var HAZ = {
    id: hazardData.id,
    name: hazardData.name,
    tag: hazardData.tag,
    chips: hazardData.chips,
    note: hazardData.note,
    m: hazardData.mineralProxies
  };
  function fmt(k) {
    return '~' + Telemetry.traverseMetrics(k, D.map.traverseKm, 15, D.map.returnMinutes).returnMinutes + ' min'
  }
  function el(n, a, p) {
    var e = document.createElementNS(NS, n);
    for (var k in a) e.setAttribute(k, a[k]);
    if (p) p.appendChild(e);
    return e
  }
  /* === 4. Fallback map and station model === */
  var gr = $('#grid'), map = D.map, target = D.target;
  for (var gx = 0; gx <= map.width; gx += 100) {
    el('line', {
      x1: gx,
      y1: 0,
      x2: gx,
      y2: map.height,
      stroke: 'rgba(226,232,240,.12)',
      'stroke-width': 1
    }, gr);
    if (gx > 0 && gx < map.width) el('text', {
      x: gx + 4,
      y: 16,
      class: 'gl'
    }, gr).textContent = (target.longitude + (gx - map.width / 2) / map.width * map.longitudeSpan).toFixed(3) + '°E'
  }
  for (var gy = 0; gy <= map.height; gy += 100) {
    el('line', {
      x1: 0,
      y1: gy,
      x2: map.width,
      y2: gy,
      stroke: 'rgba(226,232,240,.12)',
      'stroke-width': 1
    }, gr);
    if (gy > 0 && gy < map.height) el('text', {
      x: 4,
      y: gy - 5,
      class: 'gl'
    }, gr).textContent = (target.latitude + (map.height / 2 - gy) / map.height * map.latitudeSpan).toFixed(3) + '°N'
  }
  el('text', {
    x: 748,
    y: 60,
    class: 'gl',
    'font-size': 22
  }, gr).textContent = 'N ↑';
  /* route + stations */
  var route = $('#route'), routeD = $('#routeD');
  route.setAttribute('d', map.route);
  routeD.setAttribute('d', map.route);
  var TL = route.getTotalLength();
  ST.forEach(function (s) {
    var best = 1e9;
    for (var L = 0; L <= TL; L += 3) {
      var p = route.getPointAtLength(L), d = Math.hypot(p.x - s.x, p.y - s.y);
      if (d < best) {
        best = d;
        s.len = L
      }
    }
    if (s.id === 'base') s.len = 0;
    if (s.id === 's3') s.len = TL;
    s.routeLength = s.len;
    var g = el('g', {
      class: 'sta',
      tabindex: 0,
      role: 'button',
      'data-id': s.id,
      'aria-label': s.l1 + ', ' + s.l2
    }, $('#stations'));
    el('circle', {
      cx: s.x,
      cy: s.y - 34,
      r: 44,
      fill: 'transparent'
    }, g);
    el('path', {
      d: 'M0 0C-6-14-26-26-26-46a26 26 0 1 1 52 0C26-26 6-14 0 0Z',
      transform: 'translate(' + s.x + ',' + s.y + ')',
      class: 'ring'
    }, g);
    el('text', {
      x: s.x,
      y: s.y - 37,
      'text-anchor': 'middle',
      class: 'gy'
    }, g).textContent = s.g;
    el('text', {
      x: s.lx,
      y: s.ly,
      'text-anchor': s.ax,
      class: 't1'
    }, g).textContent = s.l1;
    el('text', {
      x: s.lx,
      y: s.ly + 29,
      'text-anchor': s.ax,
      class: 't2'
    }, g).textContent = s.l2;
    g.addEventListener('click', function () {
      pick(s.id)
    });
    g.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pick(s.id)
      }
    });
  });
  function kmAt(L) {
    return Telemetry.distanceAtRouteLength(L, ST, map.traverseKm)
  }
  /* === 5. Leaflet GIS layers and geographic mission features === */
  var GIS_STATIONS = {
    base: [8.400, 69.500],
    s1: [8.418, 69.522],
    s2: [8.435, 69.485],
    s3: [8.382, 69.470]
  };
  var GIS_STATION_NAMES = {
    base: 'Base Camp Alpha',
    s1: 'Site 1: Ti-Fe Ridge',
    s2: 'Site 2: Nili Patera',
    s3: 'Site 3: Dark Dunes'
  };
  var GIS_STATION_POPUPS = {
    s1: 'Ti-Fe Ridge: Iron & Titanium. Safe extraction zone.',
    s2: 'Nili Patera: Hydrated Silica (Opal) detected by CRISM. Ancient hydrothermal vent. Age: ~2.46 Ga.',
    s3: 'Dark Dunes: Hazardous, moving sand dunes. Avoid.'
  };
  var GIS_ROUTE = ST.map(function (station) {
    return GIS_STATIONS[station.id]
  });
  var GIS_BASE_TILES = 'https://trek.nasa.gov/tiles/Mars/EQ/msss_atlas_simp_clon/1.0.0/default/default028mm/{z}/{y}/{x}.png';
  var GIS_MOLA_TILES = 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg';
  var gisMap = null;
  var gisBaseLayer = null;
  var gisMolaLayer = null;
  var gisRouteLayer = null;
  var gisHazardLayer = null;
  var gisAstronaut = null;
  var gisRadarCircle = null;
  var gisRadarRenderer = null;
  var gisDuneWarningPopup = null;
  var gisGuideLayer = null;
  var gisCanvasLayers = {};
  var gisTilesReady = false;
  var gisTileTimeout = 0;
  var GIS_DUNE_WARNING =
    'WARNING: Approaching Hazard Zone (Dark Dunes). Reroute Recommended.';
  var GIS_DUNE_WARNING_DISTANCE_M = 600;
  var GIS_RADAR_RADIUS_M = 250;
  var GIS_HAZARD = [
    [8.416, 69.495],
    [8.416, 69.501],
    [8.412, 69.504],
    [8.408, 69.501],
    [8.408, 69.495],
    [8.412, 69.492]
  ];
  function marsDistance(a, b) {
    var radians = Math.PI / 180;
    var lat1 = a.lat * radians;
    var lat2 = b.lat * radians;
    var dLat = (b.lat - a.lat) * radians;
    var dLon = (b.lng - a.lng) * radians;
    var sinHalfLat = Math.sin(dLat / 2);
    var sinHalfLon = Math.sin(dLon / 2);
    var haversine = sinHalfLat * sinHalfLat +
      Math.cos(lat1) * Math.cos(lat2) * sinHalfLon * sinHalfLon;
    return 2 * 3389500 * Math.asin(Math.min(1, Math.sqrt(haversine)));
  }
  function setMapStatus(message) {
    $('#dataStatus').textContent = message
  }
  function setupGisMap() {
    if (gisMap) {
      setTimeout(function () {
        gisMap.invalidateSize()
      }, 350);
      return;
    }
    if (!window.L) {
      setMapStatus('Leaflet unavailable · illustrative relief active');
      return;
    }
    var L = window.L;
    var marsCrs = L.extend({
    }, L.CRS.EPSG4326, {
      code: 'MARS:EQUIRECTANGULAR',
      distance: marsDistance
    });
    gisMap = L.map('leafletMap', {
      crs: marsCrs,
      minZoom: 8,
      maxZoom: 12,
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true,
      maxBoundsViscosity: 1
    }).setView(GIS_STATIONS.base, 11);
    gisMap.setMaxBounds([[-90, -180], [90, 180]]);
    gisMap.createPane('illustrativeRasters');
    gisMap.getPane('illustrativeRasters').style.zIndex = 350;
    L.control.zoom({
      position: 'topleft'
    }).addTo(gisMap);
    L.control.scale({
      position: 'bottomleft',
      metric: true,
      imperial: false,
      maxWidth: 120
    }).addTo(gisMap);
    gisBaseLayer = L.tileLayer(GIS_BASE_TILES, {
      minZoom: 8,
      maxZoom: 12,
      maxNativeZoom: 6,
      tileSize: 256,
      attribution: 'Imagery: <a href="https://trek.nasa.gov/mars/">NASA Mars Trek · MGS MOC</a>'
    }).addTo(gisMap);
    // Keep procedural relief visible until imagery arrives or the timeout expires.
    gisBaseLayer.on('tileload', function () {
      if (gisTilesReady) return;
      clearTimeout(gisTileTimeout);
      gisTileTimeout = 0;
      gisTilesReady = true;
      $('#world').classList.add('tiles-ready');
      $('#mapFallback').setAttribute('aria-hidden', 'true');
      setMapStatus('NASA Mars Trek · MGS MOC global mosaic');
    });
    gisBaseLayer.on('tileerror', function () {
      if (!gisTilesReady) {
        clearTimeout(gisTileTimeout);
        gisTileTimeout = 0;
        setMapStatus('NASA tiles unavailable · illustrative relief active');
      }
    });
    gisTileTimeout = setTimeout(function () {
      if (!gisTilesReady) {
        setMapStatus('NASA imagery delayed · illustrative relief active');
      }
    }, 8000);
    gisMolaLayer = L.tileLayer(GIS_MOLA_TILES, {
      minZoom: 8,
      maxZoom: 12,
      maxNativeZoom: 7,
      tileSize: 256,
      opacity: .38,
      attribution: 'Topography: <a href="https://pds-geosciences.wustl.edu/missions/mgs/mola.html">NASA MGS MOLA</a>'
    }).addTo(gisMap);
    gisRouteLayer = L.polyline(GIS_ROUTE, {
      color: '#10B981',
      weight: 4,
      opacity: .92,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(gisMap);
    gisRouteLayer.bindTooltip('Safe traverse · 8.3 km');
    gisHazardLayer = L.polygon(GIS_HAZARD, {
      color: '#EF4444',
      weight: 2,
      opacity: .95,
      fillColor: '#EF4444',
      fillOpacity: .2
    }).addTo(gisMap);
    gisHazardLayer.bindTooltip('Crater hazard · modeled steep terrain');
    gisHazardLayer.on('click', function () {
      pick('haz')
    });
    ST.forEach(function (station) {
      var marker = L.marker(GIS_STATIONS[station.id], {
        title: GIS_STATION_NAMES[station.id],
        icon: L.divIcon({
          className: 'gis-waypoint-icon',
          html: '<span role="img" aria-label="' + GIS_STATION_NAMES[station.id] + '">' + station.g + '</span>',
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        })
      }).addTo(gisMap);
      if (GIS_STATION_POPUPS[station.id]) {
        var popupContent = document.createElement('div');
        popupContent.className = 'gis-popup-copy';
        popupContent.textContent = GIS_STATION_POPUPS[station.id];
        marker.bindPopup(popupContent, {
          className: 'gis-science-popup'
        });
      }
      marker.bindTooltip(GIS_STATION_NAMES[station.id], {
        direction: 'top',
        offset: [0, -10]
      });
      marker.on('click', function () {
        pick(station.id)
      });
    });
    gisAstronaut = L.marker(GIS_STATIONS.base, {
      draggable: true,
      title: 'EVA astronaut',
      icon: L.divIcon({
        className: 'gis-astronaut-icon',
        html: '<span role="img" aria-label="Movable EVA astronaut">EV</span>',
        iconSize: [28, 28],
        iconAnchor: [14, 26]
      })
    }).addTo(gisMap);
    gisAstronaut.on('dragend', function () {
      var point = gisMap.latLngToLayerPoint(gisAstronaut.getLatLng());
      var bestDistance = Infinity;
      var bestLength = cur;
      for (var i = 1; i < ST.length; i++) {
        var start = ST[i - 1];
        var end = ST[i];
        var a = gisMap.latLngToLayerPoint(GIS_STATIONS[start.id]);
        var b = gisMap.latLngToLayerPoint(GIS_STATIONS[end.id]);
        var dx = b.x - a.x;
        var dy = b.y - a.y;
        var lengthSquared = dx * dx + dy * dy;
        var fraction = lengthSquared ? Math.max(
          0,
          Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared)
        ) : 0;
        var nearest = L.point(a.x + fraction * dx, a.y + fraction * dy);
        var distance = point.distanceTo(nearest);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestLength = start.routeLength + fraction * (end.routeLength - start.routeLength);
        }
      }
      resetWalkSimulation();
      stopAuto();
      cancelAnimationFrame(anim);
      cur = bestLength;
      place();
    });
    gisMap.on('mousemove', function (event) {
      var point = event.latlng;
      var latitudeHemisphere = point.lat < 0 ? 'S' : 'N';
      var longitudeHemisphere = point.lng < 0 ? 'W' : 'E';
      $('#cursorLatLon').textContent =
        point.lat.toFixed(3) + '°' + latitudeHemisphere + ' · ' +
        point.lng.toFixed(3) + '°' + longitudeHemisphere;
    });
    gisMap.on('mouseout', function () {
      $('#cursorLatLon').textContent = 'Cursor: --'
    });
    gisMap.whenReady(function () {
      setTimeout(function () {
        gisMap.invalidateSize()
      }, 350)
    });
    installCanvasGisLayers();
  }
  function gisPositionAtRouteLength(length) {
    for (var i = 1; i < ST.length; i++) {
      var start = ST[i - 1], end = ST[i];
      if (length <= end.routeLength) {
        var segment = end.routeLength - start.routeLength;
        var fraction = segment > 0
          ? Math.max(0, Math.min(1, (length - start.routeLength) / segment))
          : 0;
        var a = GIS_STATIONS[start.id];
        var b = GIS_STATIONS[end.id];
        return window.L.latLng(a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction);
      }
    }
    var last = GIS_STATIONS[ST[ST.length - 1].id];
    return window.L.latLng(last[0], last[1]);
  }
  function syncGisSimulation() {
    if (!gisMap || !gisAstronaut) return null;
    var position = gisPositionAtRouteLength(cur);
    gisAstronaut.setLatLng(position);
    if (walkSimulationActive) {
      if (!gisRadarCircle) {
        if (!gisRadarRenderer) gisRadarRenderer = window.L.svg();
        gisRadarCircle = window.L.circle(position, {
          className: 'gis-radar-circle',
          renderer: gisRadarRenderer,
          radius: GIS_RADAR_RADIUS_M,
          color: '#10B981',
          weight: 2,
          opacity: .85,
          fillColor: '#10B981',
          fillOpacity: .14,
          interactive: false
        }).addTo(gisMap);
      } else {
        gisRadarCircle.setLatLng(position);
      }
    } else if (gisRadarCircle && gisMap.hasLayer(gisRadarCircle)) {
      gisMap.removeLayer(gisRadarCircle);
    }
    if (guide) {
      if (!gisGuideLayer) gisGuideLayer = window.L.polyline([], {
        color: '#38BDF8',
        weight: 3,
        opacity: .9,
        dashArray: '7 7'
      });
      var base = window.L.latLng(GIS_STATIONS.base);
      var crossesHazard = false;
      for (var i = 0; i <= 20; i++) {
        var fraction = i / 20;
        var sample = window.L.latLng(
          position.lat + (base.lat - position.lat) * fraction,
          position.lng + (base.lng - position.lng) * fraction
        );
        if (gisHazardLayer.getBounds().contains(sample)) {
          crossesHazard = true;
          break
        }
      }
      gisGuideLayer.setStyle({
        color: crossesHazard ? '#EF4444': '#38BDF8'
      });
      gisGuideLayer.setLatLngs([position, base]);
      if (!gisMap.hasLayer(gisGuideLayer)) gisGuideLayer.addTo(gisMap);
    } else if (gisGuideLayer && gisMap.hasLayer(gisGuideLayer)) {
      gisMap.removeLayer(gisGuideLayer);
    }
    return position;
  }
  function installCanvasGisLayers() {
    if (!gisMap || !built) return;
    var bounds = [
      [target.latitude - map.latitudeSpan / 2, target.longitude - map.longitudeSpan / 2],
      [target.latitude + map.latitudeSpan / 2, target.longitude + map.longitudeSpan / 2]
    ];
    ['thermal', 'crism'].forEach(function (id) {
      if (gisCanvasLayers[id]) return;
      var canvas = $('#c_' + id), overlay = window.L.imageOverlay(canvas.toDataURL(), bounds, {
        pane: 'illustrativeRasters',
        opacity: .5,
        interactive: false,
        alt: id === 'thermal' ? 'Illustrative THEMIS thermal proxy': 'Illustrative CRISM spectral proxy'
      });
      gisCanvasLayers[id] = overlay;
      var control = $('.sw[data-l="' + id + '"]');
      if (control && control.getAttribute('aria-checked') === 'true') overlay.addTo(gisMap);
    });
  }
  /* === 6. Traverse position and mission readouts === */
  var cur = 0, anim = 0, astro = $('#astro');
  function place() {
    var p = route.getPointAtLength(cur);
    astro.setAttribute('transform', 'translate(' + p.x + ',' + p.y + ')');
    $('#radar').setAttribute(
      'visibility',
      walkSimulationActive ? 'visible': 'hidden'
    );
    if (simReady) update(p)
  }
  function moveTo(to, cb) {
    resetWalkSimulation();
    stopAuto();
    cancelAnimationFrame(anim);
    var from = cur, dur = reduce ? 10: Math.max(500, Math.min(2400, Math.abs(to - from) * 3.2)), t0 = performance.now();
    (function step(n) {
      var p = Math.min(1, (n - t0) / dur), e = p < .5 ? 2 * p * p: 1 - Math.pow(-2 * p + 2, 2) / 2;
      cur = from + (to - from) * e;
      place();
      if (p < 1) anim = requestAnimationFrame(step);
      else if (cb) cb()
    })(t0)
  }
  place();
  var sel = 'base';
  function render(s) {
    var night = $('#world').classList.contains('night'), h = s.id === 'haz';
    var sample = h ? null: D.getProcessedStation(s.id);
    var arrival = Telemetry.traverseMetrics(s.km || 0, map.traverseKm, 15, map.returnMinutes).oxygenPercent;
    var ch = h ? s.chips : [
      ['Distance', s.km + ' km'],
      ['Walk time', fmt(s.km)],
      ['Suit O₂ on arrival', arrival + '%'],
      ['Surface temp', night ? '-73°C' : '-23°C']
    ];
    var sampleNote = '';
    if (
      sample &&
      typeof sample.elevationMeters === 'number' &&
      typeof sample.slopeDegrees === 'number'
    ) {
      var crismNote = typeof sample.crismBandValue === 'number'
        ? ' · CRISM index ' + sample.crismBandValue.toPrecision(4)
        : '';
      sampleNote =
        '<p class="fn">Raster sample: ' + sample.elevationMeters.toFixed(1) +
        ' m elevation · ' + sample.slopeDegrees.toFixed(1) + '° slope' +
        crismNote + '</p>';
    }
    $('#info').innerHTML =
      '<h3>' + s.name + '</h3><p class="tagline">' + s.tag +
      '</p><div class="chips">' + ch.map(function (c) {
      return '<div class="cp"><small>' + c[0] + '</small><b>' + c[1] + '</b></div>'
    }).join('') + '</div>' + s.m.map(function (m) {
      return '<div class="mrow"><span>' + m[0] + '</span>' +
        '<div class="bar2"><i data-w="' + m[1] +
        '" style="background:' + m[2] + '"></i></div><b>' +
        m[1] + '%</b></div>'
    }).join('') + '<p class="note">' + s.note + '</p>' + sampleNote +
    '<p class="fn">Illustrative planning model; not operational mission data.</p>';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        $$('.bar2 i').forEach(function (i) {
          i.style.width = i.dataset.w + '%'
        })
      })
    });
  }
  function pick(id, cb) {
    resetWalkSimulation();
    var s = id === 'haz' ? HAZ: ST.filter(function (x) {
      return x.id === id
    })[0];
    sel = id;
    $$('.sta[data-id]').forEach(function (g) {
      g.classList.toggle('sel', g.dataset.id === id)
    });
    render(s);
    if (id !== 'haz') moveTo(s.len, cb);
  }
  $('#haz').addEventListener('click', function () {
    pick('haz')
  });
  $('#haz').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick('haz')
    }
  });
  /* === 7. EVA simulation, route guidance, and suit telemetry === */
  var world = $('#world'), slider = $('#slider'), LAY = ['mola'], guide = false, audioOn = true, beepT = 0, lastKey = '', T = {
    km: 0,
    o2: 100,
    ret: 0,
    weak: false
  }, simReady = false, auto = 0, walkAnimation = 0, walkSimulationActive = false,
  duneWarningActive = false, nightThermalAuto = false,
  audio = Telemetry.createAudioUtilities(), ambientOn = false;
  function banner(c, t) {
    $('#banner').className = 'alertbar ' + c;
    $('#bmsg').textContent = t
  }
  function stopAuto() {
    cancelAnimationFrame(auto);
    auto = 0;
    $('#autoBtn').textContent = 'Run route'
  }
  function stopWalk() {
    cancelAnimationFrame(walkAnimation);
    walkAnimation = 0;
    $('#walkBtn').textContent = 'Simulate Walk';
    $('#walkBtn').setAttribute('aria-pressed', 'false');
  }
  function resetWalkSimulation() {
    stopWalk();
    walkSimulationActive = false;
    duneWarningActive = false;
    if (gisRadarCircle && gisMap) {
      gisMap.removeLayer(gisRadarCircle);
      gisRadarCircle = null;
    }
    $('#radar').setAttribute('visibility', 'hidden');
    if (gisDuneWarningPopup && gisMap) {
      gisMap.closePopup(gisDuneWarningPopup);
      gisDuneWarningPopup = null;
    }
  }
  function showDuneWarning(position) {
    if (gisMap && window.L) {
      var content = document.createElement('div');
      content.className = 'gis-dune-warning-copy';
      content.textContent = GIS_DUNE_WARNING;
      gisDuneWarningPopup = window.L.popup({
        className: 'gis-dune-warning',
        maxWidth: 340,
        autoClose: true,
        closeOnClick: false
      }).setLatLng(position).setContent(content).openOn(gisMap);
    }
    if (audioOn) audio.playAlertTone();
  }
  function update(p) {
    p = p || route.getPointAtLength(cur);
    var metrics = Telemetry.traverseMetrics(kmAt(cur), map.traverseKm, 15, map.returnMinutes);
    var km = metrics.distanceKm, o2 = metrics.oxygenPercent,
      ret = metrics.returnMinutes, near = null, i;
    for (i = 1; i < ST.length; i++) if (Math.abs(cur - ST[i].len) < 18) near = ST[i];
    var gisPosition = syncGisSimulation();
    var inHazard = gisPosition && gisHazardLayer
      ? gisHazardLayer.getBounds().contains(gisPosition)
      : Telemetry.isInsideHazard(p, hazardData);
    var duneDistance = gisPosition
      ? marsDistance(gisPosition, window.L.latLng(GIS_STATIONS.s3))
      : (map.traverseKm - kmAt(cur)) * 1000;
    var approachingDunes =
      walkSimulationActive && duneDistance <= GIS_DUNE_WARNING_DISTANCE_M;
    if (approachingDunes && !duneWarningActive) {
      duneWarningActive = true;
      showDuneWarning(gisPosition);
    }
    var st = approachingDunes
      ? 'dune-warning'
      : near
      ? 'target'
      : inHazard
        ? 'danger'
        : (cur > ST[1].len + 6 &&
          cur < ST[1].len + .27 * (ST[2].len - ST[1].len))
          ? 'weak'
          : 'safe';
    var weak = st === 'weak';
    T = {
      km: km,
      o2: o2,
      ret: ret,
      weak: weak
    };
    var key = st + (near ? near.id: '');
    if (key !== lastKey) {
      lastKey = key;
      if (st === 'target') banner('target', 'SITE REACHED: ' + near.mine + ' assessment point.');
      else if (st === 'dune-warning') banner('alert', GIS_DUNE_WARNING);
      else if (st === 'danger') banner('alert', 'SLOPE HAZARD: steep crater margin ahead. Follow the mapped traverse.');
      else if (st === 'weak') banner('weak', 'SIGNAL: terrain obstruction. Orbiter relay in use.');
      else banner('ok', 'ROUTE STATUS: within the modeled safe-slope corridor.');
    }
    $('#haz').classList.toggle('alerting', st === 'danger');
    if (gisHazardLayer) gisHazardLayer.setStyle({
      weight: st === 'danger' ? 3: 2,
      fillOpacity: st === 'danger'?.32: .2
    });
    if (st === 'danger' && audioOn && !beepT) {
      beep();
      beepT = setInterval(beep, 900);
      if (navigator.vibrate) navigator.vibrate([200, 100, 200])
    }
    if ((st !== 'danger' || !audioOn) && beepT) {
      clearInterval(beepT);
      beepT = 0
    }
    var at = near ? near.id: cur < 18 ? 'base': '';
    $$('.wp[data-id]').forEach(function (b) {
      b.classList.toggle('sel', b.dataset.id === at)
    });
    if (near && sel !== near.id) {
      sel = near.id;
      $$('.sta[data-id]').forEach(function (g) {
        g.classList.toggle('sel', g.dataset.id === sel)
      });
      render(near)
    }
    if (walkSimulationActive) {
      o2 = Math.max(50, Math.round(100 - (cur / TL) * 50));
    }
    T.o2 = o2;
    slider.value = Math.round(cur / TL * 1000);
    slider.setAttribute('aria-valuetext', km.toFixed(1) + ' km');
    $('#simKm').textContent = km.toFixed(1) + ' km of 8.3 km';
    $('#simO2').textContent = o2 + '%';
    $('#deckO2').textContent = 'Suit O2: ' + o2 + '%';
    $('#o2Value').textContent = o2 + '%';
    $('#o2Gauge').style.setProperty('--gauge-progress', o2 + '%');
    $('#o2Gauge').setAttribute('aria-label', 'Oxygen ' + o2 + ' percent');
    $('#o2Read').textContent = 'Estimated return reserve: ' + ret + ' min';
    $('#signalValue').textContent = weak ? 'Relay': 'Strong';
    $('#signalGauge').classList.toggle('weak', weak);
    $('#signalGauge').setAttribute('aria-label', 'Signal ' + (weak ? 'weak, orbiter relay': 'strong'));
    $('#sigRead').textContent = weak ? 'Orbiter relay; terrain obstruction': 'Base Camp direct link';
    var lk = $('#link');
    lk.setAttribute('x1', p.x);
    lk.setAttribute('y1', p.y);
    lk.setAttribute('x2', weak ? 700: 100);
    lk.setAttribute('y2', weak ? 100: 580);
    lk.setAttribute('stroke', weak ? '#c49a5b': '#7da4c9');
    var v = $('#vec'), vt = $('#vecT');
    if (guide && cur > 12) {
      var d = Math.hypot(100 - p.x, 580 - p.y);
      var k = d * map.traverseKm / TL;
      var cross = Telemetry.distanceToSegment(
        hazardData.x,
        hazardData.y,
        p.x,
        p.y,
        100,
        580
      ) < 86;
      v.setAttribute('x1', p.x);
      v.setAttribute('y1', p.y);
      v.setAttribute('x2', 100);
      v.setAttribute('y2', 580);
      v.setAttribute('stroke', cross ? '#b7656d': '#7da4c9');
      v.setAttribute('visibility', 'visible');
      vt.textContent = cross
        ? 'Direct path crosses the crater; use the mapped traverse'
        : 'Direct to base: ' + k.toFixed(1) + ' km, about ' +
          Math.round(k / 8.3 * 120) + ' min';
      vt.setAttribute('x', Math.max(250, Math.min(550, (p.x + 100) / 2)));
      vt.setAttribute('y', (p.y + 580) / 2 - 14);
      vt.setAttribute('visibility', 'visible');
    } else {
      v.setAttribute('visibility', 'hidden');
      vt.setAttribute('visibility', 'hidden')
    }
  }
  slider.addEventListener('input', function () {
    resetWalkSimulation();
    stopAuto();
    cancelAnimationFrame(anim);
    cur = slider.value / 1000 * TL;
    place()
  });
  $$('.wp[data-id]').forEach(function (b) {
    b.addEventListener('click', function () {
      pick(b.dataset.id)
    })
  });
  $('#autoBtn').addEventListener('click', function () {
    resetWalkSimulation();
    if (auto) {
      stopAuto();
      return
    }
    if (cur >= TL - 1) {
      cur = 0;
      place()
    }
    cancelAnimationFrame(anim);
    this.textContent = 'Pause route';
    var t0 = performance.now();
    (function step(n) {
      var dt = Math.min((n - t0) / 1000, .05);
      t0 = n;
      cur = Math.min(TL, cur + dt * TL / (reduce ? 3: 16));
      place();
      if (cur < TL) auto = requestAnimationFrame(step);
      else stopAuto()
    })(t0);
  });
  $('#walkBtn').addEventListener('click', function () {
    if (walkAnimation) {
      stopWalk();
      return;
    }
    stopAuto();
    cancelAnimationFrame(anim);
    if (!walkSimulationActive || cur >= TL - 1) {
      resetWalkSimulation();
      cur = 0;
      walkSimulationActive = true;
      duneWarningActive = false;
      if (gisDuneWarningPopup && gisMap) {
        gisMap.closePopup(gisDuneWarningPopup);
        gisDuneWarningPopup = null;
      }
    }
    this.textContent = 'Pause walk';
    this.setAttribute('aria-pressed', 'true');
    place();
    var previousTime = performance.now();
    var duration = reduce ? 3 : 16;
    (function step(now) {
      var dt = Math.min((now - previousTime) / 1000, .05);
      previousTime = now;
      cur = Math.min(TL, cur + dt * TL / duration);
      place();
      if (cur < TL) {
        walkAnimation = requestAnimationFrame(step);
      } else {
        walkAnimation = 0;
        $('#walkBtn').textContent = 'Simulate Walk';
        $('#walkBtn').setAttribute('aria-pressed', 'false');
      }
    })(previousTime);
  });
  $('#guideBtn').addEventListener('click', function () {
    guide = !guide;
    this.classList.toggle('live', guide);
    this.setAttribute('aria-pressed', guide);
    openMenu(false);
    update()
  });
  /* === 8. Layer controls and map legend === */
  var PINS =
    '<div class="keygrid">' +
    '<p><i style="background:#5aa77a"></i>Route</p>' +
    '<p><i style="background:#4b9167"></i>Safe &lt;2°</p>' +
    '<p><i style="background:#c49a5b"></i>Caution 2–10°</p>' +
    '<p><i style="background:#b7656d"></i>Hazard &gt;10°</p>' +
    '<p>Markers: sites</p></div>';
  var LG = {
    def: '<h4>Map legend</h4>' + PINS,
    mola: '<h4>MOLA · elevation &amp; slope</h4>' + PINS,
    thermal: '<h4>THEMIS · thermal inertia</h4>' +
      '<div class="lgrad"></div><div class="lgl">' +
      '<span>Lower inertia</span><span>Higher inertia</span></div>',
    crism: '<h4>CRISM · spectral units</h4>' +
      '<p><i style="background:#c49a5b"></i>Fe-Ti-bearing unit</p>' +
      '<p><i style="background:#68a9bd"></i>Hydrated silica proxy</p>' +
      '<p><i style="background:#ad83a9"></i>Altered terrain proxy</p>'
  };
  function legend() {
    $('#legend').innerHTML = LG[LAY[LAY.length - 1] || 'def']
  }
  function layerOn(id, on) {
    LAY = LAY.filter(function (x) {
      return x !== id
    });
    if (on) LAY.push(id);
    if (gisMap && id === 'mola' && gisMolaLayer) {
      if (on) gisMolaLayer.addTo(gisMap);
      else gisMap.removeLayer(gisMolaLayer);
    }
    if (gisMap && gisCanvasLayers[id]) {
      if (on) gisCanvasLayers[id].addTo(gisMap);
      else gisMap.removeLayer(gisCanvasLayers[id]);
    }
    legend();
  }
  function setLayerControl(id, on) {
    var control = $('.sw[data-l="' + id + '"]');
    control.setAttribute('aria-checked', on);
    control.querySelector('.st').textContent = on ? 'ON': 'OFF';
    $('#c_' + id).classList.toggle('on', on);
    layerOn(id, on);
  }
  /* === 9. Audio alerts and mission snapshot === */
  function beep() {
    if (audioOn) audio.playAlertTone()
  }
  $('#audioSw').addEventListener('click', function () {
    audioOn = this.getAttribute('aria-checked') !== 'true';
    if (audioOn && !audio.playAlertTone()) {
      audioOn = false;
      banner('warn', 'Web Audio is unavailable; audio alerts remain disabled.');
    } else if (!audioOn && beepT) {
      clearInterval(beepT);
      beepT = 0;
    }
    this.setAttribute('aria-checked', audioOn);
    this.querySelector('.st').textContent = audioOn ? 'ON': 'OFF';
  });
  $('#marsBtn').addEventListener('click', function () {
    if (ambientOn) {
      audio.stopAmbient();
      ambientOn = false;
      this.textContent = 'Toggle surface audio';
      this.classList.remove('live');
    } else if (audio.startAmbient()) {
      ambientOn = true;
      this.textContent = 'Stop surface audio';
      this.classList.add('live');
    } else {
      banner('warn', 'Web Audio is unavailable in this browser.');
    }
  });
  function snap() {
    var point = route.getPointAtLength(cur);
    var url = Telemetry.createSnapshot({
      mapCanvas: $('#cBase'),
      layerCanvases: [{
        canvas: $('#c_mola'),
        enabled: $('#c_mola').classList.contains('on')
      }, {
        canvas: $('#c_thermal'),
        enabled: $('#c_thermal').classList.contains('on')
      }, {
        canvas: $('#c_crism'),
        enabled: $('#c_crism').classList.contains('on')
      }],
      routePath: route.getAttribute('d'),
      stations: ST.map(function (station) {
        return {
          marker: station.g,
          x: station.x,
          y: station.y
        }
      }),
      position: {
        x: point.x,
        y: point.y
      },
      metrics: {
        distanceKm: T.km,
        oxygenPercent: T.o2,
        returnMinutes: T.ret
      },
      signalWeak: T.weak,
      activeLayers: LAY,
      night: world.classList.contains('night')
    });
    $('#snapImg').src = url;
    $('#snapDl').href = url;
    $('#snap').hidden = false;
    $('#snapDl').click();
  }
  $('#snapBtn').addEventListener('click', function () {
    openMenu(false);
    snap()
  });
  $('#snapX').addEventListener('click', function () {
    $('#snap').hidden = true
  });
  simReady = true;
  legend();
  update();
  function loadProcessedDataset() {
    if (location.protocol === 'file:') return;
    fetch('./nasa_surface_data.json', {
      cache: 'no-store'
    }).then(function (response) {
      if (response.status === 404) {
        $('#dataStatus').textContent = 'Illustrative relief · no processed raster dataset';
        return null;
      }
      if (!response.ok) throw new Error('Dataset request failed with HTTP ' + response.status + '.');
      return response.json();
    }).then(function (dataset) {
      if (!dataset) return;
      if (
        dataset.status === 'no-processed-samples' &&
        Array.isArray(dataset.stations) &&
        dataset.stations.length === 0
      ) {
        $('#dataStatus').textContent =
          'Illustrative relief · no processed raster samples';
        return;
      }
      D.setProcessedDataset(dataset);
      $('#dataStatus').textContent = 'Raster statistics loaded · map remains illustrative';
      render(sel === 'haz' ? HAZ: ST.filter(function (x) {
        return x.id === sel
      })[0]);
    }).catch(function (error) {
      $('#dataStatus').textContent = 'Raster dataset unavailable · illustrative relief active';
      console.error('Unable to load processed Mars raster data:', error);
    });
  }
  loadProcessedDataset();
  /* === 10. Operations mode and mission drawer === */
  $('#modeBtn').addEventListener('click', function () {
    var n = $('#world').classList.toggle('night');
    document.body.classList.toggle('dayops', !n);
    this.setAttribute('aria-pressed', n);
    this.textContent = n ? 'Night Ops': 'Day Ops';
    var thermalControl = $('.sw[data-l="thermal"]');
    if (n && thermalControl.getAttribute('aria-checked') !== 'true') {
      setLayerControl('thermal', true);
      nightThermalAuto = true;
    } else if (!n && nightThermalAuto) {
      setLayerControl('thermal', false);
      nightThermalAuto = false;
    }
    update();
    render(sel === 'haz' ? HAZ: ST.filter(function (x) {
      return x.id === sel
    })[0]);
    if (n) {
      banner(
        'weak',
        'Night Mode Active: Temp drops to -73°C. THEMIS thermal data engaged.'
      );
    }
  });
  var menu = $('#menu'), scrim = $('#scrim');
  function openMenu(o) {
    menu.classList.toggle('open', o);
    scrim.classList.toggle('on', o);
    menu.inert = !o;
    $('#menuBtn').setAttribute('aria-expanded', o);
    (o ? $('#closeMenu'): $('#menuBtn')).focus()
  }
  $('#menuBtn').addEventListener('click', function () {
    openMenu(true)
  });
  $('#closeMenu').addEventListener('click', function () {
    openMenu(false)
  });
  scrim.addEventListener('click', function () {
    openMenu(false)
  });
  addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menu.classList.contains('open')) openMenu(false)
  });
  $$('.sw[data-l]').forEach(function (b) {
    b.addEventListener('click', function () {
      var on = b.getAttribute('aria-checked') !== 'true';
      if (b.dataset.l === 'thermal' && world.classList.contains('night')) {
        nightThermalAuto = false;
      }
      setLayerControl(b.dataset.l, on);
    })
  });
  /* === 11. Illustrative terrain and science-layer canvases === */
  var built = false;
  function seg(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(px - ax - t * dx, py - ay - t * dy)
  }
  function ramp(t, s) {
    t = Math.max(0, Math.min(.999, t)) * (s.length - 1);
    var i = t | 0;
    return O.mix(s[i], s[i + 1], t - i)
  }
  function build() {
    if (built || !O) return;
    built = true;
    var W = 400, H = 350, N = W * H, h = new Float32Array(N), a = new Float32Array(N), x, y, k;
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      var X = x * 2, Y = y * 2, v = O.fbm(X * .004, Y * .004, 1.7, 5) + .22 * O.fbm(X * .02, Y * .02, 9, 3);
      k = y * W + x;
      v += .34 * Math.exp(-Math.pow(seg(X, Y, 160, 480, 340, 320) / 30, 2));
      var r = Math.hypot(X - 560, Y - 230);
      v += .5 * Math.exp(-Math.pow(r / 70, 2)) - .24 * Math.exp(-Math.pow(r / 15, 2));
      r = Math.hypot(X - 400, Y - 330);
      if (r < 78) v -= .7 * (1 - Math.pow(r / 78, 2));
      v += .28 * Math.exp(-Math.pow((r - 78) / 9, 2));
      var d = Math.hypot(X - 690, Y - 450);
      v += .14 * Math.max(0, Math.sin((X * .5 + Y * .85) * .085 + O.fbm(X * .01, Y * .01, 4, 2) * 7)) * Math.exp(-Math.pow(d / 140, 2));
      h[k] = v;
      a[k] = O.fbm(X * .006 + 20, Y * .006, 3, 3);
    }
    var mn = 1e9, mx = -1e9;
    for (k = 0; k < N; k++) {
      if (h[k] < mn) mn = h[k];
      if (h[k] > mx) mx = h[k]
    }
    var cs = ['cBase', 'c_mola', 'c_thermal', 'c_crism'].map(function (id) {
      var c = $('#' + id);
      c.width = W;
      c.height = H;
      var cx = c.getContext('2d');
      return {
        cx: cx,
        d: cx.createImageData(W, H)
      }
    });
    function put(L, p, c, al) {
      var d = L.d.data;
      d[p] = c[0];
      d[p + 1] = c[1];
      d[p + 2] = c[2];
      d[p + 3] = al
    }
    var IN = [[18, 28, 40], [70, 119, 124], [171, 136, 104], [226, 195, 142]];
    for (y = 0; y < H; y++) {
      for (x = 0; x < W; x++) {
        k = y * W + x;
        var pixel = k * 4;
        var X = x * 2;
        var Y = y * 2;
        var elevation = (h[k] - mn) / (mx - mn);
        var right = h[x < W - 1 ? k + 1 : k];
        var left = h[x ? k - 1 : k];
        var down = h[y < H - 1 ? k + W : k];
        var up = h[y ? k - W : k];
        var light = Math.max(.35, Math.min(1.7, 1 + (right - left + down - up) * 10));
        var darkness = O.sstep(.46, .6, a[k]);
        var terrainColor = O.mix(
          O.mix([170, 126, 91], [63, 54, 49], darkness),
          [205, 169, 128],
          O.sstep(.6, .9, elevation) * .42 * (1 - darkness)
        );
        var shading = light * (.72 + .28 * elevation) * (.93 + .12 * a[k]);
        put(cs[0], pixel, [
          terrainColor[0] * shading,
          terrainColor[1] * shading,
          terrainColor[2] * shading
        ], 255);

        var contour = Math.floor(elevation * 16);
        var edge =
          contour !== Math.floor((right - mn) / (mx - mn) * 16) ||
          contour !== Math.floor((down - mn) / (mx - mn) * 16);
        var slope = Math.atan(
          Math.hypot((right - left) * .5, (down - up) * .5) * 10
        ) * 180 / Math.PI;
        var safetyClass = Telemetry.slopeClass(
          slope,
          D.layers.mola.thresholdsDeg
        );
        var safety = safetyClass === 'safe'
          ? [75, 145, 103]
          : safetyClass === 'caution'
            ? [196, 154, 91]
            : [183, 101, 109];
        var safetyAlpha = slope < 2 ? 92 : slope <= 10 ? 108 : 124;
        if (edge) safetyAlpha += 12;
        put(cs[1], pixel, safety, safetyAlpha);
        put(cs[2], pixel, ramp(.5 * darkness + .5 * (1 - elevation), IN), 145);

        var alterationSignal = O.fbm(X * .01 + 50, Y * .01, 5, 3);
        var geologyColor = null;
        if (Math.exp(-Math.pow(seg(X, Y, 160, 480, 340, 320) / 45, 2)) > .5) {
          geologyColor = [196, 154, 91];
        } else if (Math.hypot(X - 560, Y - 230) < 80) {
          geologyColor = [104, 169, 189];
        } else if (Math.hypot(X - 690, Y - 450) < 130 && alterationSignal > .38) {
          geologyColor = [173, 131, 169];
        }
        put(cs[3], pixel, geologyColor || [0, 0, 0], geologyColor ? 145 : 0);
      }
    }
    cs.forEach(function (L) {
      L.cx.putImageData(L.d, 0, 0)
    });
  }
  setTimeout(function () {
    build();
    installCanvasGisLayers()
  }, 1800);
  /* === 12. Overview transition and reset === */
  var mapTransitionTimer = 0;
  function begin() {
    var b = document.body;
    if (b.classList.contains('eva')) return;
    b.classList.add('eva', 'dayops');
    setupGisMap();
    build();
    installCanvasGisLayers();
    pick('base');
    clearTimeout(mapTransitionTimer);
    mapTransitionTimer = setTimeout(function () {
      if (!b.classList.contains('eva')) return;
      window.__oreHold = true;
      b.classList.add('mapped');
      $('#menuBtn').focus();
    }, 1800);
  }
  document.addEventListener('oreway:start', begin);
  $('#start').addEventListener('click', function () {
    if (!window.THREE) setTimeout(begin, 1100)
  });
  $('#overviewBtn').addEventListener('click', function () {
    clearTimeout(mapTransitionTimer);
    openMenu(false);
    resetWalkSimulation();
    stopAuto();
    cancelAnimationFrame(anim);
    cur = 0;
    guide = false;
    $('#guideBtn').classList.remove('live');
    $('#guideBtn').setAttribute('aria-pressed', 'false');
    place();
    if (beepT) {
      clearInterval(beepT);
      beepT = 0
    }
    if (ambientOn) {
      audio.stopAmbient();
      ambientOn = false;
      $('#marsBtn').textContent = 'Toggle surface audio';
      $('#marsBtn').classList.remove('live');
    }
    world.classList.remove('night');
    $('#modeBtn').textContent = 'Day Ops';
    $('#modeBtn').setAttribute('aria-pressed', 'false');
    document.body.classList.remove('mapped', 'eva', 'dayops');
    window.__oreHold = false;
    if (window.__oreResume) window.__oreResume();
    $('#start').disabled = false;
    $('#start').textContent = 'Initialize Surface Telemetry';
    $('#msg').textContent = '';
    $('#start').focus();
  });
})();
