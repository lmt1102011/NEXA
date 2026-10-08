param([string]$OutDir = "$PSScriptRoot\..\public\icons")

Add-Type -AssemblyName System.Drawing

$bg = [System.Drawing.Color]::FromArgb(255, 16, 17, 24)
$stroke = [System.Drawing.Color]::FromArgb(255, 124, 116, 255)

function New-NexaIcon {
  param([int]$Size, [string]$FilePath, [switch]$Maskable)

  $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.PixelOffsetMode = 'HighQuality'
  $g.Clear([System.Drawing.Color]::Transparent)

  $s = $Size / 512.0

  if ($Maskable) {
    $g.FillRectangle((New-Object System.Drawing.SolidBrush($bg)), 0, 0, $Size, $Size)
    $g.TranslateTransform($Size * 0.15, $Size * 0.15)
    $g.ScaleTransform(0.7, 0.7)
    $s = $Size / 512.0
  }
  else {
    $r = [int](116 * $s)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $r * 2
    $path.AddArc(0, 0, $d, $d, 180, 90)
    $path.AddArc($Size - $d, 0, $d, $d, 270, 90)
    $path.AddArc($Size - $d, $Size - $d, $d, $d, 0, 90)
    $path.AddArc(0, $Size - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    $g.FillPath((New-Object System.Drawing.SolidBrush($bg)), $path)
    $path.Dispose()
  }

  $pen = New-Object System.Drawing.Pen($stroke, [float](48 * $s))
  $pen.StartCap = 'Round'
  $pen.EndCap = 'Round'
  $pen.LineJoin = 'Round'

  $pts = @(
    (New-Object System.Drawing.PointF([float](152 * $s), [float](368 * $s))),
    (New-Object System.Drawing.PointF([float](152 * $s), [float](152 * $s))),
    (New-Object System.Drawing.PointF([float](360 * $s), [float](360 * $s))),
    (New-Object System.Drawing.PointF([float](360 * $s), [float](144 * $s)))
  )
  $g.DrawLines($pen, $pts)
  $pen.Dispose()
  $g.Dispose()

  $bmp.Save($FilePath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Output "wrote $FilePath"
}

New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
New-NexaIcon -Size 512 -FilePath (Join-Path $OutDir 'icon-512.png')
New-NexaIcon -Size 192 -FilePath (Join-Path $OutDir 'icon-192.png')
New-NexaIcon -Size 180 -FilePath (Join-Path $OutDir 'apple-touch-icon.png')
New-NexaIcon -Size 512 -FilePath (Join-Path $OutDir 'maskable-512.png') -Maskable
