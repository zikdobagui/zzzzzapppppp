# API da loja

O bot Principal usa o catálogo de `https://vendasdoramon.squareweb.app/api/stock`.
Os demais bots continuam com estoque local. A chave fica somente no `.env`.

```env
STOCK_API_ENABLED=true
STOCK_API_URL=https://vendasdoramon.squareweb.app
STOCK_API_KEY=COLOQUE_SUA_CHAVE
STOCK_API_MARGIN_PERCENT=30
```

O preço automático é custo × 1,30, arredondado para centavos. Por exemplo,
R$ 8,00 vira R$ 10,40. Esse percentual é um acréscimo sobre o custo.
O saldo do cliente no bot e o saldo da sua conta no fornecedor são separados.
O saldo mínimo exigido pelo fornecedor é validado pela própria API.

## Operação

- Execute `npm start` e abra **Logins** no WhatsApp para consultar o catálogo.
- `/apiprodutos` (administrador): consulta o fornecedor, cadastra as configurações
  locais dos produtos e mostra custo, preço de venda e estoque.
- `/price NOME EXATO|10,40` (administrador): define um preço fixo para o produto.
  Use o nome completo exibido em `/apiprodutos`, incluindo os emojis. Um preço
  fixo substitui a margem padrão. Produtos abaixo do custo não são vendidos.
- `/apipedido ID` (cliente, no privado): consulta e recupera o acesso de um pedido
  próprio, sem comprar novamente.
- `/apipedidos` (administrador): lista até 30 pedidos pendentes.
- `/apiestornar ID` (administrador): devolve o saldo local de um pedido recusado
  ou pendente. Confira antes a situação do pedido com o fornecedor: esse comando
  **não cancela nem estorna uma compra no fornecedor**. Pedidos já confirmados
  ou com acesso recebido não podem ser estornados por esse comando.

Cada enquete permite uma compra por cliente. Para outra compra, abra Logins
novamente. Os preços exibidos valem por 15 minutos e são conferidos antes da
reserva; alterações exigem abrir uma nova lista. Os acessos ficam no Histórico
de Logins e são entregues na conversa privada do comprador.

## Falhas e recuperação

O bot reserva o saldo local antes de enviar `POST /api/stock/reserve`, com
`service` igual ao nome do catálogo, `buyer_id` igual ao telefone do cliente e
`sale_id` igual ao ID persistente do pedido. Não repete automaticamente o POST.

Recusas HTTP 400/401/402/403/404/422 devolvem o saldo. Falha de rede, timeout,
HTTP 5xx ou resposta inesperada deixam o pedido em revisão e o saldo reservado:
a compra pode ter sido cobrada pelo fornecedor. O cliente fica impedido de fazer
outra compra na API até resolver esse pedido. Consulte `/apipedidos` e confira o
`sale_id` com o fornecedor antes de usar `/apiestornar`.

O estado RECEIVED indica que o acesso foi salvo e falta concluir o histórico.
`/apipedido ID` conclui essa etapa sem nova reserva. PROCESSING antigo pode
indicar uma interrupção no momento da compra; não há consulta de pedidos na API
fornecida. O estorno manual de PROCESSING só fica disponível após 5 minutos.

## Atualização e testes

Para instalar as alterações em outra cópia do projeto, pare o bot e execute:

```powershell
npx prisma generate
npx prisma migrate deploy
npm run test:stock
npm start
```

Os testes usam um banco temporário e um fornecedor simulado, sem compras reais.
O banco desta instalação foi migrado com backup em `prisma/backups/`.
