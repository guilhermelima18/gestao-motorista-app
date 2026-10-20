import type { ExportInput } from '@shared/schemas'
import { Download } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/feedback'
import { api, errorMessage, unwrap } from '@/lib/api'

export function ExportButton({ input, label = 'Exportar CSV' }: { input: ExportInput; label?: string }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    try {
      const result = await unwrap(api().reports.exportCsv(input))
      if (!result.cancelled) toast.success(`Arquivo salvo em ${result.path}`)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="outline" disabled={busy} onClick={() => void run()}>
      <Download size={16} /> {label}
    </Button>
  )
}
