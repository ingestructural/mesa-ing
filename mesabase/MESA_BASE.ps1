# ==========================================================================
#  MESA_BASE.ps1  -  ING Estructural  (25-11-2026)
#  Clic derecho en el Explorador > «Usar como carpeta base de la Mesa ING».
#
#  Chrome no deja que un programa externo le entregue una carpeta a la Mesa,
#  por eso se usa un puente fijo: Documentos\MesaBase, que se elige UNA vez en
#  la Mesa con «Elegir carpeta base…». Este script lo redirige: quita la unión
#  anterior (solo el enlace) y crea Documentos\MesaBase -> carpeta elegida
#  (unión de Windows, mklink /J, sin administrador; funciona con Dropbox).
#  La Mesa sigue con la misma carpeta base y ve el contenido nuevo.
#  Registro de la última carpeta asignada: %APPDATA%\ING\mesa_base.json
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

  # 1. quitar el puente anterior: si es una unión, se quita solo el enlace (la carpeta destino no se toca).
  #    Versión del 25-11 (carpeta real con un enlace adentro + _mesa_base.json): se quitan esos dos y la carpeta vacía.
  $item = Get-Item -LiteralPath $puente -Force -ErrorAction SilentlyContinue
  if ($item) {
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
      [void](Cmd ('rmdir "' + $puente + '"'))
    } else {
      Get-ChildItem -LiteralPath $puente -Force -Directory | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint } | ForEach-Object { [void](Cmd ('rmdir "' + $_.FullName + '"')) }
      Remove-Item -LiteralPath (Join-Path $puente '_mesa_base.json') -Force -ErrorAction SilentlyContinue
      if (Get-ChildItem -LiteralPath $puente -Force) { throw 'Documentos\MesaBase tiene archivos propios y no se toca. Muévalos a otra carpeta y vuelva a intentar.' }
      [IO.Directory]::Delete($puente)
    }
    if (Test-Path -LiteralPath $puente) { throw 'No se pudo quitar el puente anterior Documentos\MesaBase.' }
  }

  # 2. Documentos\MesaBase = unión a la carpeta elegida (Chrome sí acepta una unión elegida como carpeta base,
  #    pero oculta las uniones que hay DENTRO de una carpeta; por eso el puente es la unión misma)
  $out = Cmd ('mklink /J "' + $puente + '" "' + $real + '"')
  if (-not (Test-Path -LiteralPath $puente)) { throw "No se pudo crear el enlace: $out" }

  # 3. registro de la carpeta asignada (fuera de la carpeta del proyecto)
  $json = [ordered]@{ carpeta = (Split-Path -Leaf $real); ruta = $real; fecha = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ss') } | ConvertTo-Json -Compress
  [IO.File]::WriteAllText((Join-Path $logDir 'mesa_base.json'), $json, (New-Object Text.UTF8Encoding($false)))

  Log "OK  $real"
  Aviso 'Mesa ING' ("Carpeta base: " + (Split-Path -Leaf $real) + "`n" + $real) $false
} catch {
  Log ("ERROR  $Carpeta  " + $_.Exception.Message)
  Aviso 'Mesa ING - no cambió la carpeta base' $_.Exception.Message $true
}
