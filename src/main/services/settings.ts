import { settingSchema, type SettingInput } from '@shared/schemas'
import type { Settings } from '@shared/types'
import { nowIso, type Db } from './common'
import { getVehicle } from './vehicles'

export function getSettings(db: Db, userId: number): Settings {
  const rows = db.prepare('SELECT chave AS key, valor AS value FROM configuracoes WHERE usuario_id = ?').all(userId) as {
    key: string
    value: string | null
  }[]
  const map = new Map(rows.map((r) => [r.key, r.value]))
  const theme = map.get('tema')
  const defaultVehicle = Number(map.get('veiculo_padrao_id'))
  return {
    theme: theme === 'claro' || theme === 'escuro' || theme === 'sistema' ? theme : 'sistema',
    defaultVehicleId: Number.isInteger(defaultVehicle) && defaultVehicle > 0 ? defaultVehicle : null,
  }
}

export function saveSetting(db: Db, userId: number, input: SettingInput): Settings {
  const data = settingSchema.parse(input)
  if (data.key === 'veiculo_padrao_id' && data.value !== '') getVehicle(db, userId, Number(data.value))
  db.prepare(
    `INSERT INTO configuracoes (usuario_id, chave, valor, atualizado_em) VALUES (?, ?, ?, ?)
     ON CONFLICT(usuario_id, chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em`,
  ).run(userId, data.key, data.value, nowIso())
  return getSettings(db, userId)
}
