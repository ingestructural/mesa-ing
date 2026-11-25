# ==========================================================================
#  MESA_BASE.ps1  -  ING Estructural  (25-11-2026)
#  Clic derecho en el Explorador > «Usar como carpeta base de la Mesa ING».
#
#  Chrome no deja que un programa externo le entregue una carpeta a la Mesa,
#  por eso se usa un puente fijo: Documentos\MesaBase (carpeta normal que se
#  elige UNA vez en la Mesa con «Elegir carpeta base…»). Este script:
#    1. borra dentro de MesaBase los enlaces (uniones) anteriores - SOLO los
#       enlaces, nunca carpetas ni archivos reales;
#    2. crea MesaBase\<nombre de la carpeta>  ->  carpeta elegida (unión de
#       Windows, mklink /J, sin administrador; funciona también con Dropbox);
#    3. escribe MesaBase\_mesa_base.json {nombre, ruta, fecha}. La Mesa lo
#       lee y entra directo a esa carpeta, mostrando su nombre real.
#  No se escribe nada dentro de la carpeta del proyecto.
#  Registro: %APPDATA%\ING\mesa_base.log
# ==========================================================================
param([string]$Carpeta)

$ErrorActionPreference = 'Stop'
$puente = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'MesaBase'
$logDir = Join-Path $env:APPDATA 'ING'
$log    = Join-Path $logDir 'mesa_base.log'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
function Log($t){ try { Add-Content -LiteralPath $log -Value ((Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '  ' + $t) -Encoding UTF8 } catch {} }

function Cmd($argumentos){
  $psi = New-Object Diagnostics.ProcessStartInfo 'cmd.exe', ('/d /c ' + $argumentos)
  $psi.UseShellExecute = $false; $psi.CreateNoWindow = $true; $psi.RedirectStandardOutput = $true; $psi.RedirectStandardError = $true
  $p = [Diagnostics.Process]::Start($psi); $o = $p.StandardOutput.ReadToEnd() + $p.StandardError.ReadToEnd(); $p.WaitForExit(); return $o
}
function Aviso($titulo, $texto, $error){
  try {
    Add-Type -AssemblyName System.Windows.Forms, System.Drawing
    $n = New-Object System.Windows.Forms.NotifyIcon
    $ico = Join-Path $PSScriptRoot 'mesa_base_ing.ico'
    if (Test-Path -LiteralPath $ico) { $n.Icon = New-Object System.Drawing.Icon $ico } else { $n.Icon = [System.Drawing.SystemIcons]::Information }
    $n.BalloonTipTitle = $titulo
    $n.BalloonTipText  = $texto
    $n.BalloonTipIcon  = $(if ($error) { 'Error' } else { 'Info' })
    $n.Visible = $true
    $n.ShowBalloonTip(5000)
    Start-Sleep -Seconds 6
    $n.Dispose()
  } catch {}
}

try {
  if (-not $Carpeta) { throw 'No llegó ninguna carpeta.' }
  $Carpeta = $Carpeta.Trim('"').TrimEnd('\')
  if ($Carpeta -match '^[A-Za-z]:$') { $Carpeta += '\' }
  if (-not (Test-Path -LiteralPath $Carpeta -PathType Container)) { throw "No existe la carpeta: $Carpeta" }
  $real = (Get-Item -LiteralPath $Carpeta -Force).FullName.TrimEnd('\')
  if ($real -match '^[A-Za-z]:$') { $real += '\' }
  if ($real.TrimEnd('\') -ieq $puente -or $real.StartsWith($puente + '\', 'OrdinalIgnoreCase')) { throw 'Esa carpeta es el puente MesaBase; elija la carpeta del proyecto.' }

  New-Item -ItemType Directory -Force -Path $puente | Out-Null

  # 1. quitar enlaces anteriores (solo puntos de reanálisis: uniones/enlaces)
  Get-ChildItem -LiteralPath $puente -Force -Directory | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint } | ForEach-Object {
    [void](Cmd ('rmdir "' + $_.FullName + '"'))
    if (Test-Path -LiteralPath $_.FullName) { throw "No se pudo quitar el enlace anterior: $($_.Name)" }
  }

  # 2. nombre del enlace = nombre real de la carpeta (sin caracteres no válidos)
  $nombre = Split-Path -Leaf $real
  if (-not $nombre -or $real -match '^[A-Za-z]:\\$') { $nombre = 'Unidad ' + $real.Substring(0,1) }
  foreach ($c in [IO.Path]::GetInvalidFileNameChars()) { $nombre = $nombre.Replace([string]$c, '_') }
  $base = $nombre; $i = 2
  while (Test-Path -LiteralPath (Join-Path $puente $nombre)) { $nombre = "$base ($i)"; $i++ }   # hay una carpeta real con ese nombre: no se toca
  $enlace = Join-Path $puente $nombre
  $out = Cmd ('mklink /J "' + $enlace + '" "' + $real + '"')
  if (-not (Test-Path -LiteralPath $enlace)) { throw "No se pudo crear el enlace: $out" }

  # 3. referencia para la Mesa (UTF-8 sin BOM)
  $json = [ordered]@{ nombre = $nombre; carpeta = (Split-Path -Leaf $real); ruta = $real; fecha = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ss') } | ConvertTo-Json -Compress
  [IO.File]::WriteAllText((Join-Path $puente '_mesa_base.json'), $json, (New-Object Text.UTF8Encoding($false)))

  Log "OK  $real"
  Aviso 'Mesa ING' ("Carpeta base: " + (Split-Path -Leaf $real) + "`n" + $real) $false
} catch {
  Log ("ERROR  $Carpeta  " + $_.Exception.Message)
  Aviso 'Mesa ING - no cambió la carpeta base' $_.Exception.Message $true
}
