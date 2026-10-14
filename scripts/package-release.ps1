param([string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$manifest = Get-Content -LiteralPath (Join-Path $root 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$version = $manifest.version
$files = @('manifest.json','extractor.js','popup.html','popup.css','popup.js','page-reader.js','README.md','LICENSE','assets/ladino.svg','assets/hero-journey-LICENSE.txt','assets/popup-preview.png','icons/icon.svg','icons/icon-16.png','icons/icon-48.png','icons/icon-128.png','icons/icon-512.png')
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$dist = if ($OutputDirectory) { [IO.Path]::GetFullPath($OutputDirectory) } else { Join-Path $root 'dist' }
New-Item -ItemType Directory -Path $dist -Force | Out-Null
$archivePath = Join-Path $dist "snapmd-$version.zip"
if (Test-Path -LiteralPath $archivePath) { throw "O arquivo já existe: $archivePath. Escolha outro destino ou remova-o explicitamente antes de repetir." }
foreach ($file in $files) { if (!(Test-Path -LiteralPath (Join-Path $root $file) -PathType Leaf)) { throw "Arquivo ausente: $file" } }
$archive = [IO.Compression.ZipFile]::Open($archivePath,[IO.Compression.ZipArchiveMode]::Create)
try { foreach ($file in $files) { [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,(Join-Path $root $file),$file,[IO.Compression.CompressionLevel]::Optimal) | Out-Null } } finally { $archive.Dispose() }
$check = [IO.Compression.ZipFile]::OpenRead($archivePath)
try {
    $entries = @($check.Entries | ForEach-Object FullName)
    if ($entries.Count -ne $files.Count -or @($entries | Where-Object { $_ -notin $files }).Count -gt 0 -or 'manifest.json' -notin $entries) { throw 'Conteúdo inesperado no ZIP.' }
} finally { $check.Dispose() }
Write-Output "Release empacotada: snapmd-$version.zip ($($files.Count) arquivos)"