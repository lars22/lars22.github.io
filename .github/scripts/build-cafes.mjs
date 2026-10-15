// Liest alle Café-Dateien aus karte/_cafes/*.md und schreibt karte/cafes.json.
// Keine Abhängigkeiten nötig – läuft mit Node.js in der GitHub Action.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const dir = 'karte/_cafes';
const out = 'karte/cafes.json';
const errors = [];

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
      // Favorit: "favorit: true" (oder ja) in der Datei
      favorite: ['true', 'ja', 'yes'].includes(String(data.favorit ?? '').toLowerCase())
    };
    // Optionales Bild: "bild: 24grad.jpg" → Datei liegt in karte/bilder/
    const img = String(data.bild ?? data.image ?? '').trim().replace(/^\/?(karte\/)?(bilder\/)?/, '');
    if (img) {
      if (!existsSync(join('karte/bilder', img))) errors.push(`${f}: Bild "${img}" nicht im Ordner karte/bilder gefunden`);
      cafe.image = 'bilder/' + img;
    }
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

writeFileSync(out, JSON.stringify(cafes, null, 2) + '\n');
console.log(`${cafes.length} Café(s) nach ${out} geschrieben.`);
