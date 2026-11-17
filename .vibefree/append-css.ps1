$p = Join-Path $PSScriptRoot '..\style.css'
$c = Get-Content -Raw $p
if ($c.Contains('.research-objectives {')) { 'already present'; exit 0 }

$lines = @(
  '',
  '/* Scientific Objectives (static sidebar box, sits below the layer toggles) */',
  '.research-objectives {',
  '  margin: 0 0 .65rem;',
  '  padding: 1rem;',
  '  background: #131313;',
  '  border: 1px solid #333333;',
  '  border-radius: 8px;',
  '  color: #FFFFFF;',
  '  font-size: .8rem;',
  '  line-height: 1.5',
  '}',
  '',
  '.research-objectives h3 {',
  '  margin: 0 0 .6rem;',
  '  color: #FFFFFF;',
  '  font: 600 .85rem/1.4 var(--body);',
  '  letter-spacing: .04em;',
  '  text-transform: uppercase',
  '}',
  '',
  '.research-objectives .ro-lead {',
  '  margin: 0 0 .45rem;',
  '  color: #FFFFFF;',
  '  font: 600 .78rem/1.45 var(--body)',
  '}',
  '',
  '.research-objectives .ro-list {',
  '  margin: 0;',
  '  padding-left: 1.1rem;',
  '  list-style: decimal outside;',
  '  color: #FFFFFF'
  '}',
  '',
  '.research-objectives .ro-list li {',
  '  margin: 0 0 .5rem;',
  '  color: #FFFFFF;',
  '  font-size: .78rem;',
  '  line-height: 1.5;',
  '  overflow-wrap: anywhere',
  '}',
  '',
  '.research-objectives .ro-list li:last-child {',
  '  margin-bottom: 0',
  '}',
  ''
)
$block = ($lines -join "`r`n")
[System.IO.File]::AppendAllText($p, $block, (New-Object System.Text.UTF8Encoding($false)))
'appended'
