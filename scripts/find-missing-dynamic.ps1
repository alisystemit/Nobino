# Find remaining files missing dynamic export

$apiDir = "src\app\api"
$results = @()

Get-ChildItem -Path $apiDir -Filter "route.ts" -Recurse | ForEach-Object {
    $file = $_.FullName
    $content = Get-Content $file

    # Check if file uses auth guards but doesn't have dynamic export
    $hasAuth = $content -match 'from "@/lib/auth/guards"'
    $hasDynamic = $content -match 'export const dynamic'

    if ($hasAuth -and -not $hasDynamic) {
        $results += $file
    }
}

$results | ForEach-Object { Write-Host $_ }

Write-Host "`nTotal: $($results.Count) files need fixing"