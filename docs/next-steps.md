# Próximos passos

Lista de melhorias identificadas depois do MVP, em ordem sugerida de prioridade. Nada aqui está implementado, salvo quando indicado.

## 1. Antes de usar no dia a dia

- [ ] **Instalar e testar o `.exe` gerado** (`release/GestaoMotorista-Setup-1.0.0.exe`) numa máquina limpa, incluindo atualização sobre uma versão anterior para confirmar que o banco é preservado.
- [x] **Ícone próprio** do aplicativo e do instalador: fonte em `build/icon.svg`; `npm run icons` regenera `build/icon.png` e `build/icon.ico`. Falta conferir no `.exe` instalado.
- [x] **Assinatura de código (autoassinada, uso próprio):** `scripts/criar-certificado.ps1` gera o certificado em `certs/` (ignorado pelo git) e `npm run dist:assinado` assina o instalador. O SmartScreen continua avisando em máquinas que não confiam no certificado: importe `certs/gestao-motorista.cer` em "Autoridades de Certificação Raiz Confiáveis" e "Editores Confiáveis" (`certmgr.msc`). Antes de distribuir a outras pessoas, trocar por um certificado pago (OV/EV ou Azure Trusted Signing) definindo `CSC_LINK` e `CSC_KEY_PASSWORD` e rodando `npm run dist`.

## 2. Qualidade e confiança

- [ ] **Testes de interface** (Vitest + Testing Library, ou Playwright com Electron) para os fluxos: iniciar jornada → lançar corrida → ver o dashboard.
- [ ] **Teste automatizado de segurança do IPC:** remetente não autorizado, canal fora da allowlist e payload inválido.
- [ ] **Teste de atualização do esquema** com uma cópia de banco real de uma versão anterior (quando existir a migração 002).
- [ ] **Lint** (ESLint com regras de React Hooks) e formatação (Prettier) no projeto, com script `npm run lint`.
- [ ] **Integração contínua** rodando typecheck, testes e build.
- [ ] **Divisão do bundle do renderer** (`import()` por página) para reduzir o aviso de 845 kB do Vite.

## 3. Melhorias de uso

- [x] **Edição da jornada:** botão de lápis em Jornadas edita início, término, quilometragens e observações (o veículo não muda). Não deixa sobrepor outra jornada nem excluir do período corridas já lançadas.
- [ ] **Restaurar backup** pela interface, com confirmação, além de abrir a pasta de backups.
- [ ] **Backup automático periódico** (por exemplo, ao fechar o app, mantendo os últimos N).
- [ ] **Filtros de período rápidos** nas listagens (hoje, semana, mês, últimos 30 dias) e filtro por veículo em Viagens.
- [ ] **Atalhos de teclado** adicionais: salvar com `Ctrl+Enter` e foco na busca.
- [ ] **Importação de CSV** para trazer o histórico de viagens de planilhas.
- [ ] **Relatórios em PDF** e gráficos adicionais (receita por hora do dia, por dia da semana).
- [ ] **Histórico de metas:** guardar o resultado de cada dia, semana e mês fechados (hoje a meta só calcula o período corrente).
- [ ] **Despesas recorrentes** (seguro, IPVA, financiamento) lançadas automaticamente por mês.
- [ ] **Estado de pagamento nas despesas** (paga ou a pagar), para tornar o resultado de caixa exato em vez de aproximado.

## 4. Modelo financeiro

- [ ] **Rateio de custos fixos** por período (depreciação, seguro, IPVA, financiamento) para um lucro econômico completo, mantendo a visão de caixa.
- [ ] **Atribuição do km vazio por jornada** com regras explícitas que evitem dupla contagem, para unificar o "deslocamento das corridas" e a quilometragem da jornada.
- [ ] **Consumo médio por veículo na tela**, com histórico de km/L e custo de combustível por km por período.
- [ ] **Alerta de abastecimentos inconsistentes** (odômetro menor que o anterior, preço fora do comum).

## 5. Fora do escopo do MVP (a avaliar depois)

- Manutenção avançada com lembretes por km ou data.
- Apoio a obrigações tributárias (MEI, carnê-leão).
- Sincronização opcional entre dispositivos e aplicativo para celular.
- Importação de relatórios exportados da Uber e da 99.

## 6. Operação

- [ ] **Atualização automática** (electron-updater) com canal de publicação definido.
- [ ] **Registro de logs** em arquivo na pasta de dados, para diagnóstico de problemas.
- [ ] **Versionamento no Git** e política de versões (SemVer) com changelog.
