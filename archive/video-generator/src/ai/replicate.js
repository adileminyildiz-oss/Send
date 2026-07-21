// Provider IA « image → vidéo » via l'API Replicate.
//
// Replicate héberge de nombreux modèles d'animation d'image (Stable Video
// Diffusion, Kling, Wan, etc.). Les noms de modèles et de champs d'entrée
// évoluent souvent : ils sont donc entièrement configurables par variables
// d'environnement, avec des valeurs par défaut raisonnables.
//
// Variables d'environnement :
//   REPLICATE_API_TOKEN   (obligatoire)  jeton d'API Replicate
//   REPLICATE_MODEL       (optionnel)    "owner/name" du modèle image→vidéo
//   REPLICATE_IMAGE_FIELD (optionnel)    nom du champ image (défaut: "image")
//   REPLICATE_EXTRA_INPUT (optionnel)    JSON d'entrées additionnelles
//
// Aucune dépendance npm : on utilise fetch (Node >= 18).

import { readFileSync, writeFileSync } from 'node:fs';
import { extname } from 'node:path';

const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.bmp': 'image/bmp', '.gif': 'image/gif',
};

function imageToDataUri(path) {
  const ext = extname(path).toLowerCase();
  const mime = MIME[ext] || 'image/jpeg';
  const b64 = readFileSync(path).toString('base64');
  return `data:${mime};base64,${b64}`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Anime une image en un clip vidéo court. Renvoie le chemin du fichier .mp4 écrit.
export async function animate(imagePath, outPath, opts = {}) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error(
      'REPLICATE_API_TOKEN manquant. Crée un jeton sur https://replicate.com/account/api-tokens ' +
        "puis exporte-le (export REPLICATE_API_TOKEN=...) avant d'utiliser --ai.",
    );
  }

  const model = opts.model || process.env.REPLICATE_MODEL || 'wan-video/wan-2.2-i2v-fast';
  const imageField = opts.imageField || process.env.REPLICATE_IMAGE_FIELD || 'image';

  let extra = {};
  if (process.env.REPLICATE_EXTRA_INPUT) {
    try { extra = JSON.parse(process.env.REPLICATE_EXTRA_INPUT); }
    catch { throw new Error('REPLICATE_EXTRA_INPUT n\'est pas un JSON valide.'); }
  }

  const input = { [imageField]: imageToDataUri(imagePath), ...extra };
  if (opts.prompt) input.prompt = opts.prompt;

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: 'wait=60', // demande à Replicate d'attendre jusqu'à 60s côté serveur
  };

  // 1) Création de la prédiction (endpoint "models" -> dernière version).
  const createRes = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ input }),
  });
  if (!createRes.ok) {
    const body = await createRes.text();
    throw new Error(`Replicate: échec de création (${createRes.status}) pour ${model}.\n${body}`);
  }
  let prediction = await createRes.json();

  // 2) Polling jusqu'à état terminal.
  const deadline = Date.now() + (opts.timeoutMs || 10 * 60 * 1000);
  while (['starting', 'processing'].includes(prediction.status)) {
    if (Date.now() > deadline) throw new Error('Replicate: délai dépassé.');
    await sleep(2500);
    const pollRes = await fetch(prediction.urls.get, { headers: { Authorization: `Bearer ${token}` } });
    if (!pollRes.ok) throw new Error(`Replicate: échec du polling (${pollRes.status}).`);
    prediction = await pollRes.json();
  }

  if (prediction.status !== 'succeeded') {
    throw new Error(`Replicate: prédiction ${prediction.status}. ${prediction.error || ''}`);
  }

  // 3) Récupération de l'URL du clip et téléchargement.
  const output = prediction.output;
  const url = Array.isArray(output) ? output[output.length - 1] : output;
  if (typeof url !== 'string') {
    throw new Error(`Replicate: sortie inattendue du modèle ${model} : ${JSON.stringify(output)}`);
  }
  const dl = await fetch(url);
  if (!dl.ok) throw new Error(`Replicate: échec du téléchargement du clip (${dl.status}).`);
  const buf = Buffer.from(await dl.arrayBuffer());
  writeFileSync(outPath, buf);
  return outPath;
}
