# Sobe tudo que o backend precisa no Windows: Docker (Postgres) + API em modo dev.
# Equivalente ao start.sh. Uso: .\start.cmd  (ou .\start.ps1, se a política de execução permitir)
# Salvo como UTF-8 com BOM: sem o BOM, o Windows PowerShell 5.1 estraga os acentos.
Set-Location $PSScriptRoot

# Não use $ErrorActionPreference = 'Stop': no PowerShell 5.1 ele transforma qualquer
# saída em stderr de docker/npm em exceção. Os erros são checados via $LASTEXITCODE.
function Falhar([string]$mensagem) {
  Write-Host "ERRO: $mensagem" -ForegroundColor Red
  exit 1
}

function DockerAtivo {
  docker info *> $null
  return $LASTEXITCODE -eq 0
}

Write-Host '== Linker backend =='

# 0. Pré-requisitos
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Falhar 'Docker não encontrado. Instale o Docker Desktop: https://docs.docker.com/desktop/setup/install/windows-install/'
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Falhar 'Node.js não encontrado. Instale o Node.js 20 ou mais novo: https://nodejs.org'
}

# 1. .env
if (-not (Test-Path .env)) {
  Copy-Item .env.example .env
  Write-Host '-> .env criado a partir de .env.example (ajuste as credenciais se precisar).'
}

# 2. Docker daemon
if (-not (DockerAtivo)) {
  Write-Host '-> Docker não está rodando.'
  $dockerDesktop = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
  if (Test-Path $dockerDesktop) {
    Write-Host '-> Abrindo o Docker Desktop...'
    Start-Process $dockerDesktop
    for ($i = 0; $i -lt 60 -and -not (DockerAtivo); $i++) { Start-Sleep -Seconds 2 }
  }
  if (-not (DockerAtivo)) {
    Falhar 'não consegui conectar ao Docker. Abra o Docker Desktop, espere ele terminar de iniciar e rode .\start.cmd de novo.'
  }
}

# 3. Postgres via docker compose
Write-Host '-> Subindo o Postgres (docker compose up -d db)...'
docker compose up -d db
if ($LASTEXITCODE -ne 0) {
  Falhar ('falha ao subir o Postgres. Se a porta 5432 já estiver em uso (por exemplo, um PostgreSQL ' +
    'instalado no Windows), pare esse serviço em services.msc ou remapeie a porta localmente.')
}

Write-Host '-> Aguardando o Postgres ficar saudável...'
$dbStatus = ''
for ($i = 0; $i -lt 30; $i++) {
  $cid = docker compose ps -q db
  if ($cid) { $dbStatus = docker inspect -f '{{.State.Health.Status}}' $cid 2> $null }
  if ($dbStatus -eq 'healthy') { break }
  Start-Sleep -Seconds 2
}
if ($dbStatus -ne 'healthy') {
  Falhar 'Postgres não ficou saudável a tempo. Veja: docker compose logs db'
}
Write-Host '-> Postgres pronto.'

# 4. Dependências Node
if (-not (Test-Path node_modules)) {
  Write-Host '-> Instalando dependências (npm install)...'
  npm install
  if ($LASTEXITCODE -ne 0) { Falhar 'npm install falhou. Veja a saída acima.' }
}

# 5. API
Write-Host '-> Subindo a API (npm run dev)...'
npm run dev
exit $LASTEXITCODE
