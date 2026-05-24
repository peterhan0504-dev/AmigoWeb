// POST /api/contact
// 现在只校验+log，不实际发邮件。接 MailChannels 时在 TODO 处加发件即可。
export async function onRequestPost({ request }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const name = str(payload.name);
  const company = str(payload.company);
  const email = str(payload.email);
  const type = str(payload.type);
  const message = str(payload.message);
  const lang = payload.lang === 'en' ? 'en' : 'zh';

  if (!name || !email || !message) {
    return json({ ok: false, error: 'missing_required' }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, error: 'invalid_email' }, 400);
  }
  if (message.length > 4000 || name.length > 200) {
    return json({ ok: false, error: 'too_long' }, 400);
  }

  // 这里以后接 MailChannels：
  // await fetch('https://api.mailchannels.net/tx/v1/send', { ... })
  console.log('[contact]', { lang, name, company, email, type, message });

  return json({ ok: true });
}

export async function onRequest({ request }) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  return json({ ok: false, error: 'method_not_allowed' }, 405);
}

function str(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders() },
  });
}
