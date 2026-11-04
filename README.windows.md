# Linker — backend no Windows

Guia para rodar a API no Windows 10/11. Este arquivo cobre só o que muda no
Windows. Endpoints, estrutura de pastas e convenções estão no
[README principal](README.md).

- [Pré-requisitos](#pré-requisitos)
- [Rodando](#rodando)
- [Passo a passo manual](#passo-a-passo-manual)
- [Banco de dados](#banco-de-dados)
- [Testando a API](#testando-a-api)
- [Problemas comuns](#problemas-comuns)
- [Alternativa: Dev Container](#alternativa-dev-container)

## Pré-requisitos

1. **Docker Desktop**: <https://docs.docker.com/desktop/setup/install/windows-install/>.
   Na instalação, deixe marcado **Use WSL 2**. Se o Windows pedir para instalar
   ou atualizar o WSL, rode no PowerShell como administrador:
   ```powershell
   wsl --install
   ```
   Depois reinicie o computador.
2. **Node.js 20 ou mais novo** (LTS): <https://nodejs.org>.
3. **Git**: <https://git-scm.com/download/win>.

Confira no PowerShell:

```powershell
docker --version
node --version   # v20 ou maior
npm --version
```

## Rodando

No PowerShell ou no Prompt de Comando, na pasta do repositório:

```powershell
.\start.cmd
```

Também dá para dar **duplo clique** no `start.cmd` pelo Explorer.

O `start.cmd` chama o `start.ps1` e faz o mesmo que o `start.sh` faz no
macOS/Linux, na mesma ordem:

1. cria `.env` a partir de `.env.example`, se ainda não existir;
2. abre o Docker Desktop, se ele estiver fechado, e espera ficar pronto;
3. sobe o Postgres (`docker compose up -d db`) e espera ele ficar saudável;
4. roda `npm install` se ainda não houver `node_modules`;
5. inicia a API em modo dev (`npm run dev`), que reinicia sozinha a cada
   arquivo salvo.

A API fica em `http://localhost:3000`. **Ctrl+C** encerra a API, mas o Postgres
continua rodando (`docker compose down` para parar).

> **Por que `start.cmd` e não `start.ps1` direto?** Por padrão o Windows bloqueia
> scripts `.ps1` ("a execução de scripts foi desabilitada neste sistema"). O
> `.cmd` roda o `.ps1` com `-ExecutionPolicy Bypass` só para essa execução, sem
> mudar nenhuma configuração da máquina. Se você já liberou scripts
> (`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`), `.\start.ps1` também
> funciona.

## Passo a passo manual

Equivale ao `start.cmd`, em PowerShell:

```powershell
Copy-Item .env.example .env
npm install
docker compose up -d db
npm run dev
```

No Prompt de Comando (cmd), troque a primeira linha por `copy .env.example .env`.

Os scripts do `package.json` (`npm run dev`, `npm run typecheck`, `npm run build`,
`npm start`) funcionam igual no Windows.

## Banco de dados

O schema (`db/init/01-schema.sql`) só roda na **primeira** subida do banco.
Depois de puxar uma mudança no schema, recrie o banco. Isso **apaga os dados**
locais:

```powershell
docker compose down -v
docker compose up -d db
```

Terminal SQL:

```powershell
docker compose exec db psql -U linker
```

## Testando a API

No PowerShell, `curl` é um apelido do `Invoke-WebRequest` e não aceita as flags
do curl de verdade. Use `curl.exe` (vem com o Windows 10/11) ou o
`Invoke-RestMethod`:

```powershell
$candidato = @{
  nomeCompleto   = 'Ana Souza'
  cpf            = '529.982.247-25'
  dataNascimento = '15/03/2000'
  email          = 'ana@email.com'
  celular        = '(11) 98765-4321'
  escolaridade   = 'Superior completo'
  cargoDesejado  = 'Dev Front'
  formacao       = 'CC - IMT'
  cep            = '09580-900'
  tiposContrato  = @('CLT')
  experiencias   = 'Primeiro emprego'
  anosExperiencia = 0
  faixaSalarial  = 'A combinar'
  hardSkills     = @('React')
  softSkills     = @('Comunicação')
  modalidades    = @('Remoto')
  senha          = '123456'
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/auth/cadastro/candidato `
  -ContentType 'application/json; charset=utf-8' `
  -Body ([Text.Encoding]::UTF8.GetBytes($candidato))

Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/auth/login `
  -ContentType 'application/json' `
  -Body '{"email":"ana@email.com","senha":"123456"}'
```

O `UTF8.GetBytes` garante que os acentos (`Comunicação`, `Híbrido`) cheguem
certos. Sem ele, o Windows PowerShell 5.1 pode mandar o texto em outra
codificação e o back recusa a opção.

Postman e Insomnia funcionam normalmente.

## Problemas comuns

| Sintoma | Causa e solução |
|---|---|
| `não consegui conectar ao Docker` | O Docker Desktop ainda está iniciando, ou o WSL 2 não está instalado. Espere a baleia na bandeja ficar parada e rode de novo. Se persistir, rode `wsl --install` como administrador e reinicie. |
| `falha ao subir o Postgres` / `port is already allocated` | Já existe um PostgreSQL instalado no Windows usando a porta 5432. Pare o serviço em `services.msc` (`postgresql-x64-...`) ou troque o mapeamento no `docker-compose.yml` e a porta no `DATABASE_URL` do `.env`. |
| `password authentication failed` | A API está falando com o PostgreSQL instalado no Windows, não com o do Docker. Mesma solução da linha acima. |
| Erro ao instalar `bcrypt` no `npm install` | Use o Node LTS (20 ou 22): o `bcrypt` tem binário pronto para ele. Versões ímpares ou muito novas podem exigir compilar, o que pede as Build Tools do Visual Studio. |
| `start.sh: not found` ou `$'\r': command not found` no Dev Container | O arquivo foi baixado com quebra de linha do Windows (CRLF). O `.gitattributes` evita isso em clones novos. Num clone antigo, clone o repositório de novo. |
| Acentos estranhos no terminal (`nÃ£o`) | Codificação do console. Não afeta a API. Para corrigir, rode `chcp 65001` antes do script. |

## Alternativa: Dev Container

Se preferir um ambiente Linux idêntico ao dos colegas de macOS/Linux, use o Dev
Container (seção [Development Container](README.md#development-container) do
README principal). Dentro dele, rode `./start.sh`, e não o `start.cmd`.
