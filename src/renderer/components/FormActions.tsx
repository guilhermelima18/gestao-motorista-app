import { Button } from '@/components/ui/button'

export function FormActions({ submitting, onCancel, label = 'Salvar' }: { submitting: boolean; onCancel: () => void; label?: string }) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      <Button variant="outline" onClick={onCancel}>
        Cancelar
      </Button>
      <Button type="submit" disabled={submitting}>
        {submitting ? 'Salvando…' : label}
      </Button>
    </div>
  )
}
