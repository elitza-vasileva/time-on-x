$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$assetDirectory = Join-Path $projectRoot "store-assets"
$sourcePath = Join-Path $assetDirectory "rankings-source.png"
if (-not (Test-Path -LiteralPath $sourcePath)) { throw "Missing $sourcePath" }

function Save-Png($bitmap, $path) {
  if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Force }
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

$source = [System.Drawing.Image]::FromFile($sourcePath)
try {
  $screenshot = New-Object System.Drawing.Bitmap 1280, 800
  try {
    $graphics = [System.Drawing.Graphics]::FromImage($screenshot)
    try {
      $graphics.Clear([System.Drawing.Color]::FromArgb(246, 244, 248))
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $scale = [Math]::Min(1240 / $source.Width, 760 / $source.Height)
      $width = [int]($source.Width * $scale)
      $height = [int]($source.Height * $scale)
      $x = [int]((1280 - $width) / 2)
      $y = [int]((800 - $height) / 2)
      $graphics.DrawImage($source, $x, $y, $width, $height)

      # Refresh the two headings embedded in the historical demonstration screenshot.
      $headingBackground = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
      $headingInk = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(22, 20, 31))
      $headingMuted = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(113, 105, 124))
      $headingFont = New-Object System.Drawing.Font "Segoe UI", 15, ([System.Drawing.FontStyle]::Bold)
      $subtitleFont = New-Object System.Drawing.Font "Segoe UI", 6.7, ([System.Drawing.FontStyle]::Regular)
      try {
        $graphics.FillRectangle($headingBackground, 100, 51, 760, 57)
        $graphics.DrawString("How does your time on X compare?", $headingFont, $headingInk, 115, 51)
        $graphics.DrawString("Opt-in, self-reported totals from people using Time on X. Exact visit timestamps and email addresses are never public.", $subtitleFont, $headingMuted, 116, 86)
      } finally {
        $headingBackground.Dispose(); $headingInk.Dispose(); $headingMuted.Dispose()
        $headingFont.Dispose(); $subtitleFont.Dispose()
      }
    } finally { $graphics.Dispose() }
    Save-Png $screenshot (Join-Path $assetDirectory "time-on-x-store-screenshot-1-1280x800.png")
  } finally { $screenshot.Dispose() }
} finally { $source.Dispose() }

$promo = New-Object System.Drawing.Bitmap 440, 280
try {
  $graphics = [System.Drawing.Graphics]::FromImage($promo)
  try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $bounds = New-Object System.Drawing.Rectangle 0, 0, 440, 280
    $gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush $bounds, ([System.Drawing.Color]::FromArgb(23, 21, 34)), ([System.Drawing.Color]::FromArgb(81, 66, 199)), 25
    try { $graphics.FillRectangle($gradient, $bounds) } finally { $gradient.Dispose() }

    $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $soft = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(199, 193, 214))
    $purple = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(170, 156, 248))
    $logoInk = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(23, 21, 34))
    $logoFont = New-Object System.Drawing.Font "Segoe UI", 22, ([System.Drawing.FontStyle]::Bold)
    $titleFont = New-Object System.Drawing.Font "Segoe UI", 29, ([System.Drawing.FontStyle]::Bold)
    $bodyFont = New-Object System.Drawing.Font "Segoe UI", 11, ([System.Drawing.FontStyle]::Regular)
    $labelFont = New-Object System.Drawing.Font "Segoe UI", 10, ([System.Drawing.FontStyle]::Bold)
    try {
      $graphics.FillRectangle($white, 30, 27, 52, 52)
      $graphics.DrawString("X", $logoFont, $logoInk, 42, 34)
      $graphics.DrawString("TIME ON X", $labelFont, $white, 98, 33)
      $graphics.DrawString("ATTENTION, MADE VISIBLE", $bodyFont, $purple, 98, 52)
      $graphics.DrawString("See your time.", $titleFont, $white, 28, 103)
      $graphics.DrawString("Compare the pattern.", $titleFont, $white, 28, 143)
      $graphics.DrawString("Private exact visits  |  Optional public rankings", $bodyFont, $soft, 30, 202)
      $bars = @(26, 43, 31, 66, 49, 82, 59, 96)
      for ($index = 0; $index -lt $bars.Count; $index++) {
        $height = $bars[$index]
        $alpha = 90 + ($index * 18)
        $barBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb([Math]::Min(230, $alpha), 184, 170, 255))
        try { $graphics.FillRectangle($barBrush, 287 + ($index * 15), 253 - $height, 9, $height) } finally { $barBrush.Dispose() }
      }
    } finally {
      $white.Dispose(); $soft.Dispose(); $purple.Dispose(); $logoInk.Dispose()
      $logoFont.Dispose(); $titleFont.Dispose(); $bodyFont.Dispose(); $labelFont.Dispose()
    }
  } finally { $graphics.Dispose() }
  Save-Png $promo (Join-Path $assetDirectory "time-on-x-small-promo-440x280.png")
} finally { $promo.Dispose() }

Write-Output "Generated Chrome Web Store assets in $assetDirectory"
