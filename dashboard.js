/* Console readouts and distress control. Independent of map rendering. */
(function () {
  'use strict';

  var deckO2 = document.getElementById('deckO2');
  var o2Value = document.getElementById('o2Value');
  var sos = document.getElementById('sosBtn');
  var note = document.getElementById('sosNote');

  function syncOxygen() {
    if (!deckO2 || !o2Value) return;
    deckO2.textContent = 'Suit O2: ' + o2Value.textContent.trim();
  }

  if (deckO2 && o2Value && window.MutationObserver) {
    new MutationObserver(syncOxygen).observe(o2Value, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  if (!sos) return;
  sos.addEventListener('click', function () {
    var armed = sos.getAttribute('aria-pressed') !== 'true';
    sos.setAttribute('aria-pressed', armed ? 'true' : 'false');
    if (note) note.textContent = armed ? 'Distress call armed' : '';
  });
})();
