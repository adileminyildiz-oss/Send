// Collecte des médias d'entrée (photos et/ou clips vidéo) depuis un dossier.

import { readdirSync, statSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { IMAGE_EXTENSIONS, VIDEO_EXTENSIONS } from './config.js';

// Tri « naturel » : photo2 avant photo10.
function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

// Renvoie une liste ordonnée de segments : { type: 'image'|'video', path, name }.
export function collectSegments(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    throw new Error(`Dossier d'entrée introuvable : ${dir}`);
  }

  const segments = [];
  for (const name of entries.sort(naturalCompare)) {
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (!st.isFile()) continue;
    const ext = extname(name).toLowerCase();
    if (IMAGE_EXTENSIONS.has(ext)) {
      segments.push({ type: 'image', path: full, name: basename(name) });
    } else if (VIDEO_EXTENSIONS.has(ext)) {
      segments.push({ type: 'video', path: full, name: basename(name) });
    }
  }

  if (segments.length === 0) {
    throw new Error(
      `Aucune photo ni vidéo trouvée dans « ${dir} ». ` +
        `Formats acceptés : ${[...IMAGE_EXTENSIONS].join(', ')}.`,
    );
  }
  return segments;
}
