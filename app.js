/* Render the overview globe and start the surface-navigation transition. */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* === 1. Overview globe texture === */
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
      msg.textContent = 'Loading NASA Mars Trek map layers';
      document.dispatchEvent(new CustomEvent('oreway:start'));
    }, 1100);
  });
})();
/* Coordinate map layers, route state, mission controls, and telemetry. */
(function () {
  'use strict';

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
      m: station.mineralProxies || [],
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
    m: hazardData.mineralProxies || []
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
    s1: 'Site 1: Volcanic Basalt & Olivine',
    s2: 'Site 2: Carbonate-Bearing Terrain',
    s3: 'Site 3: Crater Rim (Phyllosilicates)'
  };
  var GIS_STATION_POPUPS = {
    base: 'Flat basaltic plain.',
    s1: 'Volcanic Basalt & Olivine.',
    s2: 'Carbonate-Bearing Terrain.',
    s3: 'Crater Rim (Phyllosilicates).'
  };
  var GIS_ROUTE = ST.map(function (station) {
    return GIS_STATIONS[station.id]
  });
  var GIS_BASE_TILES = D.layers.mola.tileUrl;
  var GIS_THEMIS_DAY_TILES = D.layers.thermal.dayTileUrl;
  var GIS_THEMIS_NIGHT_TILES = D.layers.thermal.nightTileUrl;
  var gisMap = null;
  var gisBaseLayer = null;
  var gisThemisDayLayer = null;
  var gisThemisNightLayer = null;
  var gisThemisReady = {
    day: false,
    night: false
  };
  var gisThemisTimeout = 0;
  var gisCrismLayer = null;
  var crismLoadState = 'idle';
  var crismSavedView = null;
  var sepEvents = [];
  var sepLoadState = 'idle';
  var sepStatusText = 'NASA DONKI event context; no surface dose measurement';
  var gisRouteLayer = null;
  var gisHazardLayer = null;
  var gisAstronaut = null;
  var gisRadarCircle = null;
  var gisRadarRenderer = null;
  var gisDuneWarningPopup = null;
  var gisGuideLayer = null;
  var gisTilesReady = false;
  var gisTileTimeout = 0;
  var GIS_DUNE_WARNING =
    'CRITICAL WARNING: Approaching Hazard Zone (Crater Rim). Reroute Recommended.';
  var GIS_OXYGEN_WARNING =
    'WARNING: Oxygen levels low. Begin return to Base Camp.';
  var GIS_DUNE_WARNING_DISTANCE_M = 600;
  var GIS_RADAR_RADIUS_M = 250;
  var GIS_RISK_SAMPLE_RADIUS_M = 250;
  var GIS_RISK_HAZARD_RANGE_M = 1500;
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
  function setRasterSampleStatus(message) {
    $('#rasterSampleStatus').textContent = message
  }
  function setCrismStatus(message) {
    $('#crismStatus').textContent = message
  }
  function setRadiationStatus(message) {
    $('#radiationStatus').textContent = message
  }
  function fetchNASAJSON(url, source) {
    var controller = typeof AbortController === 'function'
      ? new AbortController()
      : null;
    var timeout = controller
      ? setTimeout(function () {
        controller.abort();
      }, 20000)
      : 0;
    var options = {
      cache: 'no-store'
    };
    if (controller) options.signal = controller.signal;
    return fetch(url, options).then(function (response) {
      if (!response.ok) {
        throw new Error(source + ' request failed with HTTP ' + response.status + '.');
      }
      return response.json();
    }).finally(function () {
      if (timeout) clearTimeout(timeout);
    });
  }
  function syncThemisLayer() {
    if (!gisMap || !gisThemisDayLayer || !gisThemisNightLayer) return;
    clearTimeout(gisThemisTimeout);
    gisThemisTimeout = 0;
    if (gisMap.hasLayer(gisThemisDayLayer)) gisMap.removeLayer(gisThemisDayLayer);
    if (gisMap.hasLayer(gisThemisNightLayer)) gisMap.removeLayer(gisThemisNightLayer);
    if (LAY.indexOf('thermal') < 0) return;
    var night = world.classList.contains('night');
    var layer = night ? gisThemisNightLayer : gisThemisDayLayer;
    var period = night ? 'night' : 'day';
    layer.addTo(gisMap);
    if (!gisThemisReady[period]) {
      setMapStatus('NASA Mars Trek · THEMIS ' + period.toUpperCase() + ' IR loading');
      gisThemisTimeout = setTimeout(function () {
        if (
          LAY.indexOf('thermal') >= 0 &&
          world.classList.contains('night') === night &&
          !gisThemisReady[period]
        ) {
          setMapStatus('NASA THEMIS tiles are delayed; check the network connection.');
        }
      }, 8000);
    }
  }
  function setCrismLayerVisible(on) {
    if (!gisMap || !gisCrismLayer) return;
    if (!on) {
      if (gisMap.hasLayer(gisCrismLayer)) gisMap.removeLayer(gisCrismLayer);
      if (crismSavedView) {
        gisMap.setMinZoom(8);
        gisMap.setView(crismSavedView.center, crismSavedView.zoom);
        crismSavedView = null;
      }
      return;
    }
    if (!gisCrismLayer.getLayers().length || gisMap.hasLayer(gisCrismLayer)) return;
    crismSavedView = {
      center: gisMap.getCenter(),
      zoom: gisMap.getZoom()
    };
    gisCrismLayer.addTo(gisMap);
    var bounds = gisCrismLayer.getBounds();
    GIS_ROUTE.forEach(function (point) {
      bounds.extend(point);
    });
    gisMap.fitBounds(bounds, {
      padding: [36, 36],
      maxZoom: 8
    });
  }
  function loadCrismDetections() {
    if (crismLoadState !== 'idle') return;
    crismLoadState = 'loading';
    setCrismStatus('Loading NASA CRISM regional detections…');
    var bounds = D.layers.crism.regionalBounds;
    var params = new URLSearchParams({
      where: "Instrument='CRISM' AND Latitude >= " + bounds.south +
        ' AND Latitude <= ' + bounds.north +
        ' AND Long_East >= ' + bounds.west +
        ' AND Long_East <= ' + bounds.east,
      outFields: 'Latitude,Long_East,Type,Instrument',
      returnGeometry: 'false',
      f: 'json'
    });
    fetchNASAJSON(
      D.layers.crism.queryUrl + '?' + params.toString(),
      'NASA CRISM catalog'
    ).then(function (result) {
      if (result.error) {
        throw new Error(result.error.message || 'CRISM catalog returned an error.');
      }
      if (!Array.isArray(result.features)) {
        throw new Error('CRISM catalog response did not contain a feature list.');
      }
      gisCrismLayer = window.L.featureGroup();
      result.features.forEach(function (feature) {
        var attributes = feature.attributes || {};
        var latitude = Number(attributes.Latitude);
        var longitude = Number(attributes.Long_East);
        if (!isFinite(latitude) || !isFinite(longitude)) return;
        var marker = window.L.circleMarker([latitude, longitude], {
          radius: 7,
          color: '#38BDF8',
          weight: 2,
          fillColor: '#0B0F19',
          fillOpacity: 0.9
        });
        var content = document.createElement('div');
        content.className = 'gis-popup-copy';
        var classification = document.createElement('p');
        classification.textContent =
          (attributes.Instrument || 'CRISM') + ' catalog class: ' +
          (attributes.Type || 'Unclassified detection');
        content.appendChild(classification);
        var location = document.createElement('p');
        location.textContent =
          'Location: ' + latitude.toFixed(3) + '°N, ' +
          longitude.toFixed(3) + '°E';
        content.appendChild(location);
        var limitation = document.createElement('p');
        limitation.textContent = D.layers.crism.classificationNote;
        content.appendChild(limitation);
        var source = document.createElement('a');
        source.href = D.layers.crism.sourceUrl;
        source.target = '_blank';
        source.rel = 'noopener noreferrer';
        source.textContent = 'NASA Mars Trek catalog';
        content.appendChild(source);
        marker.bindPopup(content, {
          className: 'gis-science-popup'
        });
        marker.bindTooltip('CRISM · ' + (attributes.Type || 'Detection'));
        marker.addTo(gisCrismLayer);
      });
      crismLoadState = 'loaded';
      var count = gisCrismLayer.getLayers().length;
      setCrismStatus(count
        ? count + ' NASA catalog detection' + (count === 1 ? '' : 's') +
          ' in the Syrtis regional query'
        : 'No CRISM detections in the Syrtis regional query');
      if (LAY.indexOf('crism') >= 0) setCrismLayerVisible(true);
      legend();
    }).catch(function (error) {
      crismLoadState = 'error';
      setCrismStatus('NASA CRISM catalog unavailable.');
      console.error('Unable to load NASA CRISM detections:', error);
      legend();
    });
  }
  function updateSepLegend() {
    if (sepLoadState === 'loading') {
      sepStatusText = 'Loading NASA DONKI SEP events…';
    } else if (sepLoadState === 'error') {
      sepStatusText = 'NASA DONKI data unavailable. ' +
        D.layers.radiation.limitation;
    } else if (sepLoadState === 'loaded' && sepEvents.length) {
      var latest = sepEvents[0].eventTime || 'date not reported';
      sepStatusText = sepEvents.length + ' SEP event' +
        (sepEvents.length === 1 ? '' : 's') + ' reported in the last ' +
        D.layers.radiation.lookbackDays + ' days; latest ' + latest +
        '. ' + D.layers.radiation.limitation;
    } else if (sepLoadState === 'loaded') {
      sepStatusText = 'No SEP events reported in the last ' +
        D.layers.radiation.lookbackDays +
        ' days. ' + D.layers.radiation.limitation;
    }
    if ($('#sepLegendStatus')) {
      $('#sepLegendStatus').textContent = sepStatusText;
    }
    if ($('#sepLegendState')) {
      $('#sepLegendState').textContent =
        sepLoadState === 'loaded' && sepEvents.length
          ? 'SEP events reported'
          : sepLoadState === 'loaded'
            ? 'No SEP events reported'
            : 'Event status unavailable';
      $('#sepLegendState').className =
        sepLoadState === 'loaded' && sepEvents.length
          ? 'sep-state sep-reported'
          : sepLoadState === 'loaded'
            ? 'sep-state sep-none'
            : 'sep-state';
    }
    setRadiationStatus(sepStatusText);
  }
  function loadSepEvents() {
    if (sepLoadState !== 'idle') return;
    sepLoadState = 'loading';
    updateSepLegend();
    var end = new Date();
    var start = new Date(end.getTime() -
      D.layers.radiation.lookbackDays * 24 * 60 * 60 * 1000);
    var params = new URLSearchParams({
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      api_key: 'DEMO_KEY'
    });
    fetchNASAJSON(
      D.layers.radiation.sourceUrl + '?' + params.toString(),
      'NASA DONKI'
    ).then(function (events) {
      if (!Array.isArray(events)) {
        throw new Error('NASA DONKI response did not contain an event list.');
      }
      sepEvents = events.filter(function (event) {
        return event && typeof event.eventTime === 'string';
      }).sort(function (a, b) {
        return b.eventTime.localeCompare(a.eventTime);
      });
      sepLoadState = 'loaded';
      updateSepLegend();
      legend();
      if (simReady) update();
    }).catch(function (error) {
      sepLoadState = 'error';
      updateSepLegend();
      legend();
      if (simReady) update();
      console.error('Unable to load NASA DONKI SEP events:', error);
    });
  }
  function setupGisMap() {
    if (gisMap) {
      setTimeout(function () {
        gisMap.invalidateSize()
      }, 350);
      return;
    }
    if (!window.L) {
      setMapStatus('Leaflet unavailable; NASA map layers cannot be displayed.');
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
    gisMap.createPane('scienceRasters');
    gisMap.getPane('scienceRasters').style.zIndex = 350;
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
      maxNativeZoom: D.layers.mola.maxNativeZoom,
      tileSize: 256,
      attribution: 'Topography: <a href="https://trek.nasa.gov/mars/">NASA Mars Trek · MGS MOLA</a>'
    }).addTo(gisMap);
    gisBaseLayer.on('tileload', function () {
      if (gisTilesReady) return;
      clearTimeout(gisTileTimeout);
      gisTileTimeout = 0;
      gisTilesReady = true;
      setMapStatus('NASA Mars Trek · MOLA color-shaded relief');
    });
    gisBaseLayer.on('tileerror', function () {
      if (!gisTilesReady) {
        clearTimeout(gisTileTimeout);
        gisTileTimeout = 0;
        setMapStatus('NASA MOLA tiles are not responding; no alternate terrain layer is shown.');
      }
    });
    gisTileTimeout = setTimeout(function () {
      if (!gisTilesReady) {
        setMapStatus('NASA MOLA tiles are delayed; check the network connection.');
      }
    }, 8000);
    gisThemisDayLayer = L.tileLayer(GIS_THEMIS_DAY_TILES, {
      minZoom: 8,
      maxZoom: 12,
      maxNativeZoom: D.layers.thermal.maxNativeZoom,
      tileSize: 256,
      opacity: .72,
      pane: 'scienceRasters',
      attribution: 'Day IR: <a href="https://trek.nasa.gov/mars/">NASA Mars Trek · THEMIS</a>'
    });
    gisThemisNightLayer = L.tileLayer(GIS_THEMIS_NIGHT_TILES, {
      minZoom: 8,
      maxZoom: 12,
      maxNativeZoom: D.layers.thermal.maxNativeZoom,
      tileSize: 256,
      opacity: .72,
      pane: 'scienceRasters',
      attribution: 'Night IR: <a href="https://trek.nasa.gov/mars/">NASA Mars Trek · THEMIS</a>'
    });
    gisThemisDayLayer.on('tileload', function () {
      gisThemisReady.day = true;
      if (LAY.indexOf('thermal') >= 0 && !world.classList.contains('night')) {
        clearTimeout(gisThemisTimeout);
        gisThemisTimeout = 0;
        setMapStatus('NASA Mars Trek · THEMIS Day IR controlled mosaic');
      }
    });
    gisThemisNightLayer.on('tileload', function () {
      gisThemisReady.night = true;
      if (LAY.indexOf('thermal') >= 0 && world.classList.contains('night')) {
        clearTimeout(gisThemisTimeout);
        gisThemisTimeout = 0;
        setMapStatus('NASA Mars Trek · THEMIS Night IR controlled mosaic');
      }
    });
    gisThemisDayLayer.on('tileerror', function () {
      if (LAY.indexOf('thermal') >= 0 && !world.classList.contains('night')) {
        clearTimeout(gisThemisTimeout);
        gisThemisTimeout = 0;
        setMapStatus('NASA THEMIS Day IR tiles are unavailable.');
      }
    });
    gisThemisNightLayer.on('tileerror', function () {
      if (LAY.indexOf('thermal') >= 0 && world.classList.contains('night')) {
        clearTimeout(gisThemisTimeout);
        gisThemisTimeout = 0;
        setMapStatus('NASA THEMIS Night IR tiles are unavailable.');
      }
    });
    gisRouteLayer = L.polyline(GIS_ROUTE, {
      color: '#10B981',
      weight: 4,
      opacity: .92,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(gisMap);
    gisRouteLayer.bindTooltip('Configured traverse · 8.3 km');
    gisHazardLayer = L.polygon(GIS_HAZARD, {
      color: '#EF4444',
      weight: 2,
      opacity: .95,
      fillColor: '#EF4444',
      fillOpacity: .2
    }).addTo(gisMap);
    gisHazardLayer.bindTooltip('Crater-margin planning exclusion · slope not evaluated');
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
      riskHasInput = true;
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
    var h = s.id === 'haz';
    var sample = h ? null: D.getProcessedStation(s.id);
    var arrival = Telemetry.traverseMetrics(s.km || 0, map.traverseKm, 15, map.returnMinutes).oxygenPercent;
    var coordinates = h ? null : GIS_STATIONS[s.id];
    var ch = h ? s.chips : [
      ['Distance', s.km + ' km'],
      ['Walk time', fmt(s.km)],
      ['Suit O₂ on arrival', arrival + '%'],
      ['Coordinates', coordinates[0].toFixed(3) + '°N, ' + coordinates[1].toFixed(3) + '°E']
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
    '<p class="fn">Route and traverse values are mission-planning parameters, not instrument measurements.</p>';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        $$('.bar2 i').forEach(function (i) {
          i.style.width = i.dataset.w + '%'
        })
      })
    });
  }
  function pick(id, cb, enableRisk) {
    resetWalkSimulation();
    riskHasInput = enableRisk !== false;
    var s = id === 'haz' ? HAZ: ST.filter(function (x) {
      return x.id === id
    })[0];
    sel = id;
    $$('.sta[data-id]').forEach(function (g) {
      g.classList.toggle('sel', g.dataset.id === id)
    });
    render(s);
    if (id !== 'haz') moveTo(s.len, cb);
    else update();
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
  }, riskScore = 0, riskHasInput = false, simReady = false, auto = 0,
  walkAnimation = 0, walkSimulationActive = false,
  duneWarningActive = false, nightThermalAuto = false,
  solarParticleEventActive = false, guideBeforeSolarEvent = false,
  audio = Telemetry.createAudioUtilities(), ambientOn = false;
  function setRiskScore(score) {
    riskScore = Math.max(0, Math.min(100, Math.round(score)));
    var value = $('#riskScore');
    value.textContent = String(riskScore);
    value.classList.remove('risk-low', 'risk-moderate', 'risk-high');
    var level = riskScore < 30
      ? 'risk-low'
      : riskScore <= 70
        ? 'risk-moderate'
        : 'risk-high';
    value.classList.add(level);
    value.setAttribute(
      'aria-label',
      'Risk score ' + riskScore + ' out of 100; planning index, not a measured value'
    );
  }
  function localSlopeRisk(lat, lng) {
    var nearestSlope = null;
    var nearestDistance = Infinity;
    ST.forEach(function (station) {
      var sample = D.getProcessedStation(station.id);
      var coordinates = GIS_STATIONS[station.id];
      if (!sample || typeof sample.slopeDegrees !== 'number') return;
      var distance = marsDistance(
        window.L.latLng(lat, lng),
        window.L.latLng(coordinates[0], coordinates[1])
      );
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestSlope = sample.slopeDegrees;
      }
    });
    if (
      nearestSlope === null ||
      nearestDistance > GIS_RISK_SAMPLE_RADIUS_M
    ) return null;
    if (nearestSlope < 2) return nearestSlope * 5;
    if (nearestSlope <= 10) return 10 + (nearestSlope - 2) * 3.75;
    return 40 + Math.min(20, (nearestSlope - 10) * 2);
  }
  function configuredHazardRisk(lat, lng) {
    var south = 90, north = -90, west = 180, east = -180;
    GIS_HAZARD.forEach(function (point) {
      south = Math.min(south, point[0]);
      north = Math.max(north, point[0]);
      west = Math.min(west, point[1]);
      east = Math.max(east, point[1]);
    });
    var nearestLat = Math.max(south, Math.min(north, lat));
    var nearestLng = Math.max(west, Math.min(east, lng));
    var distance = lat >= south && lat <= north && lng >= west && lng <= east
      ? 0
      : marsDistance(
        window.L.latLng(lat, lng),
        window.L.latLng(nearestLat, nearestLng)
      );
    return 60 * Math.max(0, 1 - distance / GIS_RISK_HAZARD_RANGE_M);
  }
  function calculateRisk(lat, lng) {
    if (!isFinite(lat) || !isFinite(lng)) {
      throw new TypeError('Risk calculation requires finite latitude and longitude.');
    }
    var score = 0;
    if (LAY.indexOf('mola') >= 0) {
      var slopeRisk = localSlopeRisk(lat, lng);
      score += slopeRisk === null
        ? configuredHazardRisk(lat, lng)
        : slopeRisk;
    }
    if (LAY.indexOf('thermal') >= 0) {
      score += world.classList.contains('night') ? 20 : 10;
    }
    if (LAY.indexOf('radiation') >= 0) {
      if (sepLoadState === 'loaded' && sepEvents.length) {
        score += 25;
      } else if (sepLoadState === 'loading' || sepLoadState === 'error') {
        score += 10;
      }
    }
    if (solarParticleEventActive) score += 25;
    return Math.max(0, Math.min(100, Math.round(score)));
  }
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
    if (walkSimulationActive) {
      o2 = Math.max(50, Math.round(100 - (cur / TL) * 50));
    }
    var oxygenLow = o2 <= 50;
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
    if (riskHasInput && gisPosition) {
      setRiskScore(calculateRisk(gisPosition.lat, gisPosition.lng));
    }
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
    $('#hazardSystemAlert').hidden = !approachingDunes;
    $('#oxygenSystemAlert').hidden = !oxygenLow;
    $('#solarEventAlert').hidden = !solarParticleEventActive;
    $('#systemAlertsClear').hidden =
      approachingDunes || oxygenLow || solarParticleEventActive;
    T = {
      km: km,
      o2: o2,
      ret: ret,
      weak: weak
    };
    var key = st + (near ? near.id: '') + (oxygenLow ? ':oxygen-low': '');
    if (key !== lastKey) {
      lastKey = key;
      if (st === 'dune-warning') banner('alert', GIS_DUNE_WARNING);
      else if (oxygenLow) banner('alert', GIS_OXYGEN_WARNING);
      else if (st === 'target') banner('target', 'Waypoint reached: ' + near.name + '.');
      else if (st === 'danger') banner('alert', 'PLANNING EXCLUSION: follow the configured traverse around the crater margin.');
      else if (st === 'weak') banner('weak', 'SIGNAL: terrain obstruction. Orbiter relay in use.');
      else banner('ok', 'ROUTE STATUS: within the configured traverse corridor.');
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
    riskHasInput = true;
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
    riskHasInput = true;
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
    riskHasInput = true;
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
  var LG = {
    def: '<h4>Map legend</h4><p>No map data layers are active.</p>',
    mola: '<h4>MOLA · relief &amp; traverse</h4>' +
      '<p><i style="background:#10B981"></i>Green = Safe Route</p>' +
      '<p><i style="background:#EF4444"></i>Red = Crater Hazard</p>' +
      '<p>Global 463 m mosaic; slope is not classified.</p>',
    thermal: '<h4>THEMIS · thermal context</h4>' +
      '<p id="themisLegendStatus">Day IR controlled mosaic selected.</p>' +
      '<p>100 m products; not current surface-temperature measurements.</p>',
    crism: '<h4>CRISM · mineral detections</h4>' +
      '<p id="crismLegendStatus">Regional catalog not queried.</p>' +
      '<p><i style="background:#F59E0B"></i>Yellow = Mineral Deposits</p>' +
      '<p>Catalog classes do not confirm mineral species.</p>',
    radiation: '<h4>NASA DONKI · SEP events</h4>' +
      '<p id="sepLegendStatus">NASA DONKI event context; no surface dose measurement</p>' +
      '<p id="sepLegendState" class="sep-state">Event status unavailable</p>' +
      '<p><i style="background:#10B981"></i>Green = No event reported</p>' +
      '<p><i style="background:#EF4444"></i>Red = SEP event reported</p>' +
      '<p>Global event context only; not a Mars surface-dose map.</p>' +
      '<p><a href="https://api.nasa.gov/DONKI/SEP" target="_blank" rel="noopener noreferrer">NASA DONKI SEP API</a></p>'
  };
  function legend() {
    var activeLegend = LAY[LAY.length - 1] || 'def';
    $('#legend').innerHTML = LG[activeLegend];
    if (activeLegend === 'radiation') updateSepLegend();
    if (activeLegend === 'thermal') {
      $('#themisLegendStatus').textContent = world.classList.contains('night')
        ? 'Night IR controlled mosaic selected.'
        : 'Day IR controlled mosaic selected.';
    }
    if (activeLegend === 'crism') {
      $('#crismLegendStatus').textContent = $('#crismStatus').textContent;
    }
  }
  function layerOn(id, on) {
    riskHasInput = true;
    LAY = LAY.filter(function (x) {
      return x !== id
    });
    if (on) LAY.push(id);
    if (gisMap && id === 'mola' && gisBaseLayer) {
      if (on) {
        gisBaseLayer.addTo(gisMap);
      } else {
        gisMap.removeLayer(gisBaseLayer);
        setMapStatus('MOLA layer hidden; no alternate base layer is selected.');
      }
    }
    if (id === 'thermal') {
      syncThemisLayer();
    } else if (id === 'crism') {
      if (on) {
        if (crismLoadState === 'idle' || crismLoadState === 'error') {
          crismLoadState = 'idle';
          loadCrismDetections();
        }
        else if (crismLoadState === 'loaded') setCrismLayerVisible(true);
      } else {
        setCrismLayerVisible(false);
      }
    } else if (id === 'radiation' && on) {
      if (sepLoadState === 'error') sepLoadState = 'idle';
      loadSepEvents();
    }
    legend();
    if (simReady) update();
  }
  function setLayerControl(id, on) {
    var control = $('.sw[data-l="' + id + '"]');
    control.setAttribute('aria-checked', on);
    control.querySelector('.st').textContent = on ? 'ON': 'OFF';
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
    if (location.protocol === 'file:') {
      setRasterSampleStatus('Use HTTP to load local raster samples');
      return;
    }
    fetch('./nasa_surface_data.json', {
      cache: 'no-store'
    }).then(function (response) {
      if (response.status === 404) {
        setRasterSampleStatus('No local raster samples');
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
        setRasterSampleStatus('No local raster samples');
        return;
      }
      D.setProcessedDataset(dataset);
      setRasterSampleStatus('NASA raster samples loaded');
      render(sel === 'haz' ? HAZ: ST.filter(function (x) {
        return x.id === sel
      })[0]);
      if (riskHasInput && simReady) update();
    }).catch(function (error) {
      setRasterSampleStatus('Local raster samples unavailable');
      console.error('Unable to load processed Mars raster data:', error);
    });
  }
  loadProcessedDataset();
  /* === 10. Operations mode and mission drawer === */
  $('#modeBtn').addEventListener('click', function () {
    riskHasInput = true;
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
    syncThemisLayer();
    legend();
    update();
    render(sel === 'haz' ? HAZ: ST.filter(function (x) {
      return x.id === sel
    })[0]);
    if (n) {
      banner('weak', 'Night Ops active: NASA THEMIS Night IR controlled mosaic selected.');
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
  document.addEventListener('oreway:spe-start', function () {
    if (solarParticleEventActive) return;
    if (!gisMap || !gisAstronaut) {
      banner('warn', 'Initialize Surface Telemetry before simulating a Solar Particle Event.');
      document.dispatchEvent(new CustomEvent('oreway:spe-rejected'));
      return;
    }
    resetWalkSimulation();
    stopAuto();
    cancelAnimationFrame(anim);
    guideBeforeSolarEvent = guide;
    solarParticleEventActive = true;
    riskHasInput = true;
    guide = true;
    $('#guideBtn').classList.add('live');
    $('#guideBtn').setAttribute('aria-pressed', 'true');
    openMenu(false);
    update();
    banner(
      'alert',
      'SOLAR PARTICLE EVENT SIMULATION: Elevated radiation risk. Return to Base Camp using emergency guidance.'
    );
  });
  document.addEventListener('oreway:spe-reset', function () {
    if (!solarParticleEventActive) return;
    solarParticleEventActive = false;
    guide = guideBeforeSolarEvent;
    guideBeforeSolarEvent = false;
    riskHasInput = true;
    $('#guideBtn').classList.toggle('live', guide);
    $('#guideBtn').setAttribute('aria-pressed', guide);
    update();
    banner('ok', 'Solar Particle Event simulation reset. Risk recalculated from active layers.');
  });
  /* === 11. Overview transition and reset === */
  var mapTransitionTimer = 0;
  function begin() {
    var b = document.body;
    if (b.classList.contains('eva')) return;
    b.classList.add('eva', 'dayops');
    setupGisMap();
    pick('base', null, false);
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
    if (solarParticleEventActive) {
      document.dispatchEvent(new CustomEvent('oreway:spe-reset'));
    }
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
