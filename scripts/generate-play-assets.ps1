[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$assetDir = Join-Path $projectRoot 'docs\mobile\store-assets'
$browserCandidates = @(
    'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
    'C:\Program Files\Google\Chrome\Application\chrome.exe',
    'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
)
$browser = $browserCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $browser) {
    throw 'Microsoft Edge or Google Chrome is required to render the Play Store assets.'
}

$profileDir = Join-Path $env:TEMP ('my-paso-play-assets-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $profileDir | Out-Null

try {
    $jobs = @(
        @{ Html = 'icon-512.html'; Raw = 'icon-512.raw.png'; Width = 512; Height = 512 },
        @{ Html = 'feature-graphic.html'; Raw = 'feature-graphic.raw.png'; Width = 1024; Height = 500 }
    )

    foreach ($job in $jobs) {
        $htmlPath = Join-Path $assetDir $job.Html
        $rawPath = Join-Path $assetDir $job.Raw
        Remove-Item -LiteralPath $rawPath -Force -ErrorAction SilentlyContinue
        $uri = [System.Uri]::new($htmlPath).AbsoluteUri

        & $browser '--headless=new' '--disable-gpu' '--hide-scrollbars' `
            '--force-device-scale-factor=1' '--run-all-compositor-stages-before-draw' `
            "--window-size=$($job.Width),$($job.Height)" "--user-data-dir=$profileDir" `
            "--screenshot=$rawPath" $uri 2>$null

        for ($attempt = 0; $attempt -lt 20 -and -not (Test-Path -LiteralPath $rawPath); $attempt++) {
            Start-Sleep -Milliseconds 250
        }
        if (-not (Test-Path -LiteralPath $rawPath)) {
            throw "The browser did not render $($job.Html)."
        }
    }

    Add-Type -AssemblyName System.Drawing
    $outputs = @(
        @{
            Raw = 'icon-512.raw.png'
            Output = 'icon-512.png'
            Width = 512
            Height = 512
            PixelFormat = [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
        },
        @{
            Raw = 'feature-graphic.raw.png'
            Output = 'feature-graphic.png'
            Width = 1024
            Height = 500
            PixelFormat = [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
        }
    )

    foreach ($item in $outputs) {
        $rawPath = Join-Path $assetDir $item.Raw
        $outputPath = Join-Path $assetDir $item.Output
        $source = [System.Drawing.Image]::FromFile($rawPath)
        try {
            if ($source.Width -ne $item.Width -or $source.Height -ne $item.Height) {
                throw "Unexpected dimensions for $($item.Raw): $($source.Width)x$($source.Height)."
            }

            $bitmap = New-Object System.Drawing.Bitmap($source.Width, $source.Height, $item.PixelFormat)
            try {
                $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
                try {
                    $graphics.DrawImageUnscaled($source, 0, 0)
                } finally {
                    $graphics.Dispose()
                }
                $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
            } finally {
                $bitmap.Dispose()
            }
        } finally {
            $source.Dispose()
        }
        Remove-Item -LiteralPath $rawPath -Force
    }

    Get-ChildItem -LiteralPath $assetDir -Filter '*.png' | ForEach-Object {
        $image = [System.Drawing.Image]::FromFile($_.FullName)
        try {
            Write-Output "$($_.Name)=$($image.Width)x$($image.Height),$($image.PixelFormat),$($_.Length)bytes"
        } finally {
            $image.Dispose()
        }
    }
} finally {
    Remove-Item -LiteralPath $profileDir -Recurse -Force -ErrorAction SilentlyContinue
    $global:LASTEXITCODE = 0
}
