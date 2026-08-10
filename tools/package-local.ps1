$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BuildRoot = Join-Path $ProjectRoot "build"
$ReleaseRoot = Join-Path $ProjectRoot "release"

node (Join-Path $PSScriptRoot "prepare-release.mjs")
if ($LASTEXITCODE -ne 0) { throw "Release preparation failed" }
New-Item -ItemType Directory -Force -Path $ReleaseRoot | Out-Null

function New-ForwardSlashZip {
  param([string]$SourceDirectory, [string]$DestinationPath)
  $source = [System.IO.Path]::GetFullPath($SourceDirectory)
  $stream = [System.IO.File]::Open(
    [System.IO.Path]::GetFullPath($DestinationPath),
    [System.IO.FileMode]::Create,
    [System.IO.FileAccess]::ReadWrite,
    [System.IO.FileShare]::None
  )
  try {
    $archive = [System.IO.Compression.ZipArchive]::new(
      $stream,
      [System.IO.Compression.ZipArchiveMode]::Create,
      $false
    )
    try {
      Get-ChildItem -LiteralPath $source -Recurse -File | ForEach-Object {
        $relative = $_.FullName.Substring($source.Length).TrimStart([char]'\', [char]'/').Replace('\', '/')
        $entry = $archive.CreateEntry($relative, [System.IO.Compression.CompressionLevel]::Optimal)
        $entryStream = $entry.Open()
        $fileStream = [System.IO.File]::OpenRead($_.FullName)
        try { $fileStream.CopyTo($entryStream) }
        finally { $fileStream.Dispose(); $entryStream.Dispose() }
      }
    } finally { $archive.Dispose() }
  } finally { $stream.Dispose() }
}

$tag = "v2.3.26"
$chromeZip = Join-Path $ReleaseRoot "flow-batch-storyboard-${tag}-chrome.zip"
$firefoxZip = Join-Path $ReleaseRoot "flow-batch-storyboard-${tag}-firefox.zip"
New-ForwardSlashZip (Join-Path $BuildRoot "chrome") $chromeZip
New-ForwardSlashZip (Join-Path $BuildRoot "firefox") $firefoxZip
Get-Item -LiteralPath $chromeZip, $firefoxZip | Select-Object Name, Length

