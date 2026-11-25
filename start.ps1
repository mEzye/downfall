$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add('http://localhost:4173/')
$listener.Start()
Write-Host 'DOWNFALL: http://localhost:4173 (Ctrl+C to stop)'
$mime = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.ttf'='font/ttf'; '.woff2'='font/woff2'; '.txt'='text/plain; charset=utf-8' }
try {
  while ($listener.IsListening) {
    $request = $listener.GetContext()
    $relative = [Uri]::UnescapeDataString($request.Request.Url.AbsolutePath).TrimStart('/')
    if (!$relative) { $relative = 'index.html' }
    $file = [IO.Path]::GetFullPath((Join-Path $root $relative))
    if (!$file.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or !(Test-Path -LiteralPath $file -PathType Leaf)) {
      $request.Response.StatusCode = 404
      $request.Response.Close()
      continue
    }
    $bytes = [IO.File]::ReadAllBytes($file)
    $type = $mime[[IO.Path]::GetExtension($file)]
    if (!$type) { $type = 'application/octet-stream' }
    $request.Response.ContentType = $type
    $request.Response.ContentLength64 = $bytes.Length
    $request.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $request.Response.Close()
  }
} finally { $listener.Stop(); $listener.Close() }
