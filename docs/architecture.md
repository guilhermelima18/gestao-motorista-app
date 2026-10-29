# Arquitetura do sistema

Aplicativo desktop Windows, offline e de uso pessoal, para motoristas de aplicativo registrarem jornadas, corridas, abastecimentos e despesas e acompanharem o resultado financeiro. Os dados ficam num banco SQLite local.

## 1. Visão geral

```
┌──────────────────────── Electron ────────────────────────┐
│  Renderer (React, sandbox)        Main (Node)             │
│  ┌────────────────────┐           ┌─────────────────────┐ │
│  │ pages / features   │           │ ipc/register.ts     │ │
│  │ components / hooks │  window   │  allowlist + sender │ │
│  │ react-hook-form    │   .api    │ ipc/handlers.ts     │ │
│  └─────────┬──────────┘     │     │ services/ (regras)  │ │
│            │           ┌────┴───┐ │ database/ (SQLite)  │ │
│            └──────────►│preload │►└──────────┬──────────┘ │
│                        └────────┘            │            │
└──────────────────────────────────────────────┼────────────┘
                                               ▼
                         %APPDATA%\gestao-motorista\gestao-motorista.db
```

Fluxo de uma operação: componente React → `window.api.<grupo>.<método>(dados)` → `ipcRenderer.invoke("<grupo>:<método>")` → verificação do remetente → validação Zod → serviço (regras de negócio) → SQL parametrizado → resposta `{ ok, data } | { ok: false, error }`.

## 2. Stack

| Camada | Tecnologia |
|---|---|
| Desktop | Electron 44 (empacotado com electron-builder, instalador NSIS) |
| Interface | React 19, TypeScript estrito, Vite 8, Tailwind CSS 4, Radix (diálogos), lucide-react |
| Formulários e validação | React Hook Form, Zod (schemas compartilhados) |
| Gráficos e datas | Recharts, date-fns |
| Banco | SQLite via `better-sqlite3` 13 (binários N-API pré-compilados, sem toolchain C++) |
| Testes | Vitest |

## 3. Estrutura de pastas

```
src/shared/      contratos usados por main e renderer
  domain.ts        enums (categorias, tipos de meta, períodos, temas)
  money.ts         centavos: arredondamento, parse, formatação pt-BR
  schemas.ts       schemas Zod de todas as entradas
  types.ts         DTOs de saída e tipos do contrato IPC
  api.ts           interface MotoristaApi e allowlist API_METHODS
src/main/
  main.ts          ciclo de vida, janela, userData, diálogo de salvar
  database/        connection.ts, migrations.ts (+ migrations/), backup.ts
  services/        regras de negócio (um arquivo por domínio) e cálculos
  ipc/             handlers.ts (grupo/método → serviço), register.ts (canais)
src/preload/     preload.ts: expõe window.api via contextBridge
src/renderer/
  App.tsx          navegação lateral, tema, ErrorBoundary
  pages/           uma página por menu
  features/        formulários e detalhes por domínio
  components/      componentes reutilizáveis (ui/ = base estilo shadcn)
  hooks/           consultas, formulários, atalhos, tema
  lib/             api, datas, helpers de formulário
tests/unit, tests/integration
scripts/build-electron.mjs   empacota main e preload com esbuild
```

Aliases: `@shared/*` → `src/shared/*`, `@/*` → `src/renderer/*`.

## 4. Processo principal

- **Dados do usuário:** `userData` fixo em `%APPDATA%\gestao-motorista` (independe de versão e de acentos no nome do usuário). `GM_USER_DATA` isola os dados fora do app empacotado.
- **Janela:** única instância (`requestSingleInstanceLock`). Dev carrega `VITE_DEV_SERVER_URL`; produção carrega `dist/renderer/index.html`. Menu oculto, DevTools só em dev.
- **Início:** abre o banco antes de registrar o IPC. Se falhar, mostra erro e encerra, **sem apagar nem recriar o arquivo**.
- **Exportação CSV:** o diálogo nativo de salvar e a gravação do arquivo acontecem no main, injetados em `HandlerContext.saveFile`.

