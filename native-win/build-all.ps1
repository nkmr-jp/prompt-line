# Build all Windows native tools
Write-Host "Building Windows native tools..." -ForegroundColor Green

$projects = @("window-detector", "keyboard-simulator", "text-field-detector")
$outputDir = "..\src\native-tools"

# Create output directory
if (!(Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$success = $true

foreach ($project in $projects) {
    Write-Host "Building $project..." -ForegroundColor Cyan
    
    try {
        Push-Location $project
        dotnet build --configuration Release --runtime win-x64
        
        if ($LASTEXITCODE -ne 0) {
            throw "Build failed for $project"
        }
        
        $buildDir = "bin\Release\net8.0-windows\win-x64"
        
        # Copy main executable
        $exeName = "$project.exe"
        $sourceExePath = "$buildDir\$exeName"
        $targetExePath = "..\$outputDir\$exeName"
        
        if (Test-Path $sourceExePath) {
            Copy-Item $sourceExePath $targetExePath -Force
            Write-Host "✅ $exeName copied successfully" -ForegroundColor Green
        } else {
            throw "Built executable not found: $sourceExePath"
        }
        
        # Copy all related files (dll, runtimeconfig.json, deps.json)
        $baseFileName = $project
        $filesToCopy = @("$baseFileName.dll", "$baseFileName.runtimeconfig.json", "$baseFileName.deps.json")
        
        foreach ($fileName in $filesToCopy) {
            $sourceFilePath = "$buildDir\$fileName"
            $targetFilePath = "..\$outputDir\$fileName"
            
            if (Test-Path $sourceFilePath) {
                Copy-Item $sourceFilePath $targetFilePath -Force
                Write-Host "✅ $fileName copied successfully" -ForegroundColor Green
            } else {
                Write-Host "⚠️ $fileName not found (optional)" -ForegroundColor Yellow
            }
        }
    }
    catch {
        Write-Host "❌ Failed to build $project : $_" -ForegroundColor Red
        $success = $false
    }
    finally {
        Pop-Location
    }
}

if ($success) {
    Write-Host "`n✅ All Windows native tools built successfully!" -ForegroundColor Green
    Write-Host "📦 Binaries located in: $outputDir" -ForegroundColor Cyan
    
    # List built files
    Write-Host "`nBuilt files:" -ForegroundColor Yellow
    Get-ChildItem "$outputDir\*.exe" | ForEach-Object { Write-Host "  $($_.Name)" -ForegroundColor White }
} else {
    Write-Host "`n❌ Some builds failed" -ForegroundColor Red
    exit 1
}