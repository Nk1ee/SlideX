param(
  [string]$RenderedDirectory = 'work/theme-samples/rendered',
  [string]$OutputPath = 'docs/themes/first-eight-rendered.png'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$themes = @(
  @{ Id = 'deep_blue'; Label = 'Деловой' },
  @{ Id = 'business_slate'; Label = 'Деловой' },
  @{ Id = 'business_emerald'; Label = 'Деловой' },
  @{ Id = 'minimal_light'; Label = 'Минималистичный' },
  @{ Id = 'minimal_graphite'; Label = 'Минималистичный' },
  @{ Id = 'dynamic_violet'; Label = 'Динамичный' },
  @{ Id = 'dynamic_coral'; Label = 'Динамичный' },
  @{ Id = 'minimal_sand'; Label = 'Минималистичный' }
)
$canvas = [System.Drawing.Bitmap]::new(1600, 850)
$graphics = [System.Drawing.Graphics]::FromImage($canvas)
$titleFont = [System.Drawing.Font]::new('Arial', 32, [System.Drawing.FontStyle]::Bold)
$labelFont = [System.Drawing.Font]::new('Arial', 14, [System.Drawing.FontStyle]::Regular)
$ink = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(23, 34, 58))
$border = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(204, 212, 223), 1)
try {
  $graphics.Clear([System.Drawing.Color]::FromArgb(245, 247, 251))
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $title = 'Первые 8 визуальных тем SlideX — реальный PPTX'
  $titleSize = $graphics.MeasureString($title, $titleFont)
  $graphics.DrawString($title, $titleFont, $ink, [single]((1600 - $titleSize.Width) / 2), [single]38)
  for ($index = 0; $index -lt $themes.Count; $index++) {
    $theme = $themes[$index]
    $x = 40 + ($index % 4) * 380
    $y = 160 + [math]::Floor($index / 4) * 340
    $graphics.DrawString(("$($theme.Id) · $($theme.Label)"), $labelFont, $ink, [single]$x, [single]($y - 29))
    $slidePath = Join-Path $RenderedDirectory "$($theme.Id)/slide-1.png"
    $image = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $slidePath).Path)
    try {
      $graphics.DrawImage($image, [System.Drawing.Rectangle]::new($x, $y, 350, 197))
      $graphics.DrawRectangle($border, $x, $y, 350, 197)
    }
    finally {
      $image.Dispose()
    }
  }
  $outputDirectory = Split-Path -Parent $OutputPath
  New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
  $canvas.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Output "Saved $OutputPath"
}
finally {
  $border.Dispose()
  $ink.Dispose()
  $labelFont.Dispose()
  $titleFont.Dispose()
  $graphics.Dispose()
  $canvas.Dispose()
}
