# Masa Muscular — Calculadora + leads

Microapp **HTML + CSS + JS** (sin React/Next en el front) que estima masa muscular esquelética (Lee et al.), genera un PDF personalizado y, vía **`/api/submit`** (Vercel serverless), envía correos con Resend y agrega el lead a Mautic.

## Abrir en local (solo UI + PDF)

```bash
cd /workspace/masa-muscular-app
python3 -m http.server 8080
# http://localhost:8080
```

El PDF y la descarga funcionan offline. `POST /api/submit` requiere el deploy en Vercel (o `vercel dev` con env vars).

## Flujo

1. Usuario ingresa sexo, edad, altura, peso (cintura opcional) → **Calcular**
2. Ve SMM, %, IMC, categoría + caveat educativo
3. Ingresa nombre + correo → **Generar y descargar PDF**
   - PDF se descarga en el navegador (siempre)
   - Se envía el PDF al correo del lead (Resend)
   - Se avisa a `ayudacpe@gmail.com` (asunto/cuerpo fijos)
   - Se crea/actualiza el contacto en Mautic y se agrega a la campaña

## Variables de entorno (Vercel)

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `RESEND_API_KEY` | Sí (correos) | API key de [Resend](https://resend.com/) |
| `RESEND_FROM` | Sí (correos) | Remitente verificado, ej. `Comunidad CPE <noreply@tudominio.com>` |
| `MAUTIC_BASE_URL` | No | Default: `https://mailingcpe.comunidadcpe.com` |
| `MAUTIC_USER` | * | Usuario API Mautic (Basic Auth) |
| `MAUTIC_PASSWORD` | * | Password API Mautic |
| `MAUTIC_ACCESS_TOKEN` | * | Alternativa a user/pass (Bearer). Si está, se usa en lugar de Basic. |
| `MAUTIC_CAMPAIGN_ID` | Sí (campaña) | ID numérico de la campaña de mejora de salud |

\* Necesitas **token** *o* **user+password**. Sin ellos, el API responde OK pero marca Mautic como `skipped`.

### Qué debe proporcionar Moisés

1. Cuenta Resend + dominio verificado → `RESEND_API_KEY`, `RESEND_FROM`
2. En Mautic (`mailingcpe.comunidadcpe.com`): crear credenciales API (o token OAuth) y anotar el **ID de la campaña** que envía info de mejora de salud → `MAUTIC_USER`/`MAUTIC_PASSWORD` (o `MAUTIC_ACCESS_TOKEN`) + `MAUTIC_CAMPAIGN_ID`

En el workspace solo se encontró el hosting SSH del sitio Mautic (`mailingcpe.comunidadcpe.com` / usuario `mauticcpe`), **sin** API key ni campaign id.

## Alert email (fijo)

- **To:** `ayudacpe@gmail.com`
- **Subject:** `Nuevo Lead de Calculadora de Masa Muscula`
- **Body:**

```
Hola Moises, tienes un nuevo lead en la calculadora de masa muscular:

Nombre: {Nombre del lead}
Correo: {correo del lead}

Este lead viene gracias a la Calculadora de masa muscular de CPE.
```

## Archivos

| Ruta | Rol |
|------|-----|
| `index.html` / `styles.css` / `app.js` | UI + cálculo + PDF (jsPDF CDN) |
| `config.js` | Config client sin secretos |
| `api/submit.js` | Serverless: Resend + Mautic |
| `vercel.json` | Headers / static |

## Cálculo

- Hombre: `SMM = 0.244·peso + 7.80·altura_m − 0.098·edad + 6.6`
- Mujer: `SMM = 0.244·peso + 7.80·altura_m − 0.098·edad − 4.5`

Estimación educativa. **No** es consejo médico.
