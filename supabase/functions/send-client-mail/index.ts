import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API = 'https://api.resend.com/emails'
const FROM_EMAIL = Deno.env.get('MAIL_FROM_EMAIL')?.trim() ?? 'Ezyy Inventory <invoices@notifications.ezyy.cloud>'

function getCorsHeaders(): Record<string, string> {
  const allowedOrigin = Deno.env.get('FRONTEND_URL')?.trim()
  return {
    'Access-Control-Allow-Origin': allowedOrigin ?? '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

type ClientRow = { id: string; name: string | null; email: string | null; is_active?: boolean }

function substitutePlaceholders(text: string, client: ClientRow): string {
  return text
    .replace(/\{\{client_name\}\}/g, client.name?.trim() ?? '')
    .replace(/\{\{client_email\}\}/g, client.email?.trim() ?? '')
}

async function sendOne(
  apiKey: string,
  to: string,
  subject: string,
  html: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html,
    }),
  })
  const resData = await res.json()
  if (!res.ok) {
    return { ok: false, error: resData.message ?? resData.detail ?? 'Failed to send email' }
  }
  return { ok: true }
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

    const body = await req.json().catch(() => ({}))
    const broadcast = body.broadcast === true

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    if (broadcast) {
      // Broadcast: subject + bodyHtml OR templateId; activeOnly optional
      const templateId = body.templateId ?? null
      let subject: string
      let bodyHtml: string

      if (templateId) {
        const { data: template, error: tErr } = await supabase
          .from('mail_templates')
          .select('subject, body_html')
          .eq('id', templateId)
          .single()
        if (tErr ?? !template) {
          return new Response(
            JSON.stringify({ error: 'Template not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        }
        subject = (template as { subject: string }).subject
        bodyHtml = (template as { body_html: string }).body_html
      } else {
        subject = body.subject ?? ''
        bodyHtml = body.bodyHtml ?? body.body_html ?? ''
        if (!subject.trim() || !bodyHtml.trim()) {
          return new Response(
            JSON.stringify({ error: 'subject and bodyHtml required when not using templateId' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        }
      }

      const activeOnly = body.activeOnly !== false
      const rawDeviceTypes = body.deviceTypes
      const deviceTypes: string[] = Array.isArray(rawDeviceTypes)
        ? rawDeviceTypes.filter((t) => typeof t === 'string' && /^[a-z_]+$/.test(t))
        : []

      let query = supabase
        .from('clients')
        .select('id, name, email, is_active')
        .not('email', 'is', null)
      if (activeOnly) {
        query = query.eq('is_active', true)
      }
      const { data: clients, error: listErr } = await query
      if (listErr) {
        return new Response(
          JSON.stringify({ error: listErr.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      let list = (clients ?? []) as ClientRow[]
      if (deviceTypes.length > 0) {
        const { data: assignments, error: assignErr } = await supabase
          .from('device_assignments')
          .select('client_id, devices!inner(device_type)')
          .is('unassigned_at', null)
        if (assignErr) {
          return new Response(
            JSON.stringify({ error: assignErr.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        }
        const allowedClientIds = new Set(
          (assignments ?? [])
            .filter((a: { devices?: { device_type?: string } | null }) => deviceTypes.includes((a.devices as { device_type?: string })?.device_type ?? ''))
            .map((a: { client_id: string }) => a.client_id),
        )
        list = list.filter((c) => allowedClientIds.has(c.id))
      }
      const withEmail = list.filter((c) => c.email?.trim())
      let sent = 0
      const errors: string[] = []
      for (const client of withEmail) {
        const to = client.email!.trim()
        const subj = substitutePlaceholders(subject, client)
        const html = substitutePlaceholders(bodyHtml, client)
        const result = await sendOne(apiKey, to, subj, html)
        if (result.ok) sent++
        else errors.push(`${client.name ?? client.id}: ${result.error ?? 'Unknown'}`)
      }
      return new Response(
        JSON.stringify({ success: true, sent, failed: withEmail.length - sent, errors: errors.length > 0 ? errors : undefined }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Single send: clientId + (subject + bodyHtml) OR templateId
    const clientId = body.clientId ?? null
    if (!clientId) {
      return new Response(
        JSON.stringify({ error: 'clientId required for single send' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('id, name, email')
      .eq('id', clientId)
      .single()
    if (clientErr ?? !client) {
      return new Response(
        JSON.stringify({ error: 'Client not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    const clientRow = client as ClientRow
    const email = clientRow.email?.trim()
    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Client has no email address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    let subject: string
    let bodyHtml: string
    const templateId = body.templateId ?? null
    if (templateId) {
      const { data: template, error: tErr } = await supabase
        .from('mail_templates')
        .select('subject, body_html')
        .eq('id', templateId)
        .single()
      if (tErr ?? !template) {
        return new Response(
          JSON.stringify({ error: 'Template not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      subject = substitutePlaceholders((template as { subject: string }).subject, clientRow)
      bodyHtml = substitutePlaceholders((template as { body_html: string }).body_html, clientRow)
    } else {
      subject = body.subject ?? ''
      bodyHtml = body.bodyHtml ?? body.body_html ?? ''
      if (!subject.trim() || !bodyHtml.trim()) {
        return new Response(
          JSON.stringify({ error: 'subject and bodyHtml required when not using templateId' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      subject = substitutePlaceholders(subject, clientRow)
      bodyHtml = substitutePlaceholders(bodyHtml, clientRow)
    }

    const result = await sendOne(apiKey, email, subject, bodyHtml)
    if (!result.ok) {
      return new Response(
        JSON.stringify({ error: result.error ?? 'Failed to send email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
