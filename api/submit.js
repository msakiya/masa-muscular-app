/**
 * POST /api/submit
 * Body JSON:
 *   { nombre, email, smm, pct, imc, categoria, sexo, edad, altura, peso, cintura?,
 *     pdfBase64, pdfFilename }
 *
 * Actions (best-effort, always tries PDF download already happened client-side):
 *   1) Email PDF to the lead (Resend)
 *   2) Alert Moises at ayudacpe@gmail.com (exact subject/body)
 *   3) Upsert contact + add to Mautic campaign
 *
 * Env vars: see README.md
 */

const LEAD_ALERT_TO = 'ayudacpe@gmail.com';
const LEAD_ALERT_SUBJECT = 'Nuevo Lead de Calculadora de Masa Muscula';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      // ~4.5MB guard (PDF base64 can be large)
      if (raw.length > 4.5 * 1024 * 1024) {
        reject(new Error('Payload demasiado grande'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(new Error('JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

function isEmail(v) {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function leadAlertBody(nombre, email) {
  return (
    'Hola Moises, tienes un nuevo lead en la calculadora de masa muscular:\n' +
    '\n' +
    'Nombre: ' +
    nombre +
    '\n' +
    'Correo: ' +
    email +
    '\n' +
    '\n' +
    'Este lead viene gracias a la Calculadora de masa muscular de CPE.'
  );
}

async function sendResend({ apiKey, from, to, subject, text, html, attachments }) {
  const body = {
    from: from,
    to: Array.isArray(to) ? to : [to],
    subject: subject
  };
  if (text) body.text = text;
  if (html) body.html = html;
  if (attachments && attachments.length) body.attachments = attachments;

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = (data && (data.message || data.error)) || ('Resend HTTP ' + resp.status);
    throw new Error(String(msg));
  }
  return data;
}

function mauticAuthHeader() {
  const token = process.env.MAUTIC_ACCESS_TOKEN || '';
  if (token) return 'Bearer ' + token;
  const user = process.env.MAUTIC_USER || '';
  const pass = process.env.MAUTIC_PASSWORD || '';
  if (user && pass) {
    return 'Basic ' + Buffer.from(user + ':' + pass).toString('base64');
  }
  return null;
}

function mauticBaseUrl() {
  const raw = (process.env.MAUTIC_BASE_URL || 'https://mailingcpe.comunidadcpe.com').replace(/\/$/, '');
  return raw;
}

async function mauticUpsertAndAddToCampaign({ nombre, email, meta }) {
  const auth = mauticAuthHeader();
  const campaignId = process.env.MAUTIC_CAMPAIGN_ID || '';
  if (!auth) {
    return { ok: false, skipped: true, reason: 'missing_credentials' };
  }
  if (!campaignId) {
    return { ok: false, skipped: true, reason: 'missing_campaign_id' };
  }

  const base = mauticBaseUrl();
  const parts = String(nombre || '').trim().split(/\s+/);
  const firstname = parts[0] || nombre;
  const lastname = parts.length > 1 ? parts.slice(1).join(' ') : '';

  // Create / update contact
  const contactPayload = {
    email: email,
    firstname: firstname,
    lastname: lastname,
    overwriteWithBlank: false,
    tags: ['calculadora-masa-muscular', 'cpe'],
    // custom fields if configured in Mautic (ignored if unknown)
    smm_kg: meta && meta.smm,
    muscle_pct: meta && meta.pct,
    imc: meta && meta.imc,
    categoria_muscular: meta && meta.categoria
  };

  const createResp = await fetch(base + '/api/contacts/new', {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(contactPayload)
  });
  const createData = await createResp.json().catch(() => ({}));
  if (!createResp.ok) {
    return {
      ok: false,
      reason: 'contact_create_failed',
      status: createResp.status,
      detail: createData
    };
  }

  const contactId =
    (createData.contact && createData.contact.id) ||
    (createData.contact && createData.contact.fields && createData.contact.fields.all && createData.contact.fields.all.id) ||
    null;

  if (!contactId) {
    return { ok: false, reason: 'no_contact_id', detail: createData };
  }

  // Add contact to campaign
  const addResp = await fetch(
    base + '/api/campaigns/' + encodeURIComponent(campaignId) + '/contact/' + encodeURIComponent(contactId) + '/add',
    {
      method: 'POST',
      headers: {
        Authorization: auth,
        Accept: 'application/json'
      }
    }
  );
  const addData = await addResp.json().catch(() => ({}));
  if (!addResp.ok) {
    return {
      ok: false,
      reason: 'campaign_add_failed',
      contactId: contactId,
      status: addResp.status,
      detail: addData
    };
  }

  return { ok: true, contactId: contactId, campaignId: campaignId };
}

module.exports = async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
    return;
  }

  let body;
  try {
    body = await readJson(req);
  } catch (e) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: e.message || 'Bad request' }));
    return;
  }

  const nombre = String(body.nombre || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const pdfBase64 = String(body.pdfBase64 || '').replace(/^data:application\/pdf;base64,/, '');
  const pdfFilename = String(body.pdfFilename || 'masa-muscular.pdf').replace(/[^\w.\-áéíóúñÁÉÍÓÚÑ ]+/gi, '_');

  if (nombre.length < 2 || !isEmail(email)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Nombre o correo inválido' }));
    return;
  }

  const resendKey = process.env.RESEND_API_KEY || '';
  const resendFrom = process.env.RESEND_FROM || '';
  const results = {
    leadEmail: { ok: false, skipped: !resendKey || !resendFrom },
    alertEmail: { ok: false, skipped: !resendKey || !resendFrom },
    mautic: { ok: false }
  };

  // 1 + 2: emails via Resend
  if (resendKey && resendFrom) {
    const summaryHtml =
      '<p>Hola <strong>' +
      nombre.replace(/</g, '') +
      '</strong>,</p>' +
      '<p>Adjunto encontrarás tu informe de masa muscular estimada.</p>' +
      '<ul>' +
      '<li>SMM: ' +
      (body.smm != null ? body.smm : '—') +
      ' kg</li>' +
      '<li>% muscular: ' +
      (body.pct != null ? body.pct : '—') +
      ' %</li>' +
      '<li>IMC: ' +
      (body.imc != null ? body.imc : '—') +
      '</li>' +
      '<li>Categoría: ' +
      (body.categoria || '—') +
      '</li>' +
      '</ul>' +
      '<p style="color:#64748b;font-size:12px">Estimación educativa (Lee et al.). No es consejo médico.</p>' +
      '<p>— Comunidad CPE</p>';

    const attachments =
      pdfBase64.length > 50
        ? [{ filename: pdfFilename, content: pdfBase64 }]
        : undefined;

    try {
      await sendResend({
        apiKey: resendKey,
        from: resendFrom,
        to: email,
        subject: 'Tu informe de masa muscular — Comunidad CPE',
        html: summaryHtml,
        text:
          'Hola ' +
          nombre +
          ', adjunto tu informe de masa muscular estimada (SMM ' +
          (body.smm || '—') +
          ' kg). Estimación educativa, no es consejo médico.',
        attachments: attachments
      });
      results.leadEmail = { ok: true };
    } catch (e) {
      results.leadEmail = { ok: false, error: e.message || String(e) };
    }

    try {
      await sendResend({
        apiKey: resendKey,
        from: resendFrom,
        to: LEAD_ALERT_TO,
        subject: LEAD_ALERT_SUBJECT,
        text: leadAlertBody(nombre, email)
      });
      results.alertEmail = { ok: true };
    } catch (e) {
      results.alertEmail = { ok: false, error: e.message || String(e) };
    }
  } else {
    results.leadEmail = {
      ok: false,
      skipped: true,
      reason: 'missing_RESEND_API_KEY_or_RESEND_FROM'
    };
    results.alertEmail = {
      ok: false,
      skipped: true,
      reason: 'missing_RESEND_API_KEY_or_RESEND_FROM'
    };
  }

  // 3: Mautic
  try {
    results.mautic = await mauticUpsertAndAddToCampaign({
      nombre: nombre,
      email: email,
      meta: {
        smm: body.smm,
        pct: body.pct,
        imc: body.imc,
        categoria: body.categoria
      }
    });
  } catch (e) {
    results.mautic = { ok: false, error: e.message || String(e) };
  }

  const anyEmailOk = results.leadEmail.ok || results.alertEmail.ok;
  const configured = !!(resendKey && resendFrom);

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(
    JSON.stringify({
      ok: true,
      configured: configured,
      results: results,
      message: configured
        ? 'Procesado'
        : 'PDF listo en el cliente. Configura RESEND_* y MAUTIC_* en Vercel para correo y campaña.'
    })
  );
};
