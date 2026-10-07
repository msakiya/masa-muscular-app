/**
 * Calculadora de masa muscular esquelética (Lee et al.)
 * Pure static — no frameworks.
 */

(function () {
  'use strict';

  const FORM = document.getElementById('metrics-form');
  const LEAD_FORM = document.getElementById('lead-form');
  const RESULTS = document.getElementById('results-section');
  const LEAD = document.getElementById('lead-section');
  const FORM_ERROR = document.getElementById('form-error');
  const LEAD_ERROR = document.getElementById('lead-error');
  const LEAD_SUCCESS = document.getElementById('lead-success');
  const PDF_BTN = document.getElementById('pdf-btn');

  /** @type {null | {
   *   sexo: string, edad: number, altura: number, peso: number, cintura: number|null,
   *   altura_m: number, smm: number, pct: number, imc: number, categoria: string
   * }} */
  let lastResult = null;

  // --- Cálculo Lee et al. ---
  function calcSMM(sexo, peso, altura_m, edad) {
    const base = 0.244 * peso + 7.8 * altura_m - 0.098 * edad;
    return sexo === 'hombre' ? base + 6.6 : base - 4.5;
  }

  function categorize(sexo, pct) {
    if (sexo === 'hombre') {
      if (pct < 33) return 'bajo';
      if (pct < 40) return 'promedio';
      if (pct < 45) return 'bueno';
      return 'alto';
    }
    if (pct < 24) return 'bajo';
    if (pct < 30) return 'promedio';
    if (pct < 35) return 'bueno';
    return 'alto';
  }

  function categoryLabel(cat) {
    const map = {
      bajo: 'Bajo',
      promedio: 'Promedio',
      bueno: 'Bueno',
      alto: 'Alto'
    };
    return map[cat] || cat;
  }

  function showError(el, msg) {
    el.hidden = false;
    el.textContent = msg;
  }

  function hideError(el) {
    el.hidden = true;
    el.textContent = '';
  }

  function validateMetrics(data) {
    if (!data.sexo || (data.sexo !== 'hombre' && data.sexo !== 'mujer')) {
      return 'Selecciona tu sexo.';
    }
    if (!(data.edad >= 15 && data.edad <= 100)) {
      return 'Ingresa una edad válida (15–100 años).';
    }
    if (!(data.altura >= 120 && data.altura <= 230)) {
      return 'Ingresa una altura válida (120–230 cm).';
    }
    if (!(data.peso >= 30 && data.peso <= 250)) {
      return 'Ingresa un peso válido (30–250 kg).';
    }
    if (data.cintura != null && !(data.cintura >= 40 && data.cintura <= 200)) {
      return 'La cintura debe estar entre 40 y 200 cm, o déjala vacía.';
    }
    return null;
  }

  FORM.addEventListener('submit', function (e) {
    e.preventDefault();
    hideError(FORM_ERROR);

    const sexo = (FORM.querySelector('input[name="sexo"]:checked') || {}).value;
    const edad = parseFloat(document.getElementById('edad').value);
    const altura = parseFloat(document.getElementById('altura').value);
    const peso = parseFloat(document.getElementById('peso').value);
    const cinturaRaw = document.getElementById('cintura').value.trim();
    const cintura = cinturaRaw === '' ? null : parseFloat(cinturaRaw);

    const data = { sexo: sexo, edad: edad, altura: altura, peso: peso, cintura: cintura };
    const err = validateMetrics(data);
    if (err) {
      showError(FORM_ERROR, err);
      return;
    }

    const altura_m = altura / 100;
    const smm = calcSMM(sexo, peso, altura_m, edad);
    const pct = (smm / peso) * 100;
    const imc = peso / (altura_m * altura_m);
    const categoria = categorize(sexo, pct);

    lastResult = {
      sexo: sexo,
      edad: edad,
      altura: altura,
      peso: peso,
      cintura: cintura,
      altura_m: altura_m,
      smm: smm,
      pct: pct,
      imc: imc,
      categoria: categoria
    };

    document.getElementById('out-smm').textContent = smm.toFixed(1);
    document.getElementById('out-pct').textContent = pct.toFixed(1);
    document.getElementById('out-imc').textContent = imc.toFixed(1);

    const catEl = document.getElementById('out-cat');
    catEl.textContent = categoryLabel(categoria);
    catEl.className = 'metric-value category category-' + categoria;

    RESULTS.hidden = false;
    LEAD.hidden = false;
    hideError(LEAD_ERROR);
    LEAD_SUCCESS.hidden = true;

    RESULTS.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // --- Recomendaciones personalizadas ---
  function buildRecommendations(r) {
    const proteinLow = (r.peso * 1.6).toFixed(0);
    const proteinHigh = (r.peso * 2.2).toFixed(0);
    const isLowOrAvg = r.categoria === 'bajo' || r.categoria === 'promedio';
    const calorieTip = isLowOrAvg
      ? 'Busca un ligero superávit calórico (aprox. +200–300 kcal/día) para favorecer la ganancia muscular, siempre con comida real y proteína suficiente.'
      : 'Mantén un aporte calórico de mantenimiento (o un déficit muy suave si tu objetivo es recomposición) para preservar tu masa muscular.';

    return [
      'Proteína: apunta a ~1.6–2.2 g/kg de peso corporal (~' + proteinLow + '–' + proteinHigh + ' g/día). Distribuye la proteína en 3–4 comidas.',
      'Entrenamiento de fuerza: 3–5 sesiones por semana, priorizando movimientos compuestos (sentadilla, peso muerto, press, remo). Progresión de carga cuando puedas.',
      'Sueño: 7–9 horas por noche. El sueño es clave para la recuperación y la síntesis muscular.',
      'Calorías: ' + calorieTip,
      'Hidratación: bebe agua a lo largo del día (orientativo ~30–40 ml/kg). Ajusta si sudas mucho en el entrenamiento.',
      'Seguimiento: vuelve a medir en 8–12 semanas (mismo método, misma hora del día) para ver la tendencia.'
    ];
  }

  function slugifyName(name) {
    return String(name || 'usuario')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'usuario';
  }

  function formatDatePE(d) {
    try {
      return new Intl.DateTimeFormat('es-PE', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        timeZone: 'America/Lima'
      }).format(d);
    } catch (_) {
      return d.toLocaleDateString('es-PE');
    }
  }

  function generatePDF(nombre, email, r) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error('jsPDF no cargó. Revisa tu conexión.');
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 18;
    let y = 22;

    const line = function (text, opts) {
      opts = opts || {};
      const size = opts.size || 11;
      const style = opts.style || 'normal';
      const color = opts.color || [30, 41, 59];
      doc.setFont('helvetica', style);
      doc.setFontSize(size);
      doc.setTextColor(color[0], color[1], color[2]);
      const maxW = pageW - margin * 2;
      const lines = doc.splitTextToSize(text, maxW);
      doc.text(lines, margin, y);
      y += lines.length * (size * 0.42) + (opts.gap != null ? opts.gap : 3);
      if (y > 275) {
        doc.addPage();
        y = 22;
      }
    };

    // Header band
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 36, 'F');
    doc.setTextColor(62, 224, 162);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Informe de Masa Muscular', margin, 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text('Estimación educativa · Fórmula Lee et al.', margin, 24);
    y = 48;

    line('Nombre: ' + nombre, { style: 'bold', size: 12, gap: 2 });
    line('Correo: ' + email, { size: 10, color: [100, 116, 139], gap: 2 });
    line('Fecha: ' + formatDatePE(new Date()), { size: 10, color: [100, 116, 139], gap: 8 });

    line('Métricas ingresadas', { style: 'bold', size: 13, color: [15, 23, 42], gap: 4 });
    line(
      'Sexo: ' + (r.sexo === 'hombre' ? 'Hombre' : 'Mujer') +
        '  ·  Edad: ' + r.edad + ' años' +
        '  ·  Altura: ' + r.altura + ' cm' +
        '  ·  Peso: ' + r.peso + ' kg' +
        (r.cintura != null ? '  ·  Cintura: ' + r.cintura + ' cm' : ''),
      { size: 10, gap: 8 }
    );

    line('Resultados estimados', { style: 'bold', size: 13, color: [15, 23, 42], gap: 4 });
    line('Masa muscular esquelética (SMM): ' + r.smm.toFixed(1) + ' kg', { style: 'bold', size: 12, gap: 2 });
    line('% masa muscular: ' + r.pct.toFixed(1) + ' %', { size: 11, gap: 2 });
    line('IMC: ' + r.imc.toFixed(1) + ' kg/m²', { size: 11, gap: 2 });
    line('Categoría: ' + categoryLabel(r.categoria), { style: 'bold', size: 12, gap: 8 });

    line('Recomendaciones personalizadas', { style: 'bold', size: 13, color: [15, 23, 42], gap: 4 });
    const recs = buildRecommendations(r);
    recs.forEach(function (rec, i) {
      line((i + 1) + '. ' + rec, { size: 10, gap: 5 });
    });

    y += 4;
    line('Aviso importante', { style: 'bold', size: 11, color: [15, 23, 42], gap: 3 });
    line(
      'Este informe es una estimación educativa basada en la ecuación de Lee et al. ' +
        'No constituye diagnóstico, evaluación clínica ni consejo médico. ' +
        'Consulta a un profesional de la salud antes de cambiar tu alimentación o entrenamiento.',
      { size: 9, color: [100, 116, 139], gap: 6 }
    );

    const filename = 'masa-muscular-' + slugifyName(nombre) + '.pdf';
    doc.save(filename);
    return filename;
  }

  function emailjsConfigured() {
    const cfg = (window.APP_CONFIG && window.APP_CONFIG.emailjs) || {};
    const key = cfg.publicKey || window.EMAILJS_PUBLIC_KEY || '';
    const service = cfg.serviceId || window.EMAILJS_SERVICE_ID || '';
    const template = cfg.templateId || window.EMAILJS_TEMPLATE_ID || '';
    return key && service && template ? { publicKey: key, serviceId: service, templateId: template } : null;
  }

  function summaryText(nombre, r) {
    return (
      'Hola ' + nombre + ', tu masa muscular estimada es ' +
      r.smm.toFixed(1) + ' kg (' + r.pct.toFixed(1) + '% del peso), IMC ' +
      r.imc.toFixed(1) + ', categoría ' + categoryLabel(r.categoria) +
      '. El PDF se descargó automáticamente en tu dispositivo.'
    );
  }

  function saveLead(nombre, email, r) {
    try {
      const lead = {
        nombre: nombre,
        email: email,
        fecha: new Date().toISOString(),
        smm: Number(r.smm.toFixed(2)),
        pct: Number(r.pct.toFixed(2)),
        imc: Number(r.imc.toFixed(2)),
        categoria: r.categoria,
        sexo: r.sexo
      };
      localStorage.setItem('masaMuscularLastLead', JSON.stringify(lead));
    } catch (_) { /* ignore quota */ }
  }

  async function trySendEmail(cfg, nombre, email, r) {
    if (!window.emailjs) return { ok: false, reason: 'sdk' };
    try {
      emailjs.init({ publicKey: cfg.publicKey });
      await emailjs.send(cfg.serviceId, cfg.templateId, {
        to_name: nombre,
        to_email: email,
        user_name: nombre,
        user_email: email,
        summary: summaryText(nombre, r),
        smm: r.smm.toFixed(1) + ' kg',
        muscle_pct: r.pct.toFixed(1) + ' %',
        imc: r.imc.toFixed(1),
        categoria: categoryLabel(r.categoria),
        sexo: r.sexo === 'hombre' ? 'Hombre' : 'Mujer',
        edad: String(r.edad),
        altura: r.altura + ' cm',
        peso: r.peso + ' kg',
        message: summaryText(nombre, r)
      });
      return { ok: true };
    } catch (err) {
      console.warn('EmailJS error', err);
      return { ok: false, reason: 'send' };
    }
  }

  LEAD_FORM.addEventListener('submit', async function (e) {
    e.preventDefault();
    hideError(LEAD_ERROR);
    LEAD_SUCCESS.hidden = true;

    if (!lastResult) {
      showError(LEAD_ERROR, 'Primero calcula tus métricas.');
      return;
    }

    const nombre = document.getElementById('nombre').value.trim();
    const email = document.getElementById('email').value.trim();

    if (nombre.length < 2) {
      showError(LEAD_ERROR, 'Ingresa tu nombre.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError(LEAD_ERROR, 'Ingresa un correo válido.');
      return;
    }

    PDF_BTN.disabled = true;
    PDF_BTN.textContent = 'Generando PDF…';

    let filename = '';
    try {
      filename = generatePDF(nombre, email, lastResult);
    } catch (err) {
      showError(LEAD_ERROR, err.message || 'No se pudo generar el PDF.');
      PDF_BTN.disabled = false;
      PDF_BTN.textContent = 'Generar y descargar PDF';
      return;
    }

    saveLead(nombre, email, lastResult);

    const cfg = emailjsConfigured();
    let emailNote = '';

    if (cfg) {
      PDF_BTN.textContent = 'Enviando correo…';
      const sent = await trySendEmail(cfg, nombre, email, lastResult);
      if (sent.ok) {
        emailNote = ' También enviamos un resumen a ' + email + '.';
      } else {
        emailNote = ' No pudimos enviar el correo automáticamente; el PDF ya se descargó.';
      }
    } else {
      emailNote =
        ' Para enviarlo por correo automáticamente, configura EmailJS en config.js.';
    }

    LEAD_SUCCESS.hidden = false;
    LEAD_SUCCESS.textContent =
      '¡Listo! Se descargó «' + filename + '».' + emailNote +
      (cfg ? '' : ' Guardamos tu correo (' + email + ') localmente por si Moisés te contacta.');

    PDF_BTN.disabled = false;
    PDF_BTN.textContent = 'Generar y descargar PDF';
  });
})();
