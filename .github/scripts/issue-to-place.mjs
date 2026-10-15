// Macht aus einem ausgefüllten GitHub-Formular („Neuer Ort“) eine Datei in karte/_cafes/.
// Liest ISSUE_BODY, schreibt die Datei, lädt ein angehängtes Foto nach karte/bilder/
// und gibt Name und Dateipfad für die nächsten Schritte der Action aus.
import { existsSync, writeFileSync, appendFileSync } from 'node:fs';

const body = (process.env.ISSUE_BODY || '').replace(/\r\n/g, '\n');
const out = (k, v) => process.env.GITHUB_OUTPUT && appendFileSync(process.env.GITHUB_OUTPUT, `${k}<<EOF\n${v}\nEOF\n`);
function fail(msg) { out('error', msg); console.error(msg); process.exit(1); }

// Formular-Antworten stehen als „### Feldname“ gefolgt vom Wert
const fields = {};
for (const part of body.split(/^### /m).slice(1)) {
  const nl = part.indexOf('\n');
  const label = part.slice(0, nl).trim();
  const value = part.slice(nl + 1).trim();
  fields[label] = value === '_No response_' ? '' : value;
}
const get = prefix => (Object.entries(fields).find(([k]) => k.startsWith(prefix)) || [, ''])[1];

const name = get('Name');
const kategorieLabel = get('Kategorie');
const stadt = get('Stadt');
const adresse = get('Adresse');
const koord = get('Koordinaten');
const text = get('Beschreibung');
const bild = get('Foto');

if (!name) fail('Der Name fehlt.');
if (!adresse) fail('Die Adresse fehlt.');
const kategorie = { 'Café': 'cafe', 'Essen & Trinken': 'essen', 'Sehenswürdigkeit': 'sehen' }[kategorieLabel] || 'cafe';

// Dateiname aus dem Namen, z. B. „Black Delight“ → black-delight.md
const base = name.toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'ort';
let slug = base, n = 2;
while (existsSync(`karte/_cafes/${slug}.md`)) slug = `${base}-${n++}`;

// Koordinaten: aus dem Feld (Zahlen oder Google-Maps-Link), sonst aus der Adresse
let lat, lng;
const m = koord.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || koord.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || koord.match(/(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
if (m) { lat = Number(m[1]); lng = Number(m[2]); }
if (lat === undefined) {
  // Mehrere Versuche: Adresse, dann Name + Stadt, dann Postleitzahl + Stadt (je 1 Anfrage pro Sekunde)
  const withCity = adresse.toLowerCase().includes(stadt.toLowerCase()) ? adresse : [adresse, stadt].filter(Boolean).join(', ');
  const plz = (adresse.match(/\b\d{3}-\d{4}\b|\b\d{4,5}\b/) || [''])[0];
  const versuche = [withCity, [name, stadt].filter(Boolean).join(', '), plz && [plz, stadt].join(' ')].filter(Boolean);
  for (const q of versuche) {
    const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=' + encodeURIComponent(q);
    const r = await fetch(url, { headers: { 'User-Agent': 'lars22.github.io Cafe-Karte (GitHub Action)', 'Accept-Language': 'de' } });
    const data = r.ok ? await r.json() : [];
    if (data.length) {
      lat = Number(Number(data[0].lat).toFixed(7));
      lng = Number(Number(data[0].lon).toFixed(7));
      console.log(`Gefunden über „${q}“`);
      break;
    }
    await new Promise(res => setTimeout(res, 1100));
  }
  if (lat === undefined) fail('Die Adresse wurde nicht gefunden. Öffne das Issue, tippe auf „Bearbeiten“ und trage unter „### Koordinaten“ die Zahlen aus Google Maps ein (lange auf den Ort drücken, z. B. „35.0270, 135.7556“). Nach dem Speichern wird es automatisch nochmal versucht.');
}

// Foto: erste angehängte Bild-URL herunterladen
let bildZeile = '';
// Nur echte GitHub-Bildanhänge, keine anderen Links
const img = bild.match(/https:\/\/(?:github\.com\/user-attachments\/assets\/|(?:private-)?user-images\.githubusercontent\.com\/)[^\s)"'<>]+/);
if (img) {
  try {
    const r = await fetch(img[0], { redirect: 'follow', headers: { Authorization: `Bearer ${process.env.GH_TOKEN}` } });
    const type = r.headers.get('content-type') || '';
    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : type.includes('jpeg') || type.includes('jpg') ? 'jpg' : '';
    if (r.ok && ext) {
      writeFileSync(`karte/bilder/${slug}.${ext}`, Buffer.from(await r.arrayBuffer()));
      bildZeile = `bild: "${slug}.${ext}"\n`;
    } else out('warning', 'Das Foto konnte nicht übernommen werden (nur JPG, PNG oder WebP). Der Ort wurde ohne Foto angelegt.');
  } catch { out('warning', 'Das Foto konnte nicht geladen werden. Der Ort wurde ohne Foto angelegt.'); }
}

const q = s => JSON.stringify(String(s));
writeFileSync(`karte/_cafes/${slug}.md`,
  `---\nname: ${q(name)}\nkategorie: ${q(kategorie)}\narea: ${q(stadt)}\naddress: ${q(adresse)}\nlat: ${lat}\nlng: ${lng}\n${bildZeile}---\n${text}\n`);
out('name', name);
out('file', `karte/_cafes/${slug}.md`);
console.log(`Angelegt: karte/_cafes/${slug}.md (${lat}, ${lng})`);
