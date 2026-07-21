// Dispatcher des providers IA « image → vidéo ».
//
// Chaque provider expose `animate(imagePath, outPath, opts) -> Promise<string>`.
// On garde une abstraction simple pour pouvoir en ajouter d'autres (Runway,
// Pika, fal.ai, Google Veo...) sans toucher au reste du code.

import { mkdirSync } from 'node:fs';
import { join, basename, extname, dirname } from 'node:path';
import * as replicate from './replicate.js';

const PROVIDERS = {
  replicate,
};

export function listProviders() {
  return Object.keys(PROVIDERS);
}

// Anime une liste de segments images en clips vidéo. Renvoie une nouvelle liste
// de segments (type 'video') pointant vers les clips générés.
// Les segments déjà vidéo sont conservés tels quels.
export async function animateSegments(segments, { provider = 'replicate', tmpDir, prompt, model, onStep } = {}) {
  const impl = PROVIDERS[provider];
  if (!impl) {
    throw new Error(`Provider IA inconnu : ${provider}. Disponibles : ${listProviders().join(', ')}`);
  }
  mkdirSync(tmpDir, { recursive: true });

  const result = [];
  let i = 0;
  for (const seg of segments) {
    i++;
    if (seg.type !== 'image') {
      result.push(seg);
      continue;
    }
    if (onStep) onStep(i, segments.length, seg.name);
    const base = basename(seg.name, extname(seg.name));
    const outPath = join(tmpDir, `ai-${String(i).padStart(3, '0')}-${base}.mp4`);
    await impl.animate(seg.path, outPath, { prompt, model });
    result.push({ type: 'video', path: outPath, name: basename(outPath), aiGenerated: true });
  }
  return result;
}

export { PROVIDERS };
