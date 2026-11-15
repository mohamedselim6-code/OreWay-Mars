/* Mission briefing overlay. Independent of map rendering. */
(function () {
  'use strict';

  var modal = document.getElementById('briefing');
  var dismiss = document.getElementById('briefingDismiss');
  var background = [
    document.querySelector('header.bar'),
    document.querySelector('main'),
    document.getElementById('app')
  ];

  if (!modal || !dismiss) return;

  document.body.classList.add('briefing-open');
  background.forEach(function (node) {
    if (node) node.inert = true;
  });
  dismiss.focus();

  dismiss.addEventListener('click', function () {
    modal.hidden = true;
    document.body.classList.remove('briefing-open');
    background.forEach(function (node) {
      if (node) node.inert = false;
    });
    var start = document.getElementById('start');
    if (start) start.focus();
  });
})();
