/**
 * CSV import utilities for devices, clients, subscriptions
 */

export type ImportEntity = 'car_trackers' | 'clients' | 'subscriptions' | 'provider_payments'

const CAR_TRACKER_COLUMNS = [
  'name',
  'brand',
  'model',
  'sim_number',
  'user_tel',
  'vehicle_model',
  'reg_number',
  'color',
  'identifier',
  'server',
  'port',
  'imei',
  'pwd',
  'email',
  'install_date',
  'sms_notification',
  'remote_cut_off',
  'last_top_up',
  'status',
  'location',
  'notes',
] as const

const CLIENT_COLUMNS = [
  'name',
  'industry',
  'contact_name',
  'email',
  'phone',
  'address',
  'billing_address',
  'tax_number',
  'notes',
] as const

const SUBSCRIPTION_COLUMNS = [
  'client_name',
  'plan_name',
  'billing_cycle',
  'amount',
  'currency',
  'start_date',
  'end_date',
  'next_invoice_date',
  'status',
  'device_identifier',
  'notes',
] as const

function parseCSV(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim())
  return lines.map((line) => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') {
        inQuotes = !inQuotes
      } else if (c === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += c
      }
    }
    result.push(current.trim())
    return result
  })
}

function headersToRow(headers: string[], row: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  headers.forEach((h, i) => {
    out[h.toLowerCase().replace(/\s+/g, '_')] = row[i]?.trim() ?? ''
  })
  return out
}

const ROW_KEY_DELIM = '\x01'

/**
 * Remove duplicate data rows (same content or same business key). First occurrence wins.
 * Returns unique rows with their original 1-based row index, and count of skipped rows.
 */
function deduplicateDataRows(
  rows: string[][],
  headers: string[],
  getBusinessKey: (rowObj: Record<string, string>) => string | null,
): { uniqueRows: [row: string[], originalRowIndex: number][]; skipped: number } {
  const contentSeen = new Set<string>()
  const businessKeySeen = new Set<string>()
  const uniqueRows: [string[], number][] = []
  let skipped = 0
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const contentKey = row.join(ROW_KEY_DELIM)
    const rowObj = headersToRow(headers, row)
    const businessKey = getBusinessKey(rowObj)
    if (contentSeen.has(contentKey)) {
      skipped++
      continue
    }
    if (businessKey !== null && businessKey !== '' && businessKeySeen.has(businessKey)) {
      skipped++
      continue
    }
    contentSeen.add(contentKey)
    if (businessKey !== null && businessKey !== '') {
      businessKeySeen.add(businessKey)
    }
    uniqueRows.push([row, i + 1])
  }
  return { uniqueRows, skipped }
}

export interface ImportResult {
  total: number
  success: number
  failed: number
  skipped: number
  errors: { row: number; message: string }[]
}

export async function parseAndImportCarTrackers(
  csvText: string,
  onInsert: (device: Record<string, unknown>, line: Record<string, unknown>) => Promise<void>,
): Promise<ImportResult> {
  const rows = parseCSV(csvText)
  if (rows.length < 2) {
    return { total: 0, success: 0, failed: 0, skipped: 0, errors: [] }
  }
  const headers = rows[0].map((h) => h.toLowerCase().replace(/\s+/g, '_'))
  const { uniqueRows, skipped } = deduplicateDataRows(rows, headers, (rowObj) => {
    const key = (rowObj.identifier ?? rowObj.imei ?? rowObj.name ?? '').trim().toLowerCase()
    return key === '' ? null : key
  })
  const result: ImportResult = { total: uniqueRows.length, success: 0, failed: 0, skipped, errors: [] }

  for (const [row, originalRowIndex] of uniqueRows) {
    const rowObj = headersToRow(headers, row)
    try {
      const device: Record<string, unknown> = {
        device_type: 'car_tracker',
        name: rowObj.name ?? rowObj.identifier ?? `Tracker ${originalRowIndex}`,
        status: (rowObj.status ?? 'in_stock').toLowerCase().replace(/\s+/g, '_') || 'in_stock',
        identifier: rowObj.identifier ?? null,
        location: rowObj.location ?? null,
        notes: rowObj.notes ?? null,
      }
      const line: Record<string, unknown> = {
        brand: rowObj.brand || null,
        model: rowObj.model || null,
        sim_number: rowObj.sim_number || null,
        user_tel: rowObj.user_tel || null,
        vehicle_model: rowObj.vehicle_model || null,
        reg_number: rowObj.reg_number || null,
        color: rowObj.color || null,
        server: rowObj.server || null,
        port: rowObj.port || null,
        imei: rowObj.imei || null,
        pwd: rowObj.pwd || null,
        email: rowObj.email || null,
        install_date: rowObj.install_date || null,
        sms_notification: ['1', 'true', 'yes', 'y'].includes((rowObj.sms_notification ?? '').toLowerCase()),
        remote_cut_off: ['1', 'true', 'yes', 'y'].includes((rowObj.remote_cut_off ?? '').toLowerCase()),
        last_top_up: rowObj.last_top_up || null,
      }
      await onInsert(device, line)
      result.success++
    } catch (e) {
      result.failed++
      result.errors.push({ row: originalRowIndex, message: String(e) })
    }
  }
  return result
}

export async function parseAndImportClients(
  csvText: string,
  onInsert: (client: Record<string, unknown>) => Promise<void>,
): Promise<ImportResult> {
  const rows = parseCSV(csvText)
  if (rows.length < 2) {
    return { total: 0, success: 0, failed: 0, skipped: 0, errors: [] }
  }
  const headers = rows[0].map((h) => h.toLowerCase().replace(/\s+/g, '_'))
  const { uniqueRows, skipped } = deduplicateDataRows(rows, headers, (rowObj) => {
    const key = (rowObj.email ?? rowObj.name ?? '').trim().toLowerCase()
    return key === '' ? null : key
  })
  const result: ImportResult = { total: uniqueRows.length, success: 0, failed: 0, skipped, errors: [] }

  for (const [row, originalRowIndex] of uniqueRows) {
    const rowObj = headersToRow(headers, row)
    try {
      const nameFromEmail = rowObj.email?.includes('@') ? rowObj.email.split('@')[0]?.trim() ?? null : null
      const client: Record<string, unknown> = {
        name: (rowObj.name?.trim() ? rowObj.name : null) ?? nameFromEmail ?? `Client ${originalRowIndex}`,
        industry: rowObj.industry || null,
        contact_name: rowObj.contact_name || null,
        email: rowObj.email || null,
        phone: rowObj.phone || null,
        address: rowObj.address || null,
        billing_address: rowObj.billing_address || null,
        tax_number: rowObj.tax_number || null,
        notes: rowObj.notes || null,
      }
      await onInsert(client)
      result.success++
    } catch (e) {
      result.failed++
      result.errors.push({ row: originalRowIndex, message: String(e) })
    }
  }
  return result
}

export function getImportTemplate(entity: ImportEntity): string {
  switch (entity) {
    case 'car_trackers':
      return CAR_TRACKER_COLUMNS.join(',') + '\n'
    case 'clients':
      return CLIENT_COLUMNS.join(',') + '\n'
    case 'subscriptions':
      return SUBSCRIPTION_COLUMNS.join(',') + '\n'
    case 'provider_payments':
      return 'provider_name,device_identifier,amount,currency,due_at,description,service_period_start,service_period_end\n'
    default:
      return ''
  }
}
