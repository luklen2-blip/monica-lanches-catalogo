# Script de Geração de Pacote de Deploy Instantâneo (.ZIP) na Área de Trabalho
$ErrorActionPreference = "Stop"

$desktopPath = [Environment]::GetFolderPath("Desktop")
$projPath = Split-Path -Parent $MyInvocation.MyCommand.Definition
$zipName = "monica-lanches-catalogo-deploy.zip"
$zipPath = Join-Path $desktopPath $zipName

Write-Host "📦 Gerando pacote de deploy limpo em: $zipPath..." -ForegroundColor Cyan

# Remover pacote antigo se existir
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

# Criar pasta temporária para staging
$tempStage = Join-Path $env:TEMP ("monica_stage_" + (Get-Random))
New-Item -ItemType Directory -Path $tempStage -Force | Out-Null

try {
    # Copiar fontes excluindo lixo, node_modules e logs
    $excludeList = @("node_modules", ".git", "*.log", "*.zip", "*.bat", "tests/test_cloud_live.js")
    
    Get-ChildItem -Path $projPath -Recurse | ForEach-Object {
        $relPath = $_.FullName.Substring($projPath.Length).TrimStart("\/")
        
        $skip = $false
        foreach ($exc in $excludeList) {
            if ($relPath -like "$exc*" -or $relPath -like "*\$exc*") {
                $skip = $true
                break
            }
        }

        if (-not $skip) {
            $dest = Join-Path $tempStage $relPath
            if ($_.PSIsContainer) {
                if (-not (Test-Path $dest)) { New-Item -ItemType Directory -Path $dest -Force | Out-Null }
            } else {
                $destParent = Split-Path -Parent $dest
                if (-not (Test-Path $destParent)) { New-Item -ItemType Directory -Path $destParent -Force | Out-Null }
                Copy-Item $_.FullName -Destination $dest -Force
            }
        }
    }

    # Compactar
    Compress-Archive -Path "$tempStage\*" -DestinationPath $zipPath -Force
    $sizeMb = [math]::Round(((Get-Item $zipPath).Length / 1MB), 2)
    Write-Host "✅ Pacote gerado com sucesso: $zipPath ($sizeMb MB)" -ForegroundColor Green
    Write-Host "🚀 Pronto para upload imediato no GitHub / Render / Railway!" -ForegroundColor Yellow
} finally {
    if (Test-Path $tempStage) {
        Remove-Item $tempStage -Recurse -Force -ErrorAction SilentlyContinue
    }
}
