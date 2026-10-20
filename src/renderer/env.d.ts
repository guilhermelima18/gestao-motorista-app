/// <reference types="vite/client" />
import type { MotoristaApi } from '@shared/api'

declare global {
  interface Window {
    /** API segura exposta pelo preload. */
    api: MotoristaApi
  }
}

export {}
