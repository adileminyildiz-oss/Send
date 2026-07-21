// Moteur de montage local : assemble des photos (et/ou clips) en une vidéo MP4
// avec effet Ken Burns (zoom/pano), transitions, textes (ASS/libass) et musique.
//
// Tout passe par un unique appel ffmpeg avec un filter_complex construit ici.

import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { runFfmpeg } from './ffmpeg.js';
import { buildAss } from './ass.js';
import { FORMATS, XFADE_TRANSITIONS } from './config.js';

// Échappe un chemin pour l'utiliser comme option d'un filtre ffmpeg.
function escapeFilterPath(p) {
  return p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

// Expression de zoom Ken Burns basée sur le numéro de frame de sortie `on`.
function kenburnsZoom(frames, intensity, zoomIn) {
  const n = Math.max(2, frames);
  const denom = n - 1;
  if (zoomIn) {
    return `min(1+${intensity.toFixed(4)}*on/${denom},${(1 + intensity).toFixed(4)})`;
  }
  return `max(${(1 + intensity).toFixed(4)}-${intensity.toFixed(4)}*on/${denom},1)`;
}

// Construit le sous-graphe [v{i}] pour un segment.
function segmentFilter(seg, i, ctx) {
  const { width: W, height: H, fps, segDur, kenburns, kenburnsIntensity } = ctx;
  const label = `v${i}`;
  // Suffixe commun : force un frame rate constant (requis par xfade) et un
  // timebase/SAR/format homogènes entre tous les segments.
  const tail = `trim=duration=${segDur},setpts=PTS-STARTPTS,fps=${fps},settb=AVTB,setsar=1,format=yuv420p[${label}]`;

  if (seg.type === 'image') {
    const frames = Math.round(segDur * fps);
    if (kenburns) {
      const SS = 2; // suréchantillonnage pour un zoom net et fluide
      const z = kenburnsZoom(frames, kenburnsIntensity, i % 2 === 0);
      return (
        `[${i}:v]` +
        `scale=${W * SS}:${H * SS}:force_original_aspect_ratio=increase,` +
        `crop=${W * SS}:${H * SS},` +
        `zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':` +
        `d=1:s=${W}x${H}:fps=${fps},` +
        tail
      );
    }
    return (
      `[${i}:v]` +
      `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},` +
      tail
    );
  }
  // Clip vidéo (rush ou clip généré par IA).
  return (
    `[${i}:v]` +
    `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},` +
    tail
  );
}

// Chaîne les segments avec transitions xfade (ou concat si transition = none).
// Renvoie { chain: [filtres...], outLabel, total }.
function buildTransitionChain(n, segDur, transition, xdur) {
  const chain = [];
  if (n === 1) return { chain, outLabel: 'v0', total: segDur };

  if (transition === 'none') {
    const inputs = Array.from({ length: n }, (_, i) => `[v${i}]`).join('');
    chain.push(`${inputs}concat=n=${n}:v=1:a=0[vcat]`);
    return { chain, outLabel: 'vcat', total: n * segDur };
  }

  let prev = 'v0';
  let L = segDur;
  for (let k = 1; k < n; k++) {
    const out = k === n - 1 ? 'vchain' : `x${k}`;
    const offset = (L - xdur).toFixed(3);
    chain.push(
      `[${prev}][v${k}]xfade=transition=${transition}:duration=${xdur}:offset=${offset}[${out}]`,
    );
    prev = out;
    L = L + segDur - xdur;
  }
  return { chain, outLabel: 'vchain', total: L };
}

// Construit les événements texte (titre, légendes, call-to-action).
function buildTextEvents(settings, n, step, segDur, total) {
  const events = [];
  const slideWindow = (k) => {
    const start = k * step;
    return [start + 0.25, Math.min(start + segDur - 0.25, total)];
  };

  if (settings.title) {
    const end = Math.min(segDur, total) - 0.2;
    events.push({ text: settings.title, start: 0.3, end, align: 5, fontSize: settings.fontSize });
  }

  const caps = settings.captionsList || [];
  for (const cap of caps) {
    const slide = Number.isInteger(cap.slide) ? cap.slide : caps.indexOf(cap);
    if (slide < 0 || slide >= n) continue;
    const [s, e] = slideWindow(slide);
    events.push({
      text: cap.text,
      start: s,
      end: e,
      align: 2,
      marginV: 140,
      fontSize: Math.round(settings.fontSize * 0.62),
    });
  }

  if (settings.cta) {
    const start = Math.max(0, (n - 1) * step + 0.2);
    events.push({ text: settings.cta, start, end: total - 0.1, align: 5, fontSize: settings.fontSize });
  }
  return events;
}

export async function renderSlideshow({
  segments,
  settings,
  ffmpegBin,
  filters,
  outPath,
  verbose = false,
  onProgress,
}) {
  const fmt = FORMATS[settings.format];
  if (!fmt) throw new Error(`Format inconnu : ${settings.format}. Choix : ${Object.keys(FORMATS).join(', ')}`);

  let transition = settings.transition;
  if (!XFADE_TRANSITIONS.has(transition)) {
    throw new Error(`Transition inconnue : ${transition}. Choix : ${[...XFADE_TRANSITIONS].join(', ')}`);
  }
  if (segments.length < 2) transition = 'none';

  const W = fmt.width;
  const H = fmt.height;
  const fps = settings.fps;
  const segDur = settings.slideDuration;
  const xdur = Math.min(settings.transitionDuration, segDur * 0.9);
  const n = segments.length;

  const ctx = {
    width: W,
    height: H,
    fps,
    segDur,
    kenburns: settings.kenburns,
    kenburnsIntensity: settings.kenburnsIntensity,
  };

  // 1) Inputs ffmpeg.
  const inputArgs = [];
  for (const seg of segments) {
    if (seg.type === 'image') {
      inputArgs.push('-loop', '1', '-framerate', String(fps), '-t', String(segDur), '-i', seg.path);
    } else {
      inputArgs.push('-t', String(segDur), '-i', seg.path);
    }
  }

  // 2) Sous-graphes par segment.
  const filterParts = segments.map((seg, i) => segmentFilter(seg, i, ctx));

  // 3) Chaîne de transitions.
  const { chain, outLabel, total } = buildTransitionChain(n, segDur, transition, xdur);
  filterParts.push(...chain);

  const step = transition === 'none' ? segDur : segDur - xdur;

  // 4) Textes (ASS) si demandés et si libass est présent.
  let videoOut = outLabel;
  let tmpDir = null;
  const events = buildTextEvents(settings, n, step, segDur, total);
  const hasAss = filters.has('ass') || filters.has('subtitles');
  if (events.length > 0 && hasAss) {
    tmpDir = join(dirname(outPath), '.tmp');
    mkdirSync(tmpDir, { recursive: true });
    const assPath = join(tmpDir, 'subs.ass');
    const ass = buildAss(
      { width: W, height: H, font: settings.font, fontSize: settings.fontSize, titleColor: settings.titleColor, titleOutline: settings.titleOutline },
      events,
    );
    writeFileSync(assPath, ass, 'utf8');
    filterParts.push(`[${outLabel}]ass='${escapeFilterPath(assPath)}'[vout]`);
    videoOut = 'vout';
  } else {
    if (events.length > 0 && !hasAss) {
      console.warn(
        '⚠️  Ce build ffmpeg ne supporte ni le filtre "ass" ni "subtitles" (libass) : ' +
          'les textes seront ignorés. Installe un ffmpeg avec libass pour les activer.',
      );
    }
    filterParts.push(`[${outLabel}]null[vout]`);
    videoOut = 'vout';
  }

  // 5) Musique (optionnelle) : bouclée puis coupée à la durée totale.
  let musicIndex = null;
  if (settings.music) {
    musicIndex = segments.length;
    inputArgs.push('-stream_loop', '-1', '-i', settings.music);
    const fo = Math.min(settings.audioFadeOut, total);
    const foStart = Math.max(0, total - fo);
    filterParts.push(
      `[${musicIndex}:a]volume=${settings.musicVolume},` +
        `afade=t=in:st=0:d=1,afade=t=out:st=${foStart.toFixed(2)}:d=${fo.toFixed(2)}[aout]`,
    );
  }

  const filterComplex = filterParts.join(';');

  // 6) Assemblage de la commande.
  const args = ['-y', ...inputArgs, '-filter_complex', filterComplex, '-map', `[${videoOut}]`];
  if (musicIndex !== null) args.push('-map', '[aout]', '-c:a', 'aac', '-b:a', '192k');
  args.push(
    '-t', total.toFixed(3),
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-crf', String(settings.crf),
    '-preset', settings.preset,
    '-r', String(fps),
    '-movflags', '+faststart',
    outPath,
  );

  mkdirSync(dirname(outPath), { recursive: true });

  try {
    await runFfmpeg(ffmpegBin, args, {
      verbose,
      onProgress: onProgress ? (sec) => onProgress(sec, total) : undefined,
    });
  } finally {
    if (tmpDir) {
      try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }

  return { outPath, total, width: W, height: H, fps, segments: n };
}
