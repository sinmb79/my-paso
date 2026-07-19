[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$sourceIconPath = Join-Path $projectRoot 'docs\mobile\store-assets\icon-512.png'
$resourceRoot = Join-Path $projectRoot 'android\app\src\main\res'

if (-not (Test-Path -LiteralPath $sourceIconPath)) {
    throw "Generate the Play Store icon first: $sourceIconPath"
}

Add-Type -AssemblyName System.Drawing
$sourceIcon = [System.Drawing.Image]::FromFile($sourceIconPath)
$amber = [System.Drawing.ColorTranslator]::FromHtml('#FBBF24')
$dark = [System.Drawing.ColorTranslator]::FromHtml('#0C0A09')
$muted = [System.Drawing.ColorTranslator]::FromHtml('#A8A29E')

function New-LauncherIcon {
    param(
        [int]$Size,
        [string]$OutputPath,
        [switch]$Round
    )

    $bitmap = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
            $graphics.Clear([System.Drawing.Color]::Transparent)
            $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

            if ($Round) {
                $clip = New-Object System.Drawing.Drawing2D.GraphicsPath
                try {
                    $clip.AddEllipse(0, 0, $Size, $Size)
                    $graphics.SetClip($clip)
                    $graphics.DrawImage($sourceIcon, 0, 0, $Size, $Size)
                    $graphics.ResetClip()
                } finally {
                    $clip.Dispose()
                }
            } else {
                $graphics.DrawImage($sourceIcon, 0, 0, $Size, $Size)
            }
        } finally {
            $graphics.Dispose()
        }
        $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $bitmap.Dispose()
    }
}

function New-AdaptiveForeground {
    param(
        [int]$Size,
        [string]$OutputPath
    )

    $bitmap = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
            $graphics.Clear([System.Drawing.Color]::Transparent)
            $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
            $centerX = [single]($Size * 0.5)
            $centerY = [single]($Size * 0.43)
            $radius = [single]($Size * 0.15)
            $pen = New-Object System.Drawing.Pen($amber, [single]([Math]::Max(2, $Size * 0.027)))
            $brush = New-Object System.Drawing.SolidBrush($amber)
            try {
                $graphics.DrawEllipse($pen, $centerX - $radius, $centerY - $radius, $radius * 2, $radius * 2)
                $dotRadius = [single]($Size * 0.04)
                $graphics.FillEllipse($brush, $centerX - $dotRadius, $centerY - $dotRadius, $dotRadius * 2, $dotRadius * 2)
                $tail = [System.Drawing.PointF[]]@(
                    [System.Drawing.PointF]::new($centerX - $Size * 0.055, $centerY + $radius * 0.78),
                    [System.Drawing.PointF]::new($centerX + $Size * 0.055, $centerY + $radius * 0.78),
                    [System.Drawing.PointF]::new($centerX, $centerY + $Size * 0.24)
                )
                $graphics.FillPolygon($brush, $tail)
            } finally {
                $pen.Dispose()
                $brush.Dispose()
            }
        } finally {
            $graphics.Dispose()
        }
        $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $bitmap.Dispose()
    }
}

function New-SplashImage {
    param([string]$OutputPath)

    $existing = [System.Drawing.Image]::FromFile($OutputPath)
    try {
        $width = $existing.Width
        $height = $existing.Height
    } finally {
        $existing.Dispose()
    }

    $bitmap = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    try {
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
            $graphics.Clear($dark)
            $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
            $scale = [single]([Math]::Min($width, $height))
            $centerX = [single]($width / 2)
            $centerY = [single]($height * 0.39)
            $glowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(22, $amber))
            $amberBrush = New-Object System.Drawing.SolidBrush($amber)
            $mutedBrush = New-Object System.Drawing.SolidBrush($muted)
            $pen = New-Object System.Drawing.Pen($amber, [single]([Math]::Max(3, $scale * 0.018)))
            try {
                $glowRadius = [single]($scale * 0.29)
                $graphics.FillEllipse($glowBrush, $centerX - $glowRadius, $centerY - $glowRadius, $glowRadius * 2, $glowRadius * 2)
                $pinRadius = [single]($scale * 0.105)
                $graphics.DrawEllipse($pen, $centerX - $pinRadius, $centerY - $pinRadius, $pinRadius * 2, $pinRadius * 2)
                $dotRadius = [single]($scale * 0.027)
                $graphics.FillEllipse($amberBrush, $centerX - $dotRadius, $centerY - $dotRadius, $dotRadius * 2, $dotRadius * 2)
                $tail = [System.Drawing.PointF[]]@(
                    [System.Drawing.PointF]::new($centerX - $scale * 0.04, $centerY + $pinRadius * 0.78),
                    [System.Drawing.PointF]::new($centerX + $scale * 0.04, $centerY + $pinRadius * 0.78),
                    [System.Drawing.PointF]::new($centerX, $centerY + $scale * 0.18)
                )
                $graphics.FillPolygon($amberBrush, $tail)

                $titleFont = New-Object System.Drawing.Font('Segoe UI', [single]($scale * 0.075), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
                $subtitleFont = New-Object System.Drawing.Font('Segoe UI', [single]($scale * 0.027), [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
                $format = New-Object System.Drawing.StringFormat
                try {
                    $format.Alignment = [System.Drawing.StringAlignment]::Center
                    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
                    $graphics.DrawString('MY PASO', $titleFont, $amberBrush, [System.Drawing.RectangleF]::new(0, $height * 0.62, $width, $scale * 0.11), $format)
                    $graphics.DrawString('LOCAL-FIRST JOURNAL', $subtitleFont, $mutedBrush, [System.Drawing.RectangleF]::new(0, $height * 0.73, $width, $scale * 0.07), $format)
                } finally {
                    $format.Dispose()
                    $titleFont.Dispose()
                    $subtitleFont.Dispose()
                }
            } finally {
                $glowBrush.Dispose()
                $amberBrush.Dispose()
                $mutedBrush.Dispose()
                $pen.Dispose()
            }
        } finally {
            $graphics.Dispose()
        }

        $temporaryPath = "$OutputPath.tmp.png"
        $bitmap.Save($temporaryPath, [System.Drawing.Imaging.ImageFormat]::Png)
        Move-Item -LiteralPath $temporaryPath -Destination $OutputPath -Force
    } finally {
        $bitmap.Dispose()
    }
}

try {
    $densities = @(
        @{ Folder = 'mipmap-mdpi'; Icon = 48; Foreground = 108 },
        @{ Folder = 'mipmap-hdpi'; Icon = 72; Foreground = 162 },
        @{ Folder = 'mipmap-xhdpi'; Icon = 96; Foreground = 216 },
        @{ Folder = 'mipmap-xxhdpi'; Icon = 144; Foreground = 324 },
        @{ Folder = 'mipmap-xxxhdpi'; Icon = 192; Foreground = 432 }
    )

    foreach ($density in $densities) {
        $folder = Join-Path $resourceRoot $density.Folder
        New-LauncherIcon -Size $density.Icon -OutputPath (Join-Path $folder 'ic_launcher.png')
        New-LauncherIcon -Size $density.Icon -OutputPath (Join-Path $folder 'ic_launcher_round.png') -Round
        New-AdaptiveForeground -Size $density.Foreground -OutputPath (Join-Path $folder 'ic_launcher_foreground.png')
    }

    Get-ChildItem -LiteralPath $resourceRoot -Recurse -Filter 'splash.png' | ForEach-Object {
        New-SplashImage -OutputPath $_.FullName
    }

    Write-Output 'Android launcher icons and splash screens generated.'
} finally {
    $sourceIcon.Dispose()
}
