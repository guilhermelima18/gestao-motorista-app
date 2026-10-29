import { Copy, KeyRound } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/feedback'

/**
 * Mostra o código de recuperação uma única vez. Como não há recuperação por e-mail, quem perder a senha e o código
 * perde o acesso aos dados da conta, por isso o avanço exige a confirmação de que o código foi guardado.
 */
export function RecoveryCodeNotice({ code, continueLabel, onContinue }: { code: string; continueLabel: string; onContinue: () => void }) {
  const toast = useToast()
  const [saved, setSaved] = useState(false)
  const codeRef = useRef<HTMLElement>(null)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      toast.success('Código copiado.')
      return
    } catch {
      // Cai no plano B abaixo.
    }
    // Plano B: seleciona o código na tela e usa o comando de cópia do navegador.
    const element = codeRef.current
    if (element) {
      const range = document.createRange()
      range.selectNodeContents(element)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      if (document.execCommand('copy')) {
        toast.success('Código copiado.')
        return
      }
    }
    toast.error('Não foi possível copiar. Selecione o código e use Ctrl+C, ou anote-o.')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-warning/50 bg-warning/10 p-3 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <KeyRound size={16} aria-hidden /> Guarde este código de recuperação
        </p>
        <p className="mt-1 text-muted">
          Ele é a única forma de criar uma nova senha se você esquecer a atual, e <strong>não será mostrado novamente</strong>. Anote-o em
          um lugar seguro.
        </p>
      </div>
      <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-2 px-4 py-3">
        <code ref={codeRef} className="font-mono text-lg font-semibold tracking-wider select-all" aria-label="Código de recuperação">
          {code}
        </code>
        <Button variant="outline" size="sm" onClick={() => void copy()}>
          <Copy size={14} /> Copiar
        </Button>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} /> Já guardei meu código de recuperação
      </label>
      <Button disabled={!saved} onClick={onContinue}>
        {continueLabel}
      </Button>
    </div>
  )
}
