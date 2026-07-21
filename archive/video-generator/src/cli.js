// Interface en ligne de commande de générateur de vidéos publicitaires.

import { parseArgs } from 'node:util';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { resolveFfmpeg, availableFilters } from './ffmpeg.js';
import { collectSegments } from './segments.js';
import { resolveSettings, listTemplates } from './templates.js';
import { renderSlideshow } from './slideshow.js';
import { animateSegments, listProviders } from './ai/index.js';
import { FORMATS, XFADE_TRANSITIONS } from './config.js';

const OPTIONS = {
  help: { type: 'boolean', short: 'h' },
  output: { type: 'string', short: 'o' },
  template: { type: 'string', short: 't' },
  format: { type: 'string', short: 'f' },
  fps: { type: 'string' },
  duration: { type: 'string', short: 'd' }, // secondes par photo
  transition: { type: 'string' },
  'transition-duration': { type: 'string' },
  kenburns: { type: 'string' }, // "on" | "off"
  music: { type: 'string', short: 'm' },
  'music-volume': { type: 'string' },
  title: { type: 'string' },
  cta: { type: 'string' },
  captions: { type: 'string' },
  font: { type: 'string' },
  'title-color': { type: 'string' },
  crf: { type: 'string' },
  preset: { type: 'string' },
  ffmpeg: { type: 'string' },
  ai: { type: 'boolean' },
  'ai-provider': { type: 'string' },
  'ai-model': { type: 'string' },
  'ai-prompt': { type: 'string' },
  'list-templates': { type: 'boolean' },
  verbose: { type: 'boolean', short: 'v' },
};

function printHelp() {
  const fmts = Object.entries(FORMATS).map(([k, v]) => `      ${k.padEnd(6)} ${v.width}x${v.height}  ${v.label}`).join('\n');
  const tmpls = listTemplates().map((t) => `      ${t.name.padEnd(10)} ${t.description}`).join('\n');
  console.log(`
generate-ad — Génère une vidéo publicitaire (MP4) depuis un dossier de photos.

USAGE
  generate-ad <dossier-photos> [options]

EXEMPLES
  generate-ad photos --template promo --title "Soldes -50%" --cta "Commande maintenant"
  generate-ad ./photos -f 16:9 -d 3 --transition fade --music music/track.mp3 -o output/pub.mp4
  generate-ad ./photos --ai --ai-prompt "léger mouvement de caméra cinématique"

OPTIONS
  -o, --output <fichier>        Fichier MP4 de sortie (défaut: output/ad-<horodatage>.mp4)
  -t, --template <nom>          Template de style (voir --list-templates)
  -f, --format <ratio>          Format de sortie (défaut: template ou 9:16)
  -d, --duration <sec>          Durée par photo (défaut: template ou 3)
      --transition <nom>        Transition entre plans (fade, dissolve, slideleft, ...)
      --transition-duration <s> Durée de la transition
      --kenburns <on|off>       Active/désactive le zoom/pano Ken Burns
  -m, --music <fichier>         Musique de fond (bouclée puis coupée)
      --music-volume <0-1>      Volume de la musique (défaut: 0.8)
      --title <texte>           Titre affiché au début
      --cta <texte>             Call-to-action affiché à la fin
      --captions <fichier.json> Légendes par photo (JSON, voir examples/captions.example.json)
      --font <nom>              Police (ex: Sans, Serif)
      --title-color <#hex>      Couleur du texte
      --crf <n>                 Qualité H.264 (18=haute, 28=basse ; défaut 20)
      --preset <nom>            Preset x264 (ultrafast..veryslow ; défaut medium)
      --ffmpeg <chemin>         Chemin explicite vers le binaire ffmpeg
      --ai                      Anime chaque photo en clip via un modèle IA (hybride)
      --ai-provider <nom>       Provider IA (${listProviders().join(', ')})
      --ai-model <owner/name>   Modèle IA image→vidéo
      --ai-prompt <texte>       Prompt de mouvement pour l'IA
      --list-templates          Liste les templates disponibles
  -v, --verbose                 Affiche la sortie complète de ffmpeg
  -h, --help                    Affiche cette aide

FORMATS
${fmts}

TEMPLATES
${tmpls}

TRANSITIONS
      ${[...XFADE_TRANSITIONS].join(', ')}
`);
}

