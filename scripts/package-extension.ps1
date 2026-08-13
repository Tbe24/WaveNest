param(
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$distPath = Join-Path $projectRoot 'dist'
$manifestPath = Join-Path $distPath 'manifest.json'
$releasePath = Join-Path $projectRoot 'release'

Set-Location $projectRoot

if (-not $SkipBuild) {
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) {
    throw 'Production build failed.'
  }
}

if (-not (Test-Path -LiteralPath $manifestPath)) {
  throw 'dist/manifest.json is missing. Run the production build first.'
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$requiredIcons = @('16', '32', '48', '128')
foreach ($size in $requiredIcons) {
  $iconRelativePath = $manifest.icons.$size
  if (-not $iconRelativePath -or -not (Test-Path -LiteralPath (Join-Path $distPath $iconRelativePath))) {
    throw "Required $size px icon is missing from the package."
  }
}

New-Item -ItemType Directory -Force -Path $releasePath | Out-Null
$zipPath = Join-Path $releasePath ("WaveNest-{0}.zip" -f $manifest.version)

if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath
}

Compress-Archive -Path (Join-Path $distPath '*') -DestinationPath $zipPath -CompressionLevel Optimal

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  if (-not ($archive.Entries.FullName -contains 'manifest.json')) {
    throw 'Package validation failed: manifest.json is not at the ZIP root.'
  }
} finally {
  $archive.Dispose()
}

Write-Host "Created Chrome Web Store package: $zipPath"
