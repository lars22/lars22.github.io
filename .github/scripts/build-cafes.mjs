// Liest alle Café-Dateien aus karte/_cafes/*.md und schreibt karte/cafes.json.
// Keine Abhängigkeiten nötig – läuft mit Node.js in der GitHub Action.
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const dir = 'karte/_cafes';
const out = 'karte/cafes.json';
const errors = [];
const downloads = [];

function parseValue(raw) {
  const v = raw.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  const n = Number(v.replace(',', '.'));
  return v !== '' && !Number.isNaN(n) ? n : v;
}

const cafes = readdirSync(dir)
  .filter(f => f.endsWith('.md') && !f.startsWith('_'))
  .sort()
  .map(f => {
    const text = readFileSync(join(dir, f), 'utf8').replace(/\r\n/g, '\n');
    const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!m) { errors.push(`${f}: Kopfbereich zwischen den Linien --- fehlt`); return null; }
    const data = {};
    for (const line of m[1].split('\n')) {
      const i = line.indexOf(':');
      if (i > 0) data[line.slice(0, i).trim()] = parseValue(line.slice(i + 1));
    }
    const body = m[2].replace(/<!--[\s\S]*?-->/g, '').trim();
    const cafe = {
      id: basename(f, '.md'),
      name: String(data.name ?? data.title ?? ''),
      area: String(data.area ?? ''),
      address: String(data.address ?? ''),
      lat: Number(data.lat),
      lng: Number(data.lng),
      text: body,
      // Kategorie: cafe, bar, essen oder sehen (ohne Angabe: cafe)
      kategorie: ['cafe', 'bar', 'essen', 'sehen'].includes(String(data.kategorie ?? '').toLowerCase()) ? String(data.kategorie).toLowerCase() : 'cafe',
      // Favorit: "favorit: true" (oder ja) in der Datei
      favorite: ['true', 'ja', 'yes'].includes(String(data.favorit ?? '').toLowerCase())
    };
    // Optionales Bild: "bild: 24grad.jpg" (Datei in karte/bilder/) oder ein https-Link,
    // z. B. von Wikimedia Commons. Links werden beim Bauen einmal heruntergeladen.
    const img = String(data.bild ?? data.image ?? '').trim();
    if (/^https:\/\//.test(img)) {
      const local = ['jpg', 'png', 'webp'].map(e => `bilder/${cafe.id}.${e}`).find(f => existsSync(join('karte', f)));
      cafe.image = local || img;
      if (!local) downloads.push({ cafe, url: img });
    } else if (img) {
      const file = img.replace(/^\/?(karte\/)?(bilder\/)?/, '');
      if (!existsSync(join('karte/bilder', file))) errors.push(`${f}: Bild "${file}" nicht im Ordner karte/bilder gefunden`);
      cafe.image = 'bilder/' + file;
    }
    // Bildnachweis, z. B. bild_credit: "Foto: Staro1, CC BY-SA 3.0" und bild_link: Link zur Quelle
    if (data.bild_credit) cafe.credit = String(data.bild_credit);
    if (/^https:\/\//.test(String(data.bild_link ?? ''))) cafe.creditLink = String(data.bild_link);
    // Optional: eigener Google-Maps-Link ("google: https://maps.app.goo.gl/...")
    if (/^https:\/\//.test(String(data.google ?? ''))) cafe.google = String(data.google);
    if (!cafe.name) errors.push(`${f}: name fehlt`);
    if (!Number.isFinite(cafe.lat) || !Number.isFinite(cafe.lng)) errors.push(`${f}: lat/lng fehlen oder sind keine Zahlen`);
    return cafe;
  })
  .filter(Boolean);

if (errors.length) {
  console.error('Fehler in den Café-Dateien:\n- ' + errors.join('\n- '));
  process.exit(1);
}

for (const { cafe, url } of downloads) {
  try {
    const r = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'lars22.github.io Cafe-Karte (https://lars22.github.io/karte/)' } });
    const type = r.headers.get('content-type') || '';
    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : type.includes('jpeg') ? 'jpg' : '';
    if (!r.ok || !ext) throw new Error(`${r.status} ${type}`);
    mkdirSync('karte/bilder', { recursive: true });
    writeFileSync(`karte/bilder/${cafe.id}.${ext}`, Buffer.from(await r.arrayBuffer()));
    cafe.image = `bilder/${cafe.id}.${ext}`;
    console.log(`Bild für ${cafe.id} heruntergeladen.`);
  } catch (e) {
    console.log(`Bild für ${cafe.id} nicht geladen (${e.message}), Link wird direkt verwendet.`);
  }
}
writeFileSync(out, JSON.stringify(cafes, null, 2) + '\n');
console.log(`${cafes.length} Café(s) nach ${out} geschrieben.`);
