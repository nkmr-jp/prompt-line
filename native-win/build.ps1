# Build WindowDetector.dll for Windows native tools
Write-Host "Building WindowDetector.dll for Windows..." -ForegroundColor Green

# Clean previous build
if (Test-Path "bin") {
    Remove-Item -Recurse -Force "bin"
}
if (Test-Path "obj") {
    Remove-Item -Recurse -Force "obj"
}

# Build the project
try {
    dotnet build --configuration Release --runtime win-x64
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed"
    }
    
    # Copy DLL to native-tools directory
    $sourceDir = "bin\Release\net8.0-windows\win-x64"
    $targetDir = "..\src\native-tools"
    
    if (!(Test-Path $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir -Force
    }
    
    Copy-Item "$sourceDir\WindowDetector.dll" "$targetDir\WindowDetector.dll" -Force
    
    # Also copy required runtime configuration files
    if (Test-Path "$sourceDir\WindowDetector.runtimeconfig.json") {
        Copy-Item "$sourceDir\WindowDetector.runtimeconfig.json" "$targetDir\WindowDetector.runtimeconfig.json" -Force
    }
    
    if (Test-Path "$sourceDir\WindowDetector.deps.json") {
        Copy-Item "$sourceDir\WindowDetector.deps.json" "$targetDir\WindowDetector.deps.json" -Force
    }
    
    Write-Host "✅ WindowDetector.dll built successfully!" -ForegroundColor Green
    Write-Host "📦 DLL copied to: $targetDir" -ForegroundColor Cyan
}
catch {
    Write-Host "❌ Build failed: $_" -ForegroundColor Red
    exit 1
}