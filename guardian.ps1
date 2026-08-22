# FW Discover guardian — keeps master loop + dashboard alive across sleep/crash/reboot.
# Run every 10 min by Task Scheduler. Restarts a component only if actually down.
# NOTE: PS 5.1 — keep cmd strings single-quoted (double-quoted "&&" broke the parser).
$root = 'C:\ccode\discover-analyzer'
$log  = Join-Path $root 'logs\guardian.log'
function Log($m) { "$([DateTime]::UtcNow.ToString('s'))Z  $m" | Out-File -Append -Encoding utf8 $log }

# --- master loop: dead if port 3210 unbound OR last heartbeat > 30 min old ---
$loopUp = [bool](Get-NetTCPConnection -LocalPort 3210 -State Listen -EA SilentlyContinue)
if ($loopUp) {
  $hb = Select-String -Path (Join-Path $root 'logs\master-loop.log') -Pattern 'heartbeat (\S+)' -EA SilentlyContinue |
        Select-Object -Last 1
  if ($hb -and $hb.Matches[0].Groups[1].Value) {
    $age = ([DateTime]::UtcNow - [DateTime]::Parse($hb.Matches[0].Groups[1].Value).ToUniversalTime()).TotalMinutes
    if ($age -gt 30) { $loopUp = $false; Log ('loop heartbeat stale (' + [int]$age + 'm) - restarting') }
  }
}
if (-not $loopUp) {
  Start-Process cmd -ArgumentList ('/c cd /d ' + $root + ' && node src\cli.js master >> logs\master-loop.log 2>&1') -WindowStyle Hidden
  Log 'master loop (re)started'
}

# --- dashboard on :3100 ---
if (-not (Get-NetTCPConnection -LocalPort 3100 -State Listen -EA SilentlyContinue)) {
  Start-Process cmd -ArgumentList ('/c cd /d ' + $root + ' && node src\cli.js dashboard >> logs\dashboard.log 2>&1') -WindowStyle Hidden
  Log 'dashboard (re)started'
}

exit 0
