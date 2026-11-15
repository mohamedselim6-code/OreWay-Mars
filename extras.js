/* Add the Solar Particle Event simulation controls without replacing app handlers. */
(function () {
  'use strict';

  var guideButton = document.getElementById('guideBtn');
  var alertPanel = document.querySelector('.system-alerts');
  var signalDelay = document.querySelector('.deck-critical p[title^="Autonomous decision support"]');

  if (!guideButton || !alertPanel || !signalDelay) {
    console.error('Solar Particle Event controls could not initialize: required UI elements are missing.');
    return;
  }

  var solarAlert = document.createElement('p');
  solarAlert.id = 'solarEventAlert';
  solarAlert.className = 'system-alert-item';
  solarAlert.hidden = true;
  solarAlert.textContent =
    'Simulated Solar Particle Event active. Elevated radiation risk; return guidance to Base Camp is enabled.';
  alertPanel.appendChild(solarAlert);

  var simulateButton = document.createElement('button');
  simulateButton.id = 'simulateSpeBtn';
  simulateButton.type = 'button';
  simulateButton.className = 'big home';
  simulateButton.textContent = 'Simulate Solar Particle Event';
  guideButton.insertAdjacentElement('afterend', simulateButton);

  var resetButton = null;
  function resetControls() {
    simulateButton.disabled = false;
    solarAlert.hidden = true;
    if (resetButton) {
      resetButton.remove();
      resetButton = null;
    }
  }

  function addResetButton() {
    resetButton = document.createElement('button');
    resetButton.id = 'resetSpeBtn';
    resetButton.type = 'button';
    resetButton.className = 'big fun';
    resetButton.textContent = 'Reset Solar Particle Event';
    resetButton.addEventListener('click', function () {
      document.dispatchEvent(new CustomEvent('oreway:spe-reset'));
    });
    simulateButton.insertAdjacentElement('afterend', resetButton);
  }

  simulateButton.addEventListener('click', function () {
    simulateButton.disabled = true;
    addResetButton();
    document.dispatchEvent(new CustomEvent('oreway:spe-start'));
  });

  document.addEventListener('oreway:spe-reset', resetControls);
  document.addEventListener('oreway:spe-rejected', resetControls);

  var delayNote = document.createElement('small');
  delayNote.className = 'fn';
  delayNote.textContent =
    '14m 20s delay: Houston cannot intervene in time, so the local system supports autonomous decisions.';
  signalDelay.insertAdjacentElement('afterend', delayNote);
})();