## 5. Segurança

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`.
- CSP restritiva no `index.html` (`default-src 'self'`; `connect-src` inclui o servidor de dev).
- `will-navigate` bloqueia URLs fora do renderer; `setWindowOpenHandler` nega novas janelas (links http/https abrem no navegador); permissões do Chromium negadas.
- **Preload:** gera `window.api` apenas a partir de `API_METHODS`; nunca expõe `ipcRenderer`, `require`, sistema de arquivos ou canal genérico.
- **IPC:** um canal por método (`grupo:método`). Cada chamada confere que `event.sender` é o `webContents` da janela principal, que o frame é o `mainFrame` e que a URL é a do renderer.
- **Validação:** toda entrada passa por Zod nos serviços; SQL somente com parâmetros; o renderer nunca executa SQL.
- **Erros:** `DomainError` e erros Zod viram mensagens seguras em português; qualquer outro erro é registrado no console do main e devolvido como `ERRO_INTERNO` genérico, sem stack.
- **Autenticação local:** o usuário logado vive só no processo principal (`currentUserId` em `createHandlers`); o renderer nunca informa `userId`. Sem login, todos os canais fora do grupo `auth` respondem `NAO_AUTENTICADO`.
- **Senhas:** `crypto.scrypt` com sal aleatório por registro e comparação com `timingSafeEqual`; mínimo de 8 caracteres. Cinco falhas seguidas bloqueiam o CPF por 5 minutos; a mensagem de erro é a mesma para CPF inexistente e senha errada.
- **Recuperação:** código de 16 caracteres mostrado uma única vez no cadastro (só o hash fica no banco). Não há recuperação por e-mail: quem perder senha **e** código perde o acesso à conta (o arquivo do banco e os backups continuam existindo).
- **"Manter conectado":** o token (32 bytes aleatórios, validade de 30 dias, só o hash no banco) é gravado em `userData/session.bin` cifrado com `safeStorage` (DPAPI). Sem a caixa marcada, nada vai para o disco. Sair apaga o arquivo e as sessões do usuário.
- Sem serviços externos nem telemetria.

## 6. Contrato da API (`window.api`)

Grupos e métodos (fonte única: `src/shared/api.ts`):

| Grupo | Métodos |
|---|---|
| `auth` (únicos canais sem login) | `register`, `login`, `recover`, `logout`, `session`, `updateProfile`, `changePassword` |
| `vehicles`, `platforms`, `expenses`, `refuelings` | `list`, `create`, `update`, `remove` |
| `shifts` | `list`, `get`, `start`, `end`, `update`, `remove` |
| `trips` | `list` (retorna itens e totais), `create`, `update`, `remove` |
| `goals` | `list`, `progress`, `create`, `update`, `remove` |
| `dashboard` | `get` |
| `reports` | `generate`, `exportCsv` |
| `settings` | `get`, `save`, `appInfo`, `backup` |

Toda resposta é `Result<T> = { ok: true, data } | { ok: false, error: { code, message, field? } }`. No renderer, `unwrap()` converte isso em exceção `ApiCallError`, e `useFormSubmit` leva erros com `field` para o campo do formulário.

Para adicionar um método: declarar em `MotoristaApi` e em `API_METHODS`, implementar no serviço, ligar em `createHandlers` (o TypeScript acusa grupos ou métodos faltando).

## 7. Banco de dados

Tabelas e colunas em português (`snake_case`, tabelas no plural). Os `SELECT ... AS` convertem para os DTOs em inglês (`camelCase`).

| Tabela | Conteúdo | Pontos de integridade |
|---|---|---|
| `usuarios` | contas (CPF só com dígitos, e-mail, celular) | `cpf` e `email` únicos; hashes de senha e de código de recuperação; contagem de falhas e bloqueio |
| `sessoes` | tokens de "Manter conectado" | só o hash do token; validade de 30 dias |
| `veiculos` | veículos | `quilometragem_atual >= 0` |
| `plataformas` | Uber, 99 e outras (semente na migração 001) | `nome` único por usuário, sem diferenciar maiúsculas |
| `jornadas` | períodos de trabalho | índice único parcial: só uma por usuário com `fim_em IS NULL`; `CHECK` de km final ≥ inicial e fim > início |
| `viagens` | corridas | valores ≥ 0; FK para jornada e plataforma |
| `abastecimentos` | abastecimentos | litros e preço > 0; jornada opcional |
| `despesas` | despesas | categoria e tipo com `CHECK`; veículo e jornada opcionais |
| `metas` | metas com data de referência (migração 003) | tipo e periodicidade com `CHECK`; objetivo > 0 |
| `configuracoes` | chave/valor por usuário (`tema`, `veiculo_padrao_id`) | chave primária `(usuario_id, chave)` |
| `migracoes` | controle de versões | versão, nome, checksum e data |

- Valores monetários são `INTEGER` em centavos; datas são `TEXT` em ISO 8601 UTC (ordenam corretamente como texto).
- `PRAGMA foreign_keys = ON`, `journal_mode = WAL`, `busy_timeout = 5000`, `quick_check` na abertura.
- Todas as FKs usam `ON DELETE RESTRICT`. Os serviços checam os vínculos antes e devolvem mensagens claras; veículos e plataformas com registros só podem ser desativados.
- Índices em datas, chaves estrangeiras e categoria.
- **Dados por usuário:** `veiculos`, `plataformas`, `jornadas`, `viagens`, `abastecimentos`, `despesas`, `metas` e `configuracoes` têm `usuario_id` (FK `ON DELETE RESTRICT`). A coluna é anulável porque o SQLite não permite `ADD COLUMN NOT NULL` sem padrão: as linhas anteriores à migração 002 ficam com `NULL` até o **primeiro usuário cadastrado adotá-las** (mesma transação do cadastro). Os serviços sempre gravam o valor e filtram por ele.

### Migrações

`database/migrations.ts` aplica as versões pendentes, cada uma em transação, e registra checksum SHA-256. Alterar uma migração já aplicada gera erro. Quando há dados e migrações pendentes, um backup (`VACUUM INTO`) é criado antes. Mudanças de esquema entram como novas migrações em `migrations/NNN_nome.ts`. Uma migração que precisa recriar tabelas pai (como a 002, que troca restrições `UNIQUE` globais por unicidade por usuário) declara `disableForeignKeys`: `migrate()` desliga `foreign_keys` fora da transação, aplica o SQL e confere `PRAGMA foreign_key_check` antes de confirmar, restaurando o pragma depois.

### Backups

`database/backup.ts` gera `gestao-motorista-<prefixo>-<data>.db` em `backups/` (manual, pré-migração) e mantém os 10 mais recentes.

## 8. Camada de serviços

Funções que recebem a conexão (`Db`) como parâmetro, o que permite testar com `:memory:` ou arquivo temporário. Todas as que tocam dados do usuário recebem `userId` logo depois de `db` (`listShifts(db, userId)`) e filtram por `usuario_id` em toda consulta, inclusive subconsultas e JOINs. Buscar um registro de outro usuário por id devolve `NAO_ENCONTRADO` (nunca "sem permissão"), e vínculos entre registros (jornada ↔ veículo ↔ plataforma) só aceitam registros do mesmo usuário.

| Arquivo | Responsabilidade |
|---|---|
| `vehicles.ts`, `platforms.ts` | CRUD, exclusão segura, odômetro conhecido (`lastKnownOdometer`, `raiseVehicleOdometer`) |
| `shifts.ts` | iniciar, encerrar e editar em transação; uma jornada aberta por vez; validação de km; edição sem sobrepor outra jornada nem excluir corridas do período |
| `trips.ts` | CRUD, filtros, totais, regras de data e distância |
| `refuelings.ts` | CRUD; total = `round(litros × preço)`; atualiza o odômetro do veículo |
| `expenses.ts` | CRUD e filtros por período, categoria e veículo |
| `goals.ts` | CRUD e progresso por período da meta (`listGoalProgress` devolve todas, com `phase` current/past/future; `listCurrentGoalProgress` alimenta o painel) |
| `summary.ts` | consolida indicadores de um período e a série diária |
| `dashboard.ts`, `reports.ts`, `csv.ts` | painel, relatório por intervalo e exportação |
| `financial.ts` | **funções puras** de cálculo (centavos) |
| `validation.ts` | **regras puras** de jornada, viagem, abastecimento e despesa |
| `periods.ts` | limites de dia, semana (segunda a segunda) e mês |
| `settings.ts` | leitura e gravação de preferências |
| `auth.ts` | cadastro, login com bloqueio, recuperação e troca de senha, perfil, sessões; hash scrypt |
| `errors.ts`, `common.ts` | `DomainError`, helpers de SQL |

Fórmulas e premissas financeiras: ver [indicadores.md](indicadores.md).

## 9. Renderer

- **Autenticação:** `AuthProvider`/`useAuth` espelham o usuário atual; `AuthGate` mostra `AuthScreens` (login, cadastro com exibição do código de recuperação, recuperação) sem usuário e o `Shell` com `key={user.id}` com usuário, descartando qualquer estado do usuário anterior. A barra lateral mostra o nome e o botão **Sair**; **Minha conta** (dados e troca de senha) fica em Configurações. Máscaras de CPF e celular em `shared/cpf.ts`.
- **Navegação:** barra lateral (recolhe em ícones em janelas estreitas) com roteamento por hash (`#/trips`). Atalhos `Alt+1…0` navegam e `Ctrl+N` abre o formulário de novo registro.
- **Dados:** `useApiQuery(fetcher, deps)` carrega ao montar e quando `deps` mudam, descarta respostas obsoletas e expõe `reload`. Não há cache global: cada página recarrega ao ser aberta.
- **Formulários:** campos de texto (formato brasileiro) são convertidos por `schemaResolver` em `lib/form.ts` e validados com o mesmo schema Zod usado no main. Erros mostram mensagem junto do campo; `Field` liga rótulo, erro e aviso por `aria-describedby`.
- **Feedback:** `FeedbackProvider` oferece toasts (`useToast`) e confirmação de exclusão (`useConfirm`); `useRemove` junta confirmação, chamada e recarga.
- **Componentes base** (`components/ui`): `Button`, campos de formulário, `Modal`, `DataTable` (ordenação e paginação no cliente), `Card`, `Badge`, `ProgressBar`, `StatCard`, estados vazio, de carregamento e de erro.
- **Gráficos:** `RevenueExpenseChart` (barras de faturamento × despesas com legenda, tooltip e alternativa em tabela).
- **Tema:** classe `dark` na raiz (claro, escuro ou do sistema); cores em variáveis CSS em `styles.css`.
- **Datas:** a tela trabalha em horário local; `localInputToIso` converte para UTC ao enviar. `futureDateWarning` mostra aviso não bloqueante para datas futuras.
- **Robustez:** `ErrorBoundary` por página.

