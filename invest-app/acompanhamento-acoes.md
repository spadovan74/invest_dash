# Implementação do Painel de Acompanhamento (Watchlist)

## 1. Banco de Dados (Prisma)
- Adicionar no `prisma/schema.prisma`:
  ```prisma
  model Watchlist {
    id        Int      @id @default(autoincrement())
    symbol    String
    target    Float    // Alvo
    createdAt DateTime @default(now())
  
    userId Int
    user   User @relation(fields: [userId], references: [id])
  
    @@unique([userId, symbol])
  }
  ```
- Atualizar o `User` no schema para incluir `watchlist Watchlist[]`.
- Rodar `npx prisma db push` para aplicar a migration no SQLite.

## 2. Serviço de Mercado (`lib/market.ts`)
- Criar a função `getWatchlistQuotes(symbols: string[])` para buscar múltiplos ativos em uma requisição.
- Utilizar a API do Yahoo Finance `https://query2.finance.yahoo.com/v7/finance/quote?symbols=PETR4.SA,VALE3.SA` pois ela traz explicitamente as mínimas e máximas de 52 semanas, preços de abertura, e mínima/máxima do dia, bem com % de retorno atual em um pacote único, super otimizado para o Dashboard.
- O formato de retorno deve ser um objeto map `{ 'PETR4.SA': { ...dados } }`.

## 3. Endpoints de API (`app/api/watchlist/`)
- `GET /api/watchlist`: Retorna lista das ações salvas e seus alvos.
- `POST /api/watchlist`: Adiciona/Altera ação e alvo no DB `Watchlist`.
- `DELETE /api/watchlist`: Remove ação do monitoramento.

## 4. Interface (Frontend) - `/app/watchlist/page.tsx`
- **Layout Geral:** Sidebar existente + Container com navegação/títulos.
- **Formulário Simples de Inserção:** Input Ticker -> Input Alvo (R$) -> Botão Adicionar.
- **Tabela de Dados:**
  - Ação: Ticker com fundo da cor controlada pela regra (%)
  - Alvo: Valor (R$) alvo que a pessoa quer comprar.
  - Meta compra: Cálculo `( Atual / Alvo - 1 ) * 100` ou similar dependendo de como calculamos distâncias (Verde/Amarelo/Vermelho de acordo com a proximidade do Alvo).
  - Regra de cores da coluna "Açāo":
    - diferença >= 3% fica Branco.
    - entre 2,99 e 1,50 fica Vermelho.
    - entre 1,49 e 0,75 fica Amarelo.
    - menor que 0,75 fica Verde (e presumimos menor ou igual a 0 é Verde pois atingiu/passou do alvo).
  - Data Hora: Formato local da data recém pesquisada.
  - Prç. Ab: Abertura.
  - Atual: Valor no momento.
  - Menor prc. Hj: Mínima do dia.
  - menor 52 sem: Mínima de 52 semanas.
  - maior 52 sem: Máxima de 52 semanas.
  - % abaixo maior: `(Atual / Maior 52 - 1) * 100` (quanto abaixo do topo).
  - % hoje: Variação de abertura para o atual (ou do dia anterior).

## 5. Integração Rotas
- Adicionar o link "/watchlist" ("Acompanhamento") na Sidebar.
- Garantir que um usuário recupere apenas seus `Watchlist` filtrando por token JWT.
