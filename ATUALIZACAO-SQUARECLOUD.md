# Atualizacao automatica pelo GitHub

Repositorio: https://github.com/zikdobagui/zzzzzapppppp

## 1. Coloque o projeto no repositorio

Envie o **conteudo de botlogins** para a raiz do repositorio, incluindo a pasta
oculta `.github`. O arquivo `package.json` deve ficar na raiz, junto de
`squarecloud.app`. O workflow usa a branch `main`; ajuste o YAML se usar outra.

Nao envie `.env`, `tokens`, `node_modules`, bancos SQLite ou os ZIPs antigos.
O `.gitignore` foi atualizado para excluir esses arquivos. Se ja estiverem
versionados no GitHub, o ignore nao os remove do historico: retire-os do controle
de versao e troque as credenciais expostas.

## 2. Hospede a primeira vez

Crie a aplicacao no painel Square Cloud antes de ativar as atualizacoes.
Compile com `npm run build` e envie o projeto com `dist`, `assets`, `scripts`,
`prisma/schema.prisma`, `prisma/migrations`, `package.json`, `package-lock.json`
e `squarecloud.app`, sem `node_modules` do Windows.

Configure suas variaveis no painel (ou envie seu `.env` diretamente pelo painel,
sem passar pelo GitHub). Configure `WA_PAIRING_PHONE` com pais e DDD para
conectar pelo codigo mostrado nos logs. O bot usa Chrome/WPPConnect; confirme
que o ambiente da aplicacao tem Chrome e memoria suficientes. A configuracao
inicial reserva 1024 MB; ajuste conforme o consumo e seu plano.

Se deseja manter os saldos e cadastros atuais, pare o bot local e transfira o
banco `prisma/database.sqlite` por canal privado, com backup. Nao substitua um
banco que ja contenha dados na hospedagem. Sessoes de navegador do Windows
podem precisar de nova autenticacao no Linux.

Para uma instalacao com banco vazio, o iniciador executa `prisma migrate deploy`
automaticamente antes de iniciar o bot. Para banco existente sem historico
de migrations, e necessario conferir/baselinear o historico antes de migrar.
O iniciador nao altera o esquema de bancos que ja contem tabelas.

## 3. Configure o GitHub uma vez

No repositorio, abra **Settings > Secrets and variables > Actions**:

* Em **Secrets**, crie `SQUARECLOUD_API_KEY` com a chave API da sua conta Square
  Cloud. Nao coloque a chave no codigo, no YAML ou em mensagens.
* Em **Variables**, crie `SQUARECLOUD_APP_ID` com o ID da aplicacao ja criada.

## 4. Atualize

Cada `push` na `main` instala e compila no GitHub, envia o ZIP com a action
oficial da Square Cloud e reinicia a aplicacao. Acompanhe na aba **Actions**.
Tambem pode executar manualmente em **Actions > Atualizar bot na Square Cloud
> Run workflow**. Se o build falhar, nao envia a atualizacao.

O pacote envia somente codigo, assets e arquivos de configuracao. Nao inclui
`.env`, `tokens/`, `prisma/database.sqlite` ou backups: o commit da Square Cloud
preserva os arquivos que nao recebeu. Arquivos de codigo removidos do projeto
tambem permanecem no disco remoto, mas deixam de ser referenciados pelo build.

O iniciador usa as dependencias instaladas pela Square Cloud e gera o Prisma
para Linux antes de executar `dist/index.js`. Nao executa outra instalacao npm.
Quando alterar dependencias, use a opcao de reinstalar dependencias da
hospedagem antes de reiniciar; o commit pode preservar node_modules antigo.
O package.json autoriza os scripts de instalacao de Prisma, Puppeteer e esbuild
nas versoes do npm que exigem allowScripts. Se a instalacao foi interrompida,
reinstale as dependencias pelo painel depois de enviar esta correcao. Mudancas
de esquema exigem backup e migracao planejada separadamente. O processo de
deploy pode ter sido enviado mesmo se a nova versao falhar ao iniciar: confira
tambem os logs na Square Cloud. Nao ha rollback automatico.

Documentacao oficial: https://squarecloud.app/en/resources/github-action