## 10. Regras de negócio principais

- Uma única jornada aberta; km inicial não pode ser menor que o último odômetro conhecido do veículo; km final ≥ inicial; término > início.
- Viagem: receita > 0; distância zero exige justificativa nas observações; a data precisa estar dentro do período da jornada; plataforma ativa.
- Abastecimento: litros e preço positivos; jornada, se informada, deve ser do mesmo veículo; abastecimentos não geram despesas.
- Despesa: valor positivo; categorias fixas; Financiamento tratado como fluxo de caixa.
- Metas: cada meta tem uma data de referência (`data_referencia`, yyyy-MM-dd local) e vale para o dia, a semana (segunda a segunda) ou o mês que a contém, conforme a periodicidade. O progresso é sempre calculado ao vivo com as corridas daquele período, então o histórico (períodos encerrados) reflete edições posteriores nas corridas. O painel mostra só as metas ativas do período atual; o histórico fica na tela de Metas.

## 11. Build, execução e empacotamento

- `npm run dev`: `scripts/build-electron.mjs` compila main e preload (CJS, esbuild) e o Vite serve o renderer na porta 5173.
- `npm run build`: typecheck + main/preload minificados em `dist/` + build do renderer em `dist/renderer`.
- `npm run dist`: electron-builder gera o NSIS em `release/`. `better-sqlite3` é a única dependência de runtime e fica fora do bundle (`asarUnpack`); as demais ficam em `devDependencies`. `npmRebuild: false` porque os binários já vêm prontos.
- O desinstalador não apaga os dados (`deleteAppDataOnUninstall: false`).

