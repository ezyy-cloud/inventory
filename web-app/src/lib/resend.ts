import { supabase } from './supabaseClient'

export async function sendInvoiceEmail(invoiceId: string): Promise<{ success: true } | { error: string }> {
  const { data, error } = await supabase.functions.invoke('send-invoice-email', {
    body: { invoiceId },
  })

  if (error) {
    return { error: error.message }
  }

  if (data?.error) {
    return { error: typeof data.error === 'string' ? data.error : String(data.error) }
  }

  return { success: true }
}
