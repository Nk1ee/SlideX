#requires -Version 7.0

param(
  [string]$SourcePath = "docs/themes/first-eight-rendered.png",
  [string]$OutputPath = "docs/themes/telegram-theme-choice.png"
)

Add-Type -AssemblyName System.Drawing

$source = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $SourcePath))
$canvas = New-Object System.Drawing.Bitmap 1200, 1600
$graphics = [System.Drawing.Graphics]::FromImage($canvas)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#F4F7FB'))

$titleFont = New-Object System.Drawing.Font 'Segoe UI', 40, ([System.Drawing.FontStyle]::Bold)
$subtitleFont = New-Object System.Drawing.Font 'Segoe UI', 22, ([System.Drawing.FontStyle]::Regular)
$labelFont = New-Object System.Drawing.Font 'Segoe UI', 19, ([System.Drawing.FontStyle]::Bold)
$numberFont = New-Object System.Drawing.Font 'Segoe UI', 24, ([System.Drawing.FontStyle]::Bold)
$darkBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#17223A'))
$mutedBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#536078'))
$whiteBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$numberBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#2563EB'))
$cardBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$borderPen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#D8E0EB'), 2)

$center = New-Object System.Drawing.StringFormat
$center.Alignment = [System.Drawing.StringAlignment]::Center
$graphics.DrawString('Выберите оформление', $titleFont, $darkBrush, (New-Object System.Drawing.RectangleF 0, 35, 1200, 60), $center)
$graphics.DrawString('Отправьте боту номер от 1 до 8', $subtitleFont, $mutedBrush, (New-Object System.Drawing.RectangleF 0, 100, 1200, 45), $center)

$items = @(
  @{ Number = 1; Name = 'Деловой · глубокий синий'; X = 40;   Y = 161 },
  @{ Number = 2; Name = 'Деловой · светлый сланец'; X = 420;  Y = 161 },
  @{ Number = 3; Name = 'Деловой · тёмный изумруд'; X = 800;  Y = 161 },
  @{ Number = 4; Name = 'Минимализм · светлый';      X = 1180; Y = 161 },
  @{ Number = 5; Name = 'Минимализм · графитовый';   X = 40;   Y = 501 },
  @{ Number = 6; Name = 'Минимализм · тёплый песок'; X = 1180; Y = 501 },
  @{ Number = 7; Name = 'Динамичный · фиолетовый';   X = 420;  Y = 501 },
  @{ Number = 8; Name = 'Динамичный · коралловый';   X = 800;  Y = 501 }
)

for ($index = 0; $index -lt $items.Count; $index++) {
  $item = $items[$index]
  $column = $index % 2
  $row = [Math]::Floor($index / 2)
  $cardX = 40 + ($column * 570)
  $cardY = 165 + ($row * 350)
  $cardRect = New-Object System.Drawing.Rectangle $cardX, $cardY, 550, 325
  $graphics.FillRectangle($cardBrush, $cardRect)
  $graphics.DrawRectangle($borderPen, $cardRect)

  $graphics.FillEllipse($numberBrush, $cardX + 18, $cardY + 15, 54, 54)
  $numberRect = New-Object System.Drawing.RectangleF ($cardX + 18), ($cardY + 19), 54, 48
  $graphics.DrawString([string]$item.Number, $numberFont, $whiteBrush, $numberRect, $center)
  $labelRect = New-Object System.Drawing.RectangleF ($cardX + 88), ($cardY + 18), 440, 55
  $graphics.DrawString($item.Name, $labelFont, $darkBrush, $labelRect)

  $sourceRect = New-Object System.Drawing.Rectangle $item.X, $item.Y, 351, 197
  $targetRect = New-Object System.Drawing.Rectangle ($cardX + 18), ($cardY + 84), 514, 224
  $graphics.DrawImage($source, $targetRect, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
}

$outputDirectory = Split-Path -Parent $OutputPath
if ($outputDirectory) { New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null }
$canvas.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

$borderPen.Dispose(); $cardBrush.Dispose(); $numberBrush.Dispose(); $whiteBrush.Dispose()
$mutedBrush.Dispose(); $darkBrush.Dispose(); $numberFont.Dispose(); $labelFont.Dispose()
$subtitleFont.Dispose(); $titleFont.Dispose(); $graphics.Dispose(); $canvas.Dispose(); $source.Dispose()
