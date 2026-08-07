$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$iconDirectory = Join-Path $projectRoot "icons"
New-Item -ItemType Directory -Path $iconDirectory -Force | Out-Null

Add-Type -AssemblyName System.Drawing

function New-RoundedPath([float]$x, [float]$y, [float]$width, [float]$height, [float]$radius) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $radius * 2
  $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
  $path.AddArc($x + $width - $diameter, $y, $diameter, $diameter, 270, 90)
  $path.AddArc($x + $width - $diameter, $y + $height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($x, $y + $height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

foreach ($size in @(16, 32, 48, 128)) {
  $bitmap = New-Object System.Drawing.Bitmap($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $inset = [Math]::Max(1, $size * 0.035)
  $backgroundPath = New-RoundedPath $inset $inset ($size - 2 * $inset) ($size - 2 * $inset) ($size * 0.24)
  $backgroundBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 23, 21, 34))
  $graphics.FillPath($backgroundBrush, $backgroundPath)

  $clockInset = $size * 0.19
  $clockPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 132, 117, 239), [Math]::Max(1.5, $size * 0.095))
  $graphics.DrawEllipse($clockPen, $clockInset, $clockInset, $size - 2 * $clockInset, $size - 2 * $clockInset)

  $handPen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [Math]::Max(1.2, $size * 0.075))
  $handPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $handPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $center = $size / 2
  $graphics.DrawLine($handPen, $center, $center, $center, $size * 0.32)
  $graphics.DrawLine($handPen, $center, $center, $size * 0.67, $size * 0.59)

  $outputPath = Join-Path $iconDirectory "icon-$size.png"
  $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $handPen.Dispose()
  $clockPen.Dispose()
  $backgroundBrush.Dispose()
  $backgroundPath.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

Write-Output "Generated Chrome icons in $iconDirectory"
