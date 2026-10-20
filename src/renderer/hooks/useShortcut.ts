import { useEffect, useRef } from 'react'

/** Atalho Ctrl+<tecla> (ou Alt+<tecla> com `alt`) enquanto o componente estiver montado. */
export function useShortcut(key: string, handler: () => void, options: { alt?: boolean } = {}): void {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      const modifier = options.alt ? event.altKey : event.ctrlKey
      if (modifier && event.key.toLowerCase() === key.toLowerCase()) {
        event.preventDefault()
        handlerRef.current()
      }
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [key, options.alt])
}