function timestamp() {
  // Horodatage lisible sans dépendance ; basé sur l'heure locale.
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function normalizeCaptions(raw) {
  if (!Array.isArray(raw)) throw new Error('Le fichier de légendes doit contenir un tableau JSON.');
  return raw.map((item, idx) => {
    if (typeof item === 'string') return { text: item, slide: idx };
    if (item && typeof item.text === 'string') return { text: item.text, slide: Number.isInteger(item.slide) ? item.slide : idx };
    throw new Error(`Légende invalide à l'index ${idx}.`);
  });
}

export async function main(argv) {
  let parsed;
  try {
    parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true });
  } catch (e) {
    console.error(`Erreur d'arguments : ${e.message}\n`);
    printHelp();
    process.exit(2);
  }
  const { values, positionals } = parsed;

  if (values.help) { printHelp(); return; }
  if (values['list-templates']) {
    console.log('Templates disponibles :');
    for (const t of listTemplates()) console.log(`  ${t.name.padEnd(12)} ${t.description}`);
    return;
  }

  const inputDir = positionals[0];
  if (!inputDir) {
    console.error('❌ Indique le dossier de photos.\n');
    printHelp();
    process.exit(2);
  }

  // 1) Réglages effectifs (defaults <- template <- flags).
  const overrides = {
    format: values.format,
    fps: values.fps ? parseInt(values.fps, 10) : undefined,
    slideDuration: values.duration ? parseFloat(values.duration) : undefined,
    transition: values.transition,
    transitionDuration: values['transition-duration'] ? parseFloat(values['transition-duration']) : undefined,
    kenburns: values.kenburns === undefined ? undefined : values.kenburns !== 'off',
    music: values.music ? resolve(values.music) : undefined,
    musicVolume: values['music-volume'] ? parseFloat(values['music-volume']) : undefined,
    title: values.title,
    cta: values.cta,
    font: values.font,
    titleColor: values['title-color'],
    crf: values.crf ? parseInt(values.crf, 10) : undefined,
    preset: values.preset,
  };
  const settings = resolveSettings({ template: values.template, overrides });

  // 2) Légendes éventuelles.
  if (values.captions) {
    const capPath = resolve(values.captions);
    if (!existsSync(capPath)) throw new Error(`Fichier de légendes introuvable : ${capPath}`);
    settings.captionsList = normalizeCaptions(JSON.parse(readFileSync(capPath, 'utf8')));
  }

  // 3) Validation musique.
  if (settings.music && !existsSync(settings.music)) {
    throw new Error(`Fichier musique introuvable : ${settings.music}`);
  }

  // 4) ffmpeg + collecte des médias.
  const ffmpegBin = resolveFfmpeg(values.ffmpeg);
  const filters = availableFilters(ffmpegBin);
  let segments = collectSegments(resolve(inputDir));

  console.log(`📸 ${segments.length} média(s) trouvé(s) dans « ${inputDir} ».`);
  console.log(`🎬 Format ${settings.format} (${FORMATS[settings.format].width}x${FORMATS[settings.format].height}), ` +
    `${settings.slideDuration}s/plan, transition « ${segments.length > 1 ? settings.transition : 'aucune'} ».`);

  // 5) Étape IA optionnelle (hybride).
  if (values.ai) {
    const provider = values['ai-provider'] || 'replicate';
    console.log(`🤖 Animation IA via « ${provider} »...`);
    const tmpDir = join(process.cwd(), '.tmp', 'ai');
    segments = await animateSegments(segments, {
      provider,
      tmpDir,
      prompt: values['ai-prompt'],
      model: values['ai-model'],
      onStep: (i, n, name) => console.log(`   • clip ${i}/${n} : ${name}`),
    });
    console.log('✅ Clips IA générés.');
  }

  // 6) Sortie.
  const outPath = values.output
    ? resolve(values.output)
    : resolve(join('output', `ad-${timestamp()}.mp4`));

  console.log('🛠️  Rendu en cours...');
  let lastPct = -1;
  const res = await renderSlideshow({
    segments,
    settings,
    ffmpegBin,
    filters,
    outPath,
    verbose: values.verbose,
    onProgress: (sec, total) => {
      const pct = Math.min(100, Math.round((sec / total) * 100));
      if (pct !== lastPct && pct % 5 === 0) {
        lastPct = pct;
        process.stdout.write(`\r   rendu ${pct}%   `);
      }
    },
  });

  process.stdout.write('\r');
  console.log(`✅ Vidéo générée : ${res.outPath}`);
  console.log(`   ${res.width}x${res.height}, ${res.total.toFixed(1)}s, ${res.fps} fps, ${res.segments} plan(s).`);
}
