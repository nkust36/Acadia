<#
Creates a GitHub repository via API and pushes current project to it.
Usage (PowerShell):

$env:GITHUB_TOKEN = "ghp_...yourtoken..."
./scripts/create_and_push.ps1 -RepoName "arch-to-view-main" -Description "Initial commit" -Private:$false

Notes:
- Requires Git installed locally.
- The script will create the remote repo using your token, then initialize git (if needed), commit and push to the new remote.
- For the push step you may be prompted for credentials if your Git credential helper isn't configured. You can use a PAT as password when prompted.
#>

param(
  [Parameter(Mandatory=$false)]
  [string]$RepoName = "arch-to-view-main",

  [Parameter(Mandatory=$false)]
  [string]$Description = "",

  [Parameter(Mandatory=$false)]
  [switch]$Private
)

function Abort([string]$msg) {
  Write-Error $msg
  exit 1
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Abort "git not found. Please install Git and re-run the script."
}

if (-not $env:GITHUB_TOKEN) {
  Abort "Please set environment variable GITHUB_TOKEN with a Personal Access Token that has 'repo' scope. Example: $env:GITHUB_TOKEN = 'ghp_...'")
}

$body = [pscustomobject]@{
  name = $RepoName
  description = $Description
  private = [bool]$Private.IsPresent
}

$headers = @{
  Authorization = "token $($env:GITHUB_TOKEN)"
  Accept = 'application/vnd.github+json'
  'User-Agent' = 'arch-to-view-script'
}

Write-Host "Creating repository '$RepoName' on GitHub..."
try {
  $resp = Invoke-RestMethod -Uri "https://api.github.com/user/repos" -Method Post -Headers $headers -Body ($body | ConvertTo-Json -Depth 5)
} catch {
  Abort "Failed to create repo: $($_.Exception.Message)"
}

$cloneUrl = $resp.clone_url
$ownerLogin = $resp.owner.login
Write-Host "Created repo: $($resp.html_url)"

# Initialize git if needed
if (-not (Test-Path .git)) {
  git init
  git add .
  git commit -m "chore: initial commit"
} else {
  Write-Host ".git already exists — skipping init/commit"
}

# Add remote (remove existing origin if exists)
$existing = git remote 2>$null
if ($existing -match "origin") {
  Write-Host "Remote 'origin' already exists. Will set URL to new repo."
  git remote set-url origin $cloneUrl
} else {
  git remote add origin $cloneUrl
}

Write-Host "Pushing to remote... (may ask for credentials)"
# Attempt push; if credentials required, user can provide username/password (use PAT as password)
$push = git push -u origin main 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Warning "Push failed. Output:\n$push"
  Write-Host "If push failed due to authentication, ensure your Git credential helper is configured or provide your GitHub username and PAT when prompted."
  exit $LASTEXITCODE
}

Write-Host "Push completed. Repository available at: $($resp.html_url)"
