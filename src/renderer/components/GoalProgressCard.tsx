import { formatCurrency } from '@shared/money'
import type { GoalProgress } from '@shared/types'
import { Badge, Card, ProgressBar } from '@/components/ui/display'

const PERIOD_LABEL = { diaria: 'diária', semanal: 'semanal', mensal: 'mensal' } as const

export function GoalProgressCard({ progress }: { progress: GoalProgress }) {
  const { goal } = progress
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-medium">{goal.description}</div>
          <div className="text-xs text-muted">
            Meta {PERIOD_LABEL[goal.period]} de {goal.type === 'lucro' ? 'lucro' : 'faturamento'}
          </div>
        </div>
        {progress.reached ? <Badge tone="success">Atingida</Badge> : <Badge tone="info">{Math.round(progress.ratio * 100)}%</Badge>}
      </div>
      <ProgressBar ratio={progress.ratio} label={`Progresso da meta ${goal.description}`} />
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <span>
          {formatCurrency(progress.achieved)} de {formatCurrency(goal.targetAmount)}
        </span>
        <span className="text-muted">{progress.reached ? 'Meta cumprida' : `Faltam ${formatCurrency(progress.remaining)}`}</span>
      </div>
      {progress.partial ? <p className="text-xs text-warning">Lucro parcial: o combustível consumido não pôde ser estimado.</p> : null}
    </Card>
  )
}
