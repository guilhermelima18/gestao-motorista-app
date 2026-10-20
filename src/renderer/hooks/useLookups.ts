import { useApiQuery } from './useApiQuery'
import { api } from '@/lib/api'

// Listas auxiliares usadas em seletores de formulários e filtros.

export function useVehicles() {
  return useApiQuery(() => api().vehicles.list(), [])
}

export function usePlatforms() {
  return useApiQuery(() => api().platforms.list(), [])
}

export function useShifts() {
  return useApiQuery(() => api().shifts.list(), [])
}

export function useSettings() {
  return useApiQuery(() => api().settings.get(), [])
}
