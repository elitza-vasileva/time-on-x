$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$distDirectory = Join-Path $projectRoot "dist"
$manifest = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "manifest.json") | ConvertFrom-Json
$version = $manifest.version
$stagingDirectory = Join-Path $distDirectory "package-v$version"
$zipPath = Join-Path $distDirectory "time-on-x-extension-v$version.zip"
$resolvedRoot = [System.IO.Path]::GetFullPath($projectRoot)
$resolvedDist = [System.IO.Path]::GetFullPath($distDirectory)
$resolvedStaging = [System.IO.Path]::GetFullPath($stagingDirectory)

if (-not $resolvedDist.StartsWith($resolvedRoot + [System.IO.Path]::DirectorySeparatorChar)) {
  throw "Refusing to package outside the project directory."
}
if (-not $resolvedStaging.StartsWith($resolvedDist + [System.IO.Path]::DirectorySeparatorChar)) {
  throw "Refusing to stage outside the dist directory."
}

$requiredIcons = @(16, 32, 48, 128) | ForEach-Object { Join-Path $projectRoot "icons\icon-$_.png" }
foreach ($icon in $requiredIcons) {
  if (-not (Test-Path -LiteralPath $icon)) { throw "Missing icon $icon. Run npm run icons first." }
}
$instantRuntime = Join-Path $projectRoot "global\instant-runtime.js"
if (-not (Test-Path -LiteralPath $instantRuntime)) { throw "Missing bundled InstantDB client. Run npm run build first." }

New-Item -ItemType Directory -Path $distDirectory -Force | Out-Null
if (Test-Path -LiteralPath $stagingDirectory) { Remove-Item -LiteralPath $stagingDirectory -Recurse -Force }
New-Item -ItemType Directory -Path $stagingDirectory -Force | Out-Null

@("manifest.json", "service-worker.js", "content-script.js") | ForEach-Object {
  Copy-Item -LiteralPath (Join-Path $projectRoot $_) -Destination $stagingDirectory
}
@("lib", "popup", "dashboard", "leaderboard", "settings", "icons") | ForEach-Object {
  Copy-Item -LiteralPath (Join-Path $projectRoot $_) -Destination $stagingDirectory -Recurse
}
$globalTarget = Join-Path $stagingDirectory "global"
New-Item -ItemType Directory -Path $globalTarget -Force | Out-Null
@("config.js", "instant-runtime.js", "leaderboard-client.js", "periods.js") | ForEach-Object {
  Copy-Item -LiteralPath (Join-Path $projectRoot "global\$_") -Destination $globalTarget
}

if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
Compress-Archive -Path (Join-Path $stagingDirectory "*") -DestinationPath $zipPath -CompressionLevel Optimal
Remove-Item -LiteralPath $stagingDirectory -Recurse -Force
Write-Output "Created $zipPath"
