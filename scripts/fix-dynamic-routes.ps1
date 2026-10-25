# Add dynamic = "force-dynamic" to all API routes that use auth guards

$apiDir = "src\app\api"

# Find all route.ts files
Get-ChildItem -Path $apiDir -Filter "route.ts" -Recurse | ForEach-Object {
    $file = $_.FullName
    $content = Get-Content $file -Raw -Encoding UTF8
    
    # Check if file uses auth guards
    if ($content -match 'from "@/lib/auth/guards"') {
        # Check if dynamic export already exists
        if ($content -notmatch 'export const dynamic') {
            # Find the first import line and add dynamic export after it
            $firstImportLine = ($content -split "`n" | Where-Object { $_ -match '^import ' } | Select-Object -First 1)
            
            if ($firstImportLine) {
                $newContent = $content -replace "($firstImportLine)", "$1`n`nexport const dynamic = `"force-dynamic`";"
                Set-Content -Path $file -Value $newContent -Encoding UTF8
                Write-Host "Updated: $file"
            }
        } else {
            Write-Host "Already has dynamic: $file"
        }
    }
}

Write-Host "`nDone!"