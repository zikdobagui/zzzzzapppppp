# Integração Telegram

No `.env`, preencha:

```dotenv
TELEGRAM_ENABLED=true
TELEGRAM_BASE_URL=https://SEU-SITE-TELEGRAM
TELEGRAM_BOT_PHONE=5511999999999
WHATSAPP_API_KEY=CHAVE_PRIVADA_DE_CLIENTES
WHATSAPP_CATALOG_API_KEY=OUTRA_CHAVE_PRIVADA_DE_CATALOGO
```

Use o número do bot oficial em TELEGRAM_BOT_PHONE (país e DDD, apenas dígitos).
Se vazio, será usado BOT_PHONE da sessão principal. Os outros bots não recebem acesso.
As duas chaves devem ser diferentes, geradas com pelo menos 32 bytes aleatórios e iguais às configuradas no servidor Telegram. Não reutilize a chave da API de estoque.
A URL deve usar HTTPS e apontar ao site onde os endpoints `/api/whatsapp/v1` foram instalados. Reinicie o bot após configurar. A integração vem desativada até preencher esses dados.

Ao receber a primeira mensagem comum (por exemplo, “oi”), o bot consulta o vínculo no servidor Telegram. Se o número ainda não estiver vinculado, pede o código de Meu Perfil e aceita a próxima mensagem como código, sem exigir `/vincular`. Números já vinculados seguem para o menu. Após expirar a espera, uma nova mensagem comum reinicia a orientação. O bot não gera códigos: eles são emitidos pelo Telegram/site. Ao receber o código, valida o vínculo pela API e busca automaticamente o cadastro, mostrando usuário, WhatsApp, saldo e total de compras.

## Uso em conversa privada

- `/telegram`: instruções (também acessíveis pelo botão Telegram no menu).
- `/vincular CODIGO`: vincula o número autenticado da conversa. Nunca aceita telefone no texto como identidade.
- `/vincular`: solicita a próxima mensagem como código por até 5 minutos. Após reiniciar, envie o comando novamente.
- `/cancelar`: cancela a espera pelo código.
- `/saldotelegram`: consulta saldo e cadastro diretamente no Telegram.
- `/historicotelegram`: consulta compras e pagamentos, sem credenciais de entrega.
- `/catalogotelegram`: consulta preços e estoque atuais, sem reservar ou comprar.

O código vem do Meu Perfil no Telegram/site e expira em 24h no servidor.
LIDs devem ser resolvidos pela plataforma para um número de telefone; sem resolução a consulta é recusada.
Se a resposta de vínculo se perder, o bot consulta o cadastro para confirmar, sem repetir o POST. Caso não confirme, pede consulta de saldo antes de tentar novamente.
Erros remotos e códigos não são encaminhados aos logs ou ao suporte pela integração.

Para contas vinculadas, saldo, compras e Pix usam o cadastro Telegram pelos endpoints transacionais documentados abaixo. Contas sem vínculo mantêm a carteira local. Não há cópia de saldo nem sincronização periódica. Saldos locais anteriores são preservados, sem soma ou transferência automática.

O servidor Telegram deve instalar os endpoints do documento fornecido e manter `database/whatsapp_links.sqlite3` nos backups. Este repositório contém apenas o cliente WhatsApp.

Validação local: `npm run test:telegram`, `npx tsc --noEmit` e `npm run build`.

A integração foi ativada no `.env`. Reinicie o processo para carregar alterações. A mensagem de vínculo oferece uma enquete com opções de loja e ajuda; também aceita `/loja` e `/ajudavinculo`. A escolha de seguir para a loja vale até reiniciar o bot. Configure `TELEGRAM_BOT_URL=https://t.me/SEU_BOT` para incluir o link do seu bot na mensagem.

## HTTP 503: integração não configurada

Esse erro retornado pelo servidor Telegram indica que a respectiva chave não foi configurada no processo publicado. Preencher somente o `.env` do WhatsApp não ativa o servidor remoto.

No servidor de `TELEGRAM_BASE_URL`, configure `WHATSAPP_API_KEY` e `WHATSAPP_CATALOG_API_KEY` com os mesmos valores privados do `.env` do WhatsApp. Se o servidor usar `settings/credenciais.json`, os nomes equivalentes são `whatsapp_api_key` e `whatsapp_catalog_api_key`. Reinicie o serviço Telegram/site para carregar a configuração. Não coloque códigos de clientes nesses campos.

Depois, a consulta autenticada de catálogo deve responder 200; a consulta de um telefone ainda sem vínculo deve responder 404 em vez de 503. Só então teste um código de cliente pela conversa privada. Não repita o POST automaticamente para diagnosticar falhas.

## Dados no menu

Contas vinculadas exibem saldo e total de compras do Telegram no menu e em Informações, consultados ao abrir essas telas. Contas vinculadas exibem somente o saldo único do Telegram. O botão Histórico Telegram abre compras e pagamentos remotos; Histórico de Logins também consulta o Telegram para contas vinculadas e mostra as compras locais, se existirem. Indisponibilidade da API não é exibida como zero compras. O saldo é consultado na origem. Compras e recargas passam pelas operações do servidor Telegram.

## Saldo único: atualização obrigatória do servidor

Na pasta do projeto Telegram foram alterados `whatsapp_api.py` e `webapp.py` e adicionado `whatsapp_transactions.py`. Publique os três juntos na Square Cloud e reinicie o serviço. Os endpoints antigos de vínculo/leitura continuam funcionando.

- POST `/api/whatsapp/v1/clientes/NUMERO/comprar`: `{ "operacao": "HASH_SHA256", "produto": "Nome do produto", "preco": 19.9 }`.
- POST `/api/whatsapp/v1/clientes/NUMERO/pix`: `{ "operacao": "HASH_SHA256", "valor": 10 }`.
- GET `/api/whatsapp/v1/clientes/NUMERO/operacoes/HASH_SHA256`: consulta/reenvio de resultado para o mesmo titular.
- GET `/api/whatsapp/v1/clientes/NUMERO/pix/ID/status`: pagamento gerado pela API para o mesmo titular.

Todos exigem a chave privada de clientes. A chave de catálogo não autoriza operações. Preços e estoque são revalidados pelo checkout do site; débito, entrega e histórico usam as funções existentes do Telegram. Pix usa o gateway e a verificação do servidor Telegram, que credita o cadastro central. O WhatsApp não incrementa o banco local para usuários vinculados.

O backend persiste o ID da operação antes do efeito externo, retorna o resultado anterior para repetições e bloqueia novas operações do mesmo tipo quando houver uma pendência. Falha incerta fica em REVIEW para análise; não estorne nem repita automaticamente. PROCESSING persistido após uma queda também exige conferência pelo administrador. `/operacaotelegram ID` recupera a resposta; `/statuspix ID` consulta a aprovação. O banco `database/whatsapp_links.sqlite3` agora guarda também resultados de entrega; mantenha-o protegido e nos backups.

Sem os endpoints atualizados, o bot informa que o servidor precisa ser atualizado e não usa a carteira local de uma conta vinculada. Gifts e ajustes administrativos de saldo de contas vinculadas são feitos pelo Telegram/painel. Operações locais anteriores ao vínculo permanecem preservadas; não há migração automática de crédito antigo.
