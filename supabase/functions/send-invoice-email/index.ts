import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API = 'https://api.resend.com/emails'
const FROM_EMAIL = 'Ezyy Inventory <invoices@notifications.ezyy.cloud>'

function getCorsHeaders(): Record<string, string> {
  const allowedOrigin = Deno.env.get('FRONTEND_URL')?.trim()
  return {
    'Access-Control-Allow-Origin': allowedOrigin ?? '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders()
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('RESEND_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { invoiceId } = await req.json()
    if (!invoiceId) {
      return new Response(
        JSON.stringify({ error: 'invoiceId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: invoice, error: invError } = await supabase
      .from('client_invoices')
      .select(
        `
        id,
        invoice_number,
        amount,
        currency,
        due_at,
        period_start,
        period_end,
        clients(id, name, email),
        subscription_plans(id, name, billing_cycle),
        devices(id, name, identifier)
      `,
      )
      .eq('id', invoiceId)
      .single()

    if (invError ?? !invoice) {
      return new Response(
        JSON.stringify({ error: 'Invoice not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const client = (invoice as { clients?: { email?: string | null } | { email?: string | null }[] }).clients
    const email = Array.isArray(client) ? client[0]?.email : (client as { email?: string | null })?.email
    if (!email?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Client has no email address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const clientName = Array.isArray(client) ? client[0]?.name : (client as { name?: string })?.name ?? ''
    const amount = (invoice as { amount?: number }).amount ?? 0
    const currency = (invoice as { currency?: string | null }).currency ?? 'USD'
    const dueAt = (invoice as { due_at?: string | null }).due_at ?? '—'
    const invNum = (invoice as { invoice_number?: string }).invoice_number ?? ''
    const periodStart = (invoice as { period_start?: string | null }).period_start ?? null
    const periodEnd = (invoice as { period_end?: string | null }).period_end ?? null

    const plan = (invoice as { subscription_plans?: { name?: string; billing_cycle?: string } | null }).subscription_plans
    const planName = plan?.name ?? ''
    const planBilling = plan?.billing_cycle ?? ''

    const device = (invoice as { devices?: { name?: string | null; identifier?: string | null } | null }).devices
    const deviceLabel = device?.name ?? device?.identifier ?? ''

    const periodRow =
      periodStart && periodEnd
        ? `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;">Period</td><td style="text-align:right;padding:8px 0;border-bottom:1px solid #eee;">${periodStart} to ${periodEnd}</td></tr>`
        : ''

    const planRow = planName
      ? `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;">Plan</td><td style="text-align:right;padding:8px 0;border-bottom:1px solid #eee;">${planName}${planBilling ? ` (${planBilling})` : ''}</td></tr>`
      : ''

    const deviceRow = deviceLabel
      ? `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;">Device</td><td style="text-align:right;padding:8px 0;border-bottom:1px solid #eee;">${deviceLabel}</td></tr>`
      : ''

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Invoice ${invNum}</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="color:#111;">Invoice ${invNum}</h2>
  <p>Hi ${clientName ?? 'there'},</p>
  <p>Please find your invoice details below:</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee;">Invoice number</td><td style="text-align:right;padding:8px 0;border-bottom:1px solid #eee;">${invNum}</td></tr>
    ${planRow}
    ${deviceRow}
    ${periodRow}
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee;">Amount</td><td style="text-align:right;padding:8px 0;border-bottom:1px solid #eee;">${currency} ${Number(amount).toLocaleString()}</td></tr>
    <tr><td style="padding:8px 0;">Due date</td><td style="text-align:right;padding:8px 0;">${dueAt}</td></tr>
  </table>
  <p style="color:#666;font-size:14px;">Thank you for your business.</p>
</body>
</html>
`.trim()

    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email.trim()],
        subject: `Invoice ${invNum} from Ezyy Inventory`,
        html,
      }),
    })

    const resData = await res.json()
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: resData.message ?? resData.detail ?? 'Failed to send email' }),
        { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({ success: true, id: resData.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
