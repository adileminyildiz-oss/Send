// Résolution du binaire ffmpeg et exécution.
//
// Ordre de détection :
//   1. option --ffmpeg <chemin> (passée via l'appelant)
//   2. variable d'environnement FFMPEG_BIN
//   3. binaire "ffmpeg" présent dans le PATH
//   4. binaire embarqué par le paquet python "imageio-ffmpeg" (fallback pratique
//      dans les environnements sans ffmpeg système)
//
// On ne dépend d'aucun paquet npm : on lance ffmpeg via child_process.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

function commandExists(cmd) {
  const probe = spawnSync(cmd, ['-version'], { stdio: 'ignore' });
  return probe.status === 0;
}

// Tente de récupérer le binaire fourni par imageio-ffmpeg (si python + paquet présents).
function imageioFfmpeg() {
  try {
    const out = spawnSync(
      'python3',
      ['-c', 'import imageio_ffmpeg,sys; sys.stdout.write(imageio_ffmpeg.get_ffmpeg_exe())'],
      { encoding: 'utf8' },
    );
    if (out.status === 0 && out.stdout && existsSync(out.stdout.trim())) {
      return out.stdout.trim();
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function resolveFfmpeg(explicit) {
  if (explicit) {
    if (!existsSync(explicit) && !commandExists(explicit)) {
      throw new Error(`ffmpeg introuvable au chemin fourni : ${explicit}`);
    }
    return explicit;
  }
  if (process.env.FFMPEG_BIN && commandExists(process.env.FFMPEG_BIN)) {
    return process.env.FFMPEG_BIN;
  }
  if (commandExists('ffmpeg')) return 'ffmpeg';
  const bundled = imageioFfmpeg();
  if (bundled) return bundled;

  throw new Error(
    'ffmpeg est introuvable. Installe-le (https://ffmpeg.org/download.html), ' +
      'ou définis la variable FFMPEG_BIN, ou passe --ffmpeg <chemin>.',
  );
}

// Renvoie la liste des filtres disponibles dans ce build ffmpeg (Set de noms).
export function availableFilters(bin) {
  const out = spawnSync(bin, ['-hide_banner', '-filters'], { encoding: 'utf8' });
  const filters = new Set();
  if (out.status === 0 && out.stdout) {
    for (const line of out.stdout.split('\n')) {
      // format : " TSC name  IN->OUT  description"
      const m = line.match(/^\s*[A-Z.]{3,}\s+(\w+)\s+/);
      if (m) filters.add(m[1]);
    }
  }
  return filters;
}

// Exécute ffmpeg avec les arguments donnés. Renvoie une promesse résolue au
// succès, rejetée avec le stderr en cas d'échec.
export function runFfmpeg(bin, args, { onProgress, verbose } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      const s = chunk.toString();
      stderr += s;
      if (verbose) process.stderr.write(s);
      if (onProgress) {
        const m = s.match(/time=(\d+):(\d+):(\d+\.\d+)/);
        if (m) {
          const seconds = (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]);
          onProgress(seconds);
        }
      }
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg a échoué (code ${code}).\n${stderr.slice(-4000)}`));
    });
  });
}
