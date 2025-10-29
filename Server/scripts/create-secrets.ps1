param(
    [string]$EnvFile = $(Join-Path -Path (Split-Path -Parent $PSScriptRoot) -ChildPath '.env'),
    [string]$Project = $(gcloud config get-value project 2>$null)
)

if (!(Test-Path $EnvFile)) {
    Write-Error "Unable to locate .env file at $EnvFile. Update the path or supply -EnvFile.";
    exit 1
}

if (-not $Project) {
    Write-Error "No active gcloud project. Run 'gcloud config set project <PROJECT_ID>' or pass -Project.";
    exit 1
}

$envContent = Get-Content -Path $EnvFile -Raw

function Get-DotEnvValue {
    param(
        [string]$Key
    )

    $escaped = [regex]::Escape($Key)
    $patternQuoted = '(?ms)^[ \t]*{0}[ \t]*=[ \t]*"(.*?)"[ \t]*(?:\r?\n|$)' -f $escaped
    $match = [regex]::Match($envContent, $patternQuoted)
    if ($match.Success) {
        return $match.Groups[1].Value
    }

    $patternPlain = '(?m)^[ \t]*{0}[ \t]*=[ \t]*([^\r\n#]+)' -f $escaped
    $match = [regex]::Match($envContent, $patternPlain)
    if ($match.Success) {
        return $match.Groups[1].Value.Trim()
    }

    return $null
}

$secrets = @(
    @{ Name = 'GEMINI_API_KEY'; Key = 'GEMINI_API_KEY' },
    @{ Name = 'PINECONE_API_KEY'; Key = 'PINECONE_API_KEY' },
    @{ Name = 'PINECONE_ENVIRONMENT'; Key = 'PINECONE_ENVIRONMENT' },
    @{ Name = 'PINECONE_INDEX_NAME'; Key = 'PINECONE_INDEX_NAME' },
    @{ Name = 'FIREBASE_PROJECT_ID'; Key = 'FIREBASE_PROJECT_ID' },
    @{ Name = 'FIREBASE_CLIENT_EMAIL'; Key = 'FIREBASE_CLIENT_EMAIL' },
    @{ Name = 'FIREBASE_PRIVATE_KEY'; Key = 'FIREBASE_PRIVATE_KEY' },
    @{ Name = 'ALLOWED_ORIGINS'; Key = 'ALLOWED_ORIGINS' },
    @{ Name = 'JWT_SECRET'; Key = 'JWT_SECRET' }
)

$tempFiles = @()

try {
    foreach ($secret in $secrets) {
        $value = Get-DotEnvValue -Key $secret.Key
        if ([string]::IsNullOrWhiteSpace($value)) {
            Write-Warning "Skipping $($secret.Name) (no value found in .env)"
            continue
        }

        $describe = & gcloud secrets describe $secret.Name --format="value(name)" 2>$null
        if (-not $describe) {
            Write-Host "Creating secret: $($secret.Name)" -ForegroundColor Cyan
            & gcloud secrets create $secret.Name --replication-policy="automatic" | Out-Null
        } else {
            Write-Host "Secret exists, uploading new version: $($secret.Name)" -ForegroundColor Yellow
        }

        $tempFile = [System.IO.Path]::GetTempFileName()
        $tempFiles += $tempFile
        [System.IO.File]::WriteAllText($tempFile, $value)

        & gcloud secrets versions add $secret.Name --data-file=$tempFile | Out-Null
    }
}
finally {
    foreach ($file in $tempFiles) {
        if (Test-Path $file) {
            Remove-Item $file -Force
        }
    }
}

Write-Host "Done. Review secrets with 'gcloud secrets list'." -ForegroundColor Green