## 12. Testes

`npm test` (Vitest) reúne 113 testes:

- **Unitários:** cálculos financeiros, dinheiro em centavos, validações, CSV.
- **Integração (SQLite real):** migrações e idempotência, backup antes de migrar, persistência após fechar e reabrir, chaves estrangeiras, jornada aberta única, ciclo de jornadas, viagens, abastecimentos e despesas, exclusões bloqueadas, indicadores do painel, metas por data (períodos, fases, painel só com o período atual, migração das metas antigas) e relatórios.
- **Autenticação e isolamento:** cadastro e adoção dos dados antigos pelo primeiro usuário, CPF/e-mail duplicados, bloqueio após 5 falhas, recuperação de senha, sessões (válida, expirada, após sair), isolamento entre dois usuários (listas, `get/update/remove` por id alheio, vínculos cruzados, jornada aberta e plataforma por usuário, painel, metas, relatório e CSV), `NAO_AUTENTICADO` em todos os canais sem login e migração 002 sobre um banco da versão 1 com dados.

A interface React não tem testes automatizados; foi verificada manualmente via CDP no Electron.

## 13. Decisões e trade-offs

- **Sem `any`, TypeScript estrito**, com `noUncheckedIndexedAccess`.
- **Dependências do renderer como `devDependencies`:** o Vite as embute no bundle, então o instalador leva só o que roda de fato.
- **Datas em UTC + janelas locais:** os limites de dia, semana e mês são calculados em horário local no main e convertidos para UTC para consultar o banco.
- **Combustível estimado, não o total comprado:** o lucro operacional só desconta o combustível estimado pelo consumo; sem dados suficientes o resultado é marcado como parcial.
- **Sem estado de pagamento nas despesas:** o resultado de caixa é uma aproximação baseada nos lançamentos.
- **Sem cache no renderer:** simplicidade acima de desempenho, adequado ao volume de um único motorista.
