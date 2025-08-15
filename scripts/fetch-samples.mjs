#!/usr/bin/env node
/**
 * Sample fetch script (manifest-driven).
 *
 * Reads ./scripts/sample-manifest.json which must contain an array of entries:
 * [{
 *    "file": "indie_rock_excerpt.mp3",   // output filename placed in src/assets/samples
 *    "url": "https://.../file.mp3",     // OPTIONAL direct downloadable URL (NO auth / TOS conflicts). If omitted & local=true, file must already exist.
 *    "title": "Track Title",
 *    "artist": "Artist Name",
 *    "license": "CC BY 4.0",            // Or CC0 / etc. If proprietary, you must have rights – DO NOT commit audio.
 *    "source": "https://example.com/file-page",
 *    "attribution": "Artist – \"Track Title\" (CC BY 4.0) via Example Site",
 *    "enabled": true,                    // Optional: if false/omitted, skip
 *    "local": true,                      // Optional: if true, skip download & just include in attribution (file must exist already)
 *    "skipIfExists": true                // Optional: if true and file already present, don't re-download
 * }]
 *
 * IMPORTANT LICENSE / ETHICS NOTE:
 *  - This script deliberately does NOT scrape or circumvent commercial music libraries (e.g. Artlist, Epidemic, etc.).
 *  - Many such services forbid automated downloading and distribution of preview files. Respect their Terms of Service.
 *  - If you have a valid license and manually export short excerpts for internal demo, place them in src/assets/samples,
 *    add manifest entries with { local: true, url: "" }, and DO NOT commit copyrighted material unless permitted.
 *  - Prefer Creative Commons (CC0 / CC BY) or original works you own for public repository samples.
 */
import { writeFile, mkdir, stat, readFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import https from 'node:https';

const manifestPath = path.resolve(process.cwd(), 'scripts/sample-manifest.json');
const outDir = path.resolve(process.cwd(), 'src/assets/samples');

async function ensureDir(p) {
  try { await stat(p); } catch { await mkdir(p, { recursive: true }); }
}

async function loadManifest() {
  try {
    const raw = await readFile(manifestPath, 'utf8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) throw new Error('Manifest root must be an array');
    return data;
  } catch (e) {
    if (e.code === 'ENOENT') {
      // Create template
      const template = [
        {
          file: 'indie_rock_excerpt.mp3',
          url: '',
          title: 'Indie Rock Excerpt (Placeholder)',
          artist: 'TBD',
          license: 'CC BY 4.0',
          source: 'https://',
          attribution: 'TBD – "Indie Rock Excerpt" (CC BY 4.0)',
          enabled: false,
          local: true
        },
        {
          file: 'female_vocal_guitar_excerpt.mp3',
          url: '',
          title: 'Female Vocal + Guitar (Placeholder)',
          artist: 'TBD',
          license: 'CC BY 4.0',
          source: 'https://',
          attribution: 'TBD – "Female Vocal + Guitar" (CC BY 4.0)',
          enabled: false,
          local: true
        },
        {
          file: 'funk_groove_cc0.mp3',
          url: '',
          title: 'Funk Groove (Placeholder)',
          artist: 'TBD',
          license: 'CC0',
          source: 'https://',
          attribution: 'TBD – "Funk Groove" (CC0)',
          enabled: false,
          local: true
        }
      ];
      await writeFile(manifestPath, JSON.stringify(template, null, 2));
      console.log('Created manifest template at scripts/sample-manifest.json. Populate it then re-run.');
      process.exit(0);
    }
    throw e;
  }
}

function download(url, dest, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (redirectCount > 5) return reject(new Error('Too many redirects for ' + url));
        const next = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).toString();
        return resolve(download(next, dest, redirectCount + 1));
      }
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode + ' for ' + url));
      const out = createWriteStream(dest);
      res.pipe(out);
      out.on('finish', () => out.close(resolve));
      out.on('error', reject);
    }).on('error', reject);
  });
}

(async () => {
  const entries = await loadManifest();
  await ensureDir(outDir);
  const attribution = [];
  console.log('Processing', entries.length, 'entries');
  for (const entry of entries) {
    if (entry.enabled === false) {
      console.log('Skipping (disabled):', entry.file);
      continue;
    }
    const dest = path.join(outDir, entry.file);
    try {
      const exists = await stat(dest).then(()=>true).catch(()=>false);
      if (entry.local) {
        if (!exists) {
          console.warn('Local file flagged but missing:', entry.file);
          // Still record attribution template for visibility
          attribution.push({
            file: entry.file,
            title: entry.title,
            artist: entry.artist,
            license: entry.license,
            source: entry.source,
            attribution: entry.attribution
          });
          continue;
        } else {
          console.log('Using local file:', entry.file);
        }
      } else {
        if (!entry.url) {
          console.warn('Skipping (no url & not local):', entry.file);
          attribution.push({
            file: entry.file,
            title: entry.title,
            artist: entry.artist,
            license: entry.license,
            source: entry.source,
            attribution: entry.attribution
          });
          continue;
        }
        if (exists && entry.skipIfExists) {
          console.log('Exists, skip download:', entry.file);
        } else {
          await download(entry.url, dest);
          console.log('Downloaded', entry.file);
        }
      }
      attribution.push({ file: entry.file, title: entry.title, artist: entry.artist, license: entry.license, source: entry.source, attribution: entry.attribution });
    } catch (e) {
      console.warn('Failed', entry.file, e.message);
    }
  }
  await writeFile(path.join(outDir, 'attribution.json'), JSON.stringify(attribution, null, 2));
  console.log('Wrote attribution.json (' + attribution.length + ' entries)');
})();
