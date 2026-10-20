# Indicadores financeiros

Implementados em `src/main/services/financial.ts` (funções puras, em centavos) e consolidados por período em `src/main/services/summary.ts`. Período = intervalo `[início, fim)` em horário local; a semana começa na segunda-feira.

| Indicador | Fórmula |
|---|---|
| **Faturamento bruto** | Σ (`valor_corrida + gorjeta + adicionais`) das viagens com `realizada_em` no período. |
| **Horas trabalhadas** | Σ duração das jornadas **encerradas** que *começaram* no período. Jornadas abertas não contam. |
| **Quilometragem percorrida** | Σ (`quilometragem_final − quilometragem_inicial`) das mesmas jornadas encerradas. |
| **Receita por hora** | Receita das viagens dessas jornadas encerradas ÷ horas. `Sem dados` se não houver horas. |
| **Receita por km** | Receita das viagens dessas jornadas encerradas ÷ quilometragem. `Sem dados` se for zero/desconhecida. |
| **Deslocamento atribuído às corridas** | Σ (`distancia_km + quilometragem_vazia_km`) das viagens. Métrica à parte: **nunca** é somada à quilometragem da jornada (evita dupla contagem). |
| **Resultado de caixa** | Faturamento − despesas − abastecimentos lançados no período. *Aproximação*: o sistema não registra o estado de pagamento. |
| **Consumo médio** | Entre abastecimentos de **tanque completo** consecutivos do mesmo veículo: km rodados ÷ litros abastecidos depois do primeiro marco (inclui parciais intermediários). Segmentos com odômetro não crescente são ignorados; sem dados comparáveis → indisponível. |
| **Combustível consumido estimado** | Para cada veículo: km das jornadas encerradas ÷ consumo médio × preço médio por litro (ponderado) do histórico até o fim do período. |
| **Lucro operacional estimado** | Faturamento − combustível consumido estimado − despesas operacionais (`tipo = operacional`, exceto *Financiamento*). |
| **Custo por km** | (combustível estimado + despesas operacionais) ÷ quilometragem percorrida. |

## Regras importantes

- O valor total dos abastecimentos **não** é subtraído integralmente do lucro: o que é comprado não é necessariamente consumido no período. Só o combustível *estimado* entra no lucro operacional.
- Se o consumo não puder ser estimado, o lucro é exibido como **parcial** e o aviso lista o que ficou de fora (combustível consumido, despesas fixas, financiamento), com os valores lançados.
- **Financiamento** e despesas **fixas** aparecem no resultado de caixa, mas não no lucro operacional (não são rateadas por período).
- Despesas da categoria *Combustível* lançadas manualmente contam como despesa operacional; abastecimentos devem ser lançados em *Abastecimentos* para não haver duplicidade.
- Faturamento, despesas e abastecimentos usam a data do próprio lançamento; as taxas por hora e por km usam apenas jornadas encerradas, para não misturar receita de jornada aberta com horas ainda não fechadas.
- Arredondamento monetário único (`roundCents`, meio centavo para cima). Total do abastecimento = `round(litros × preço por litro em centavos)`.
- **Metas:** progresso = realizado no período corrente da meta (faturamento bruto ou lucro operacional estimado) ÷ objetivo; restante = `max(0, objetivo − realizado)`.
