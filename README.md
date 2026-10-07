# Masa Muscular — Calculadora estática

Microapp **100 % HTML + CSS + JS** (sin Next.js, sin React, sin `npm` / build) que estima la masa muscular esquelética con la fórmula de Lee et al. y genera un PDF con recomendaciones.

## Abrir en local

Opción rápida (doble clic o desde el navegador):

```bash
# Desde la carpeta del proyecto
xdg-open index.html   # Linux
# open index.html     # macOS
```

O con un servidor estático (recomendado si el navegador bloquea módulos/CDN en `file://`):

```bash
cd /workspace/masa-muscular-app
python3 -m http.server 8080
# Abre http://localhost:8080
```

Archivos principales:

| Archivo       | Rol                                      |
|---------------|------------------------------------------|
| `index.html`  | UI en español (es-PE)                    |
| `styles.css`  | Estilos propios (sin Tailwind)           |
| `app.js`      | Cálculo, PDF (jsPDF CDN), EmailJS        |
| `config.js`   | Placeholders de EmailJS                  |

## Cálculo

Entradas: sexo, edad, altura (cm), peso (kg). Cintura opcional.

- Hombre: `SMM = 0.244·peso + 7.80·altura_m − 0.098·edad + 6.6`
- Mujer: `SMM = 0.244·peso + 7.80·altura_m − 0.098·edad − 4.5`
- `% masa = SMM / peso × 100`, `IMC = peso / altura_m²`

Categorías (orientativas / educativas) por % muscular según sexo.

## PDF

Al pulsar **Generar y descargar PDF** se crea un PDF en el cliente con jsPDF (CDN) e incluye métricas, categoría, recomendaciones y disclaimer. El archivo se descarga automáticamente (`masa-muscular-NOMBRE.pdf`).

## EmailJS (opcional)

Sin backend. El PDF **siempre** se descarga.

1. Crea una cuenta en [EmailJS](https://www.emailjs.com/).
2. Configura un servicio (Gmail, etc.) y una plantilla con variables como:
   - `{{to_name}}`, `{{to_email}}`, `{{summary}}`, `{{smm}}`, `{{muscle_pct}}`, `{{imc}}`, `{{categoria}}`
3. Edita `config.js`:

```js
window.APP_CONFIG = {
  emailjs: {
    publicKey: 'TU_PUBLIC_KEY',
    serviceId: 'TU_SERVICE_ID',
    templateId: 'TU_TEMPLATE_ID'
  }
};
```

Si EmailJS no está configurado, tras la descarga verás un mensaje para configurarlo. El último lead (nombre, correo, resumen) se guarda en `localStorage` (`masaMuscularLastLead`) por si quieres hacer seguimiento manual.

## Despliegue

Sitio estático: sube la carpeta a Vercel, Netlify, Cloudflare Pages, GitHub Pages, etc. No hace falta build ni variables de entorno (salvo que quieras inyectar EmailJS de otra forma).

## Aviso

Estimación educativa. **No** es consejo médico ni diagnóstico.
