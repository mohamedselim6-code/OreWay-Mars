/* Pure route calculations and browser utilities for mission telemetry. */
(function (global) {
  'use strict';
  function clamp(value, lower, upper) {
    return Math.max(lower, Math.min(upper, value));
  }

  /* Convert SVG route progress into the mission's reported distance. */
  function distanceAtRouteLength(length, stations, totalKm) {
    for (var i = 1; i < stations.length; i += 1) {
      if (length <= stations[i].routeLength) {
        var start = stations[i - 1];
        var end = stations[i];
        var segmentLength = end.routeLength - start.routeLength;
        if (segmentLength <= 0) {
          return start.km;
        }
        var fraction = (length - start.routeLength) / segmentLength;
        return start.km + fraction * (end.km - start.km);
      }
    }
    return totalKm;
  }
  function slopeClass(degrees, thresholds) {
    if (degrees < thresholds.safeMaxExclusive) {
      return 'safe';
    }
    if (degrees <= thresholds.cautionMaxInclusive) {
      return 'caution';
    }
    return 'hazard';
  }
  function traverseMetrics(distanceKm, totalKm, reservePercent, totalReturnMinutes) {
    if (totalKm <= 0 || totalReturnMinutes < 0) {
      throw new RangeError('Route length must be positive and return time non-negative.');
    }
    var progress = clamp(distanceKm / totalKm, 0, 1);
    return {
      distanceKm: progress * totalKm,
      oxygenPercent: Math.round(100 - progress * reservePercent),
      returnMinutes: Math.round(progress * totalReturnMinutes)
    };
  }
  /* Return the shortest planar distance from a point to a route segment. */
  function distanceToSegment(px, py, ax, ay, bx, by) {
    var dx = bx - ax;
    var dy = by - ay;
    var lengthSquared = dx * dx + dy * dy;
    var fraction = lengthSquared === 0 ? 0: clamp(((px - ax) * dx + (py - ay) * dy) / lengthSquared, 0, 1);
    return Math.hypot(px - ax - fraction * dx, py - ay - fraction * dy);
  }
  function isInsideHazard(position, hazard) {
    var dx = position.x - hazard.x;
    var dy = position.y - hazard.y;
    return Math.hypot(dx, dy) < hazard.radius;
  }
  /* Keep audio context lifecycle and sound generation outside the UI code. */
  function createAudioUtilities() {
    var audioContext = null;
    var ambient = null;
    function getContext() {
      if (!audioContext) {
        var AudioContextConstructor = global.AudioContext || global.webkitAudioContext;
        if (!AudioContextConstructor) {
          return null;
        }
        audioContext = new AudioContextConstructor();
      }
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      return audioContext;
    }
    function playAlertTone() {
      var context = getContext();
      if (!context) {
        return false;
      }
      [0, 0.2].forEach(function (offset) {
        var oscillator = context.createOscillator();
        var gain = context.createGain();
        var startAt = context.currentTime + offset;
        oscillator.type = 'sine';
        oscillator.frequency.value = offset ? 760: 980;
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(0.06, startAt + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.15);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(startAt);
        oscillator.stop(startAt + 0.16);
      });
      return true;
    }
    function startAmbient() {
      if (ambient) {
        return true;
      }
      var context = getContext();
      if (!context) {
        return false;
      }
      var bufferLength = context.sampleRate * 3;
      var buffer = context.createBuffer(1, bufferLength, context.sampleRate);
      var samples = buffer.getChannelData(0);
      var previous = 0;
      for (var i = 0; i < bufferLength; i += 1) {
        previous = (previous + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        samples[i] = previous * 3.5;
      }
      var source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      var lowPass = context.createBiquadFilter();
      lowPass.type = 'lowpass';
      lowPass.frequency.value = 380;
      lowPass.Q.value = 0.8;
      var lfo = context.createOscillator();
      var lfoGain = context.createGain();
      lfo.frequency.value = 0.11;
      lfoGain.gain.value = 220;
      lfo.connect(lfoGain);
      lfoGain.connect(lowPass.frequency);
      var output = context.createGain();
      output.gain.setValueAtTime(0.0001, context.currentTime);
      output.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 2);
      source.connect(lowPass);
      lowPass.connect(output);
      output.connect(context.destination);
      source.start();
      lfo.start();
      ambient = {
        stop: function () {
          output.gain.setTargetAtTime(0.0001, context.currentTime, 0.4);
          global.setTimeout(function () {
            source.stop();
            lfo.stop();
          }, 1800);
        }
      };
      return true;
    }
    function stopAmbient() {
      if (!ambient) {
        return false;
      }
      var current = ambient;
      ambient = null;
      current.stop();
      return true;
    }
    return {
      playAlertTone: playAlertTone,
      startAmbient: startAmbient,
      stopAmbient: stopAmbient
    };
  }
  /* Compose the current illustrative traverse into a downloadable PNG. */
  function createSnapshot(options) {
    if (
      !options ||
      !options.mapCanvas ||
      typeof options.routePath !== 'string' ||
      !options.position ||
      !Array.isArray(options.layerCanvases) ||
      !Array.isArray(options.stations) ||
      !options.metrics ||
      !Array.isArray(options.activeLayers)
    ) {
      throw new TypeError(
        'Snapshot requires map, route, position, layers, stations, and telemetry data.'
      );
    }
    var canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 800;
    var context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas is unavailable; the mission snapshot could not be generated.');
    }
    var night = options.night;
    var text = night ? '#e2e8f0' : '#0f172a';
    var muted = night ? '#94a3b8' : '#475569';
    context.fillStyle = night ? '#0f172a' : '#f8fafc';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = text;
    context.font = '600 38px "Segoe UI", Arial, sans-serif';
    context.fillText('SYRTIS MAJOR · FIELD SNAPSHOT', 40, 70);
    context.fillStyle = muted;
    context.font = '500 22px "Segoe UI", Arial, sans-serif';
    context.fillText('Mars  |  MC-13  |  8.4°N, 69.5°E  |  OreWay surface assessment', 40, 108);
    var mapX = 40;
    var mapY = 150;
    context.drawImage(options.mapCanvas, mapX, mapY, 700, 612);
    options.layerCanvases.forEach(function (layer) {
      if (layer.enabled) {
        context.globalAlpha = 0.82;
        context.drawImage(layer.canvas, mapX, mapY, 700, 612);
        context.globalAlpha = 1;
      }
    });
    if (night) {
      context.fillStyle = 'rgba(5,10,40,.5)';
      context.fillRect(mapX, mapY, 700, 612);
    }
    context.save();
    context.beginPath();
    context.rect(mapX, mapY, 700, 612);
    context.clip();
    context.translate(mapX, mapY);
    context.scale(0.875, 0.875);
    context.fillStyle = 'rgba(183,101,109,.22)';
    context.strokeStyle = '#b7656d';
    context.lineWidth = 4;
    context.setLineDash([10, 7]);
    context.beginPath();
    context.arc(400, 330, 86, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.strokeStyle = '#5aa77a';
    context.lineWidth = 7;
    context.setLineDash([]);
    context.stroke(new Path2D(options.routePath));
    options.stations.forEach(function (station) {
      context.fillStyle = '#17271f';
      context.strokeStyle = '#5aa77a';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(station.x, station.y - 46, 26, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.fillStyle = '#b7e4c7';
      context.font = '600 24px "Segoe UI", Arial, sans-serif';
      context.textAlign = 'center';
      context.fillText(station.marker, station.x, station.y - 37);
    });
    context.fillStyle = '#fff';
    context.strokeStyle = '#5aa77a';
    context.lineWidth = 4;
    context.beginPath();
    context.arc(options.position.x, options.position.y, 12, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.restore();
    context.strokeStyle = '#64748b';
    context.lineWidth = 2;
    context.strokeRect(mapX, mapY, 700, 612);
    context.textAlign = 'left';
    var rows = [
      ['Mission mode', night ? 'Night Ops' : 'Day Ops'],
      ['Distance walked', options.metrics.distanceKm.toFixed(1) + ' km of 8.3 km'],
      ['Oxygen level', options.metrics.oxygenPercent + '%'],
      ['Estimated return', options.metrics.returnMinutes + ' min'],
      ['Signal', options.signalWeak ? 'Orbiter relay' : 'Base Camp direct'],
      [
        'Active layers',
        options.activeLayers.length
          ? options.activeLayers.join(' + ').toUpperCase()
          : 'TERRAIN'
      ]
    ];
    rows.forEach(function (row, index) {
      var y = 200 + index * 88;
      context.fillStyle = muted;
      context.font = '500 20px "Segoe UI", Arial, sans-serif';
      context.fillText(row[0], 780, y);
      context.fillStyle = text;
      context.font = '700 30px "Segoe UI", Arial, sans-serif';
      context.fillText(row[1], 780, y + 38);
    });
    context.fillStyle = muted;
    context.font = '500 18px "Segoe UI", Arial, sans-serif';
    context.fillText(
      'Illustrative planning model · not operational mission data  |  ' +
      new Date().toISOString().replace('T', ' ').slice(0, 16) +
      ' UTC',
      40,
      785
    );
    return canvas.toDataURL('image/png');
  }
  global.OreWayTelemetry = {
    distanceAtRouteLength: distanceAtRouteLength,
    slopeClass: slopeClass,
    traverseMetrics: traverseMetrics,
    distanceToSegment: distanceToSegment,
    isInsideHazard: isInsideHazard,
    createAudioUtilities: createAudioUtilities,
    createSnapshot: createSnapshot
  };
}
(window));
