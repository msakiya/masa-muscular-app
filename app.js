/**
 * Calculadora de masa muscular esquelética (Lee et al.)
 * UI: HTML/CSS/JS. Envío de correos + Mautic vía POST /api/submit (Resend).
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
    return ({ bajo: 'Bajo', promedio: 'Promedio', bueno: 'Bueno', alto: 'Alto' })[cat] || cat;
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
    if (!(data.edad >= 15 && data.edad <= 100)) return 'Ingresa una edad válida (15–100 años).';
    if (!(data.altura >= 120 && data.altura <= 230)) return 'Ingresa una altura válida (120–230 cm).';
    if (!(data.peso >= 30 && data.peso <= 250)) return 'Ingresa un peso válido (30–250 kg).';
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

  /** @returns {{ filename: string, base64: string }} */
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
    buildRecommendations(r).forEach(function (rec, i) {
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

    y += 4;
    line('¿Quieres ganar más masa muscular?', { style: 'bold', size: 12, color: [15, 23, 42], gap: 3 });
    line(
      'Si te interesa profundizar con una guía práctica, te recomendamos ' +
        '«Aumento de Masa Muscular - Guía Completa 2023» (ebook, Max Fitness).',
      { size: 10, gap: 3 }
    );
    const affiliateUrl = 'https://go.hotmart.com/P107922015D';
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text('Página del producto:', margin, y);
    const labelW = doc.getTextWidth('Página del producto: ');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 118, 110);
    doc.textWithLink(affiliateUrl, margin + labelW, y, { url: affiliateUrl });
    y += 8;

    const filename = 'masa-muscular-' + slugifyName(nombre) + '.pdf';
    const dataUri = doc.output('datauristring');
    const base64 = dataUri.split(',')[1] || '';
    doc.save(filename);
    return { filename: filename, base64: base64 };
  }

  function saveLead(nombre, email, r) {
    try {
      localStorage.setItem(
        'masaMuscularLastLead',
        JSON.stringify({
          nombre: nombre,
          email: email,
          fecha: new Date().toISOString(),
          smm: Number(r.smm.toFixed(2)),
          pct: Number(r.pct.toFixed(2)),
          imc: Number(r.imc.toFixed(2)),
          categoria: r.categoria,
          sexo: r.sexo
        })
      );
    } catch (_) { /* ignore */ }
  }

  async function submitLead(payload) {
    const resp = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await resp.json().catch(function () {
      return { ok: false };
    });
    if (!resp.ok) {
      throw new Error((data && data.error) || 'Error al enviar');
    }
    return data;
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

    let pdf;
    try {
      pdf = generatePDF(nombre, email, lastResult);
    } catch (err) {
      showError(LEAD_ERROR, err.message || 'No se pudo generar el PDF.');
      PDF_BTN.disabled = false;
      PDF_BTN.textContent = 'Generar y descargar PDF';
      return;
    }

    saveLead(nombre, email, lastResult);

    PDF_BTN.textContent = 'Enviando…';
    let serverNote = '';
    try {
      const data = await submitLead({
        nombre: nombre,
        email: email,
        smm: lastResult.smm.toFixed(1),
        pct: lastResult.pct.toFixed(1),
        imc: lastResult.imc.toFixed(1),
        categoria: categoryLabel(lastResult.categoria),
        sexo: lastResult.sexo,
        edad: lastResult.edad,
        altura: lastResult.altura,
        peso: lastResult.peso,
        cintura: lastResult.cintura,
        pdfBase64: pdf.base64,
        pdfFilename: pdf.filename
      });

      const r = (data && data.results) || {};
      const parts = [];
      if (r.leadEmail && r.leadEmail.ok) parts.push('enviamos el PDF a ' + email);
      else if (r.leadEmail && r.leadEmail.skipped) {
        parts.push('correo al lead pendiente (configura RESEND_API_KEY y RESEND_FROM en Vercel)');
      } else if (r.leadEmail && !r.leadEmail.ok) {
        parts.push('no se pudo enviar el PDF por correo (revisa Resend)');
      }
      if (r.alertEmail && r.alertEmail.ok) parts.push('aviso enviado a Moisés');
      if (r.mautic && r.mautic.ok) parts.push('lead agregado a la campaña Mautic');
      else if (r.mautic && r.mautic.skipped) {
        parts.push('Mautic pendiente (credenciales / campaign id)');
      }

      serverNote = parts.length ? ' También: ' + parts.join('; ') + '.' : '';
    } catch (err) {
      serverNote =
        ' El PDF se descargó. No pudimos contactar el servidor de envío (' +
        (err.message || 'error') +
        ').';
    }

    LEAD_SUCCESS.hidden = false;
    LEAD_SUCCESS.textContent =
      '¡Listo! Se descargó «' + pdf.filename + '».' + serverNote;

    PDF_BTN.disabled = false;
    PDF_BTN.textContent = 'Generar y descargar PDF';
  });
})();
