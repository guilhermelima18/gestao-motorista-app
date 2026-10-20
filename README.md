# Gestão do Motorista

Aplicativo desktop (Windows) para motoristas de aplicativo (Uber, 99 e outras plataformas) registrarem jornadas, corridas, abastecimentos e despesas e acompanharem o resultado financeiro real. Funciona 100% offline: os dados ficam em um banco SQLite local.

**Stack:** Electron, React, TypeScript (modo estrito), Vite, Tailwind CSS, SQLite (`better-sqlite3`), React Hook Form, Zod, Recharts, date-fns, Vitest, electron-builder.

## Requisitos

- Node.js 22 ou superior (testado com 24) e npm.
- Windows 10/11 x64 para gerar e executar o instalador.
- **Não é preciso Python nem Visual Studio Build Tools**: o `better-sqlite3` 13 traz binários pré-compilados N-API, que funcionam tanto no Node (testes) quanto no Electron, sem `electron-rebuild`.

## Comandos

```bash
npm install          # instala as dependências
npm run dev          # desenvolvimento: Vite (renderer) + Electron
npm test             # testes unitários e de integração (Vitest)
npm run typecheck    # verificação de tipos (tsc --noEmit)
npm run build        # compila main, preload e renderer em dist/
npm start            # executa o build local (dist/) no Electron
npm run dist         # gera o instalador Windows em release/GestaoMotorista-Setup-<versão>.exe
```

## Onde ficam os dados

- Banco: `%APPDATA%\gestao-motorista\gestao-motorista.db`
- Backups: `%APPDATA%\gestao-motorista\backups\` (manual em *Configurações* e automático antes de qualquer migração; mantém os 10 mais recentes)

O caminho é fixo e independe da versão: atualizar ou reinstalar o aplicativo **não apaga nem recria o banco**, e o desinstalador não remove os dados. Novas versões evoluem o esquema com migrações versionadas (tabela `migracoes`), sem `DROP TABLE`, e fazem backup antes de migrar. Para isolar os dados em desenvolvimento, defina `GM_USER_DATA` com uma pasta (ignorado no app empacotado).

Se o banco não puder ser aberto, o aplicativo avisa e **mantém o arquivo intacto**; para restaurar, feche o app e substitua o arquivo `.db` por um backup.

## Arquitetura

```
src/shared/   schemas Zod, tipos DTO, contrato da API (api.ts), dinheiro em centavos (money.ts)
src/main/     processo principal: janela, banco, IPC
  database/   conexão, migrações versionadas, backup
  services/   regras de negócio e cálculos (financial.ts é puro e testado)
  ipc/        handlers e registro dos canais (allowlist + validação + checagem do remetente)
src/preload/  API restrita exposta por contextBridge (window.api)
src/renderer/ interface React (pages, features, components, hooks)
tests/        unit/ e integration/
```

Fluxo: React → `window.api.<grupo>.<método>` → IPC → validação Zod → serviço → SQL parametrizado → SQLite.

### Segurança

`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`; CSP restritiva; navegação e novas janelas bloqueadas; permissões negadas; o preload expõe apenas métodos de uma allowlist (sem `ipcRenderer` genérico, sem sistema de arquivos); os handlers só respondem à janela principal (verificação de `sender` e URL do frame); o renderer nunca executa SQL; erros chegam ao renderer sem stack traces. A exportação de CSV usa o diálogo nativo de salvar, executado no processo principal.

## Convenções

- Identificadores de código (variáveis, funções, hooks, componentes, tipos) em **inglês**; comentários e textos da interface em **português**.
- Tabelas e colunas do banco em português (`snake_case`, plural nas tabelas); a conversão para os DTOs em inglês é feita nos `SELECT ... AS`.
- Todo valor monetário é inteiro em **centavos** (R$ 12,50 → `1250`); formatação `pt-BR` só na interface.

## Funcionalidades

Dashboard (dia/semana/mês, gráficos, metas), Jornadas, Viagens, Abastecimentos, Despesas, Metas, Veículos (com veículo padrão), Plataformas, Relatórios com exportação CSV (UTF-8 com BOM, separador `;`, vírgula decimal) e Configurações (tema e backup). Atalhos: `Ctrl+N` (novo registro na tela atual) e `Alt+1…0` (navegação).

## Indicadores

As fórmulas e premissas estão em [docs/indicadores.md](docs/indicadores.md).

## Testes

`npm test` cobre cálculos financeiros, validações, CSV, migrações, integridade (chaves estrangeiras, jornada aberta única), ciclo de jornadas/viagens/abastecimentos/despesas, indicadores do painel, metas e persistência após fechar e reabrir o banco.

## Limitações conhecidas

- Instalador sem assinatura de código e com o ícone padrão do Electron.
- Despesas não têm estado de pagamento: o *resultado de caixa* é uma aproximação baseada nos lançamentos.
- Fora do escopo do MVP: login, nuvem, integração com Uber/99, GPS, IA, manutenção avançada e tributação.
