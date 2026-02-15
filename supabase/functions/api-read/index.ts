import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function getCorsHeaders(): Record<string, string> {
  const allowedOrigin = Deno.env.get('FRONTEND_URL')?.trim()
  return {
    'Access-Control-Allow-Origin': allowedOrigin ?? '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  }
}

const ALLOWED_TABLES = ['devices', 'clients'] as const
type AllowedTable = (typeof ALLOWED_TABLES)[number]

function isAllowedTable(s: string): s is AllowedTable {
  return ALLOWED_TABLES.includes(s as AllowedTable)
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders()
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  try {
    const apiKey = req.headers.get('x-api-key') ?? new URL(req.url).searchParams.get('api_key')
    const expectedKey = Deno.env.get('READ_ONLY_API_KEY')?.trim()
    if (!expectedKey || apiKey !== expectedKey) {
      return new Response(
        JSON.stringify({ error: 'Invalid or missing API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const url = new URL(req.url)
    const table = url.searchParams.get('table') ?? url.pathname.split('/').filter(Boolean).pop()
    if (!table || !isAllowedTable(table)) {
      return new Response(
        JSON.stringify({ error: 'Invalid table. Use ?table=devices or ?table=clients' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const client = createClient(supabaseUrl, supabaseServiceKey)

    const select =
      table === 'devices'
        ? 'id, name, identifier, status, device_type, serial_number, created_at, updated_at'
        : 'id, name, email, contact_name, phone, address, created_at, updated_at'

    const { data, error } = await client.from(table).select(select).order('created_at', { ascending: false }).limit(500)

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(JSON.stringify(data ?? []), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
