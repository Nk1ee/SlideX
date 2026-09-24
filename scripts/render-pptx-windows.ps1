param(
  [Parameter(Mandatory=$true)][string]$PptxPath,
  [Parameter(Mandatory=$true)][string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
$inputPath = (Resolve-Path -LiteralPath $PptxPath).Path
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$outputPath = (Resolve-Path -LiteralPath $OutputDirectory).Path
$app = $null
$presentation = $null
try {
  $app = New-Object -ComObject PowerPoint.Application
  $presentation = $app.Presentations.Open($inputPath, $true, $false, $false)
  for ($number = 1; $number -le $presentation.Slides.Count; $number++) {
    $slide = $presentation.Slides.Item($number)
    $slide.Export((Join-Path $outputPath "slide-$number.png"), 'PNG', 1600, 900)
  }
  Write-Output "Rendered $($presentation.Slides.Count) slides to $outputPath"
}
finally {
  if ($presentation) { $presentation.Close(); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($presentation) }
  if ($app) { $app.Quit(); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($app) }
}
