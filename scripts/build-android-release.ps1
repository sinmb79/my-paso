[CmdletBinding()]
param(
    [ValidateRange(1, 2100000000)]
    [int]$VersionCode = 2,

    [ValidatePattern('^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$')]
    [string]$VersionName = '0.2.0',

    [switch]$SkipWebBuild
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$previousLocation = Get-Location
$mappedDrive = $null

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory)]
        [string]$Executable,

        [Parameter(ValueFromRemainingArguments)]
        [string[]]$CommandArguments
    )

    & $Executable @CommandArguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Executable failed with exit code $LASTEXITCODE."
    }
}

try {
    Set-Location -LiteralPath $projectRoot

    if (-not $env:JAVA_HOME) {
        $env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
    }
    if (-not $env:ANDROID_HOME) {
        $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
    }

    $javaExecutable = Join-Path $env:JAVA_HOME 'bin\java.exe'
    if (-not (Test-Path -LiteralPath $javaExecutable)) {
        throw "Java was not found at $javaExecutable."
    }
    if (-not (Test-Path -LiteralPath $env:ANDROID_HOME)) {
        throw "Android SDK was not found at $env:ANDROID_HOME."
    }

    if (-not $env:MY_PASO_UPLOAD_KEYSTORE_PROPERTIES) {
        $env:MY_PASO_UPLOAD_KEYSTORE_PROPERTIES = Join-Path $HOME 'key\my-paso-upload.properties'
    }
    if (-not (Test-Path -LiteralPath $env:MY_PASO_UPLOAD_KEYSTORE_PROPERTIES)) {
        throw "Signing properties were not found at $env:MY_PASO_UPLOAD_KEYSTORE_PROPERTIES."
    }

    $env:MY_PASO_VERSION_CODE = $VersionCode.ToString()
    $env:MY_PASO_VERSION_NAME = $VersionName

    if (-not $SkipWebBuild) {
        Invoke-CheckedCommand 'npm.cmd' 'run' 'build:mobile'
        Invoke-CheckedCommand 'npx.cmd' 'cap' 'sync' 'android'
    }

    $availableDrive = 'P','Q','R','S','T','U','V','W','X','Y','Z' |
        Where-Object { -not (Test-Path "${_}:\") } |
        Select-Object -First 1
    if (-not $availableDrive) {
        throw 'No free drive letter is available for the Android build path mapping.'
    }

    $mappedDrive = "${availableDrive}:"
    Invoke-CheckedCommand 'subst.exe' $mappedDrive $projectRoot
    Set-Location -LiteralPath "$mappedDrive\android"

    $bundlePath = Join-Path $projectRoot 'android\app\build\outputs\bundle\release\app-release.aab'
    if (Test-Path -LiteralPath $bundlePath) {
        Remove-Item -LiteralPath $bundlePath -Force
    }

    Invoke-CheckedCommand '.\gradlew.bat' ':app:bundleRelease' '--no-daemon' '--console=plain'
    if (-not (Test-Path -LiteralPath $bundlePath)) {
        throw "Gradle completed without producing $bundlePath."
    }

    $bundle = Get-Item -LiteralPath $bundlePath
    $hash = Get-FileHash -LiteralPath $bundlePath -Algorithm SHA256
    Write-Output "AAB=$($bundle.FullName)"
    Write-Output "BYTES=$($bundle.Length)"
    Write-Output "SHA256=$($hash.Hash)"
} finally {
    Set-Location -LiteralPath $previousLocation
    if ($mappedDrive) {
        & subst.exe $mappedDrive /D | Out-Null
    }
}
