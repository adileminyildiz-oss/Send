// Serveur web interne : upload de photos -> génération de vidéo pub -> téléchargement.
//
// Réutilise le moteur de rendu local (src/). Pensé pour un usage interne :
// protégé par mot de passe (HTTP Basic Auth) via les variables d'environnement
// APP_USER / APP_PASSWORD.

import express from 'express';
import multer from 'multer';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, extname } from 'node:path';
import { mkdirSync, existsSync, createReadStream, statSync } from 'node:fs';

import { resolveFfmpeg, availableFilters } from '../src/ffmpeg.js';
import { collectSegments } from '../src/segments.js';
import { resolveSettings, listTemplates } from '../src/templates.js';
import { renderSlideshow } from '../src/slideshow.js';
import { animateSegments } from '../src/ai/index.js';
import { FORMATS } from '../src/config.js';
import { JobManager, JobStatus } from './jobs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PUBLIC_DIR = join(__dirname, 'public');
const WORK_ROOT = join(ROOT, '.work');
mkdirSync(WORK_ROOT, { recursive: true });

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const APP_USER = process.env.APP_USER || 'aem';
const APP_PASSWORD = process.env.APP_PASSWORD || '';
const MAX_FILES = parseInt(process.env.MAX_FILES || '40', 10);
const MAX_FILE_MB = parseInt(process.env.MAX_FILE_MB || '25', 10);

// ffmpeg (résolu une fois au démarrage — échoue vite si absent).
const ffmpegBin = resolveFfmpeg(process.env.FFMPEG_BIN);
const filters = availableFilters(ffmpegBin);

const jobs = new JobManager({ concurrency: parseInt(process.env.RENDER_CONCURRENCY || '1', 10) });

const app = express();
app.disable('x-powered-by');

// Sonde de santé publique (avant l'auth) — utilisée par les hébergeurs (Render...).
app.get('/healthz', (req, res) => res.status(200).json({ ok: true }));

// --- Authentification interne (HTTP Basic) -------------------------------
function timingSafeEqual(a, b) {
  // Comparaison à temps constant simplifiée (longueurs potentiellement égales).
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

app.use((req, res, next) => {
  if (!APP_PASSWORD) return next(); // pas de mot de passe défini -> accès ouvert (dev)
  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    const [user, pass] = Buffer.from(encoded, 'base64').toString('utf8').split(':');
    if (user === APP_USER && pass !== undefined && timingSafeEqual(pass, APP_PASSWORD)) {
      return next();
    }
  }
  res.set('WWW-Authenticate', 'Basic realm="AEM Conseil - Générateur vidéo", charset="UTF-8"');
  return res.status(401).send('Authentification requise.');
});

// --- Upload (multer) -----------------------------------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!req._uploadDir) {
      req._uploadDir = join(WORK_ROOT, `up-${Date.now().toString(36)}-${Math.floor(process.hrtime()[1]).toString(36)}`);
      mkdirSync(req._uploadDir, { recursive: true });
    }
    cb(null, req._uploadDir);
  },
  filename: (req, file, cb) => {
    // Préserve l'ordre d'arrivée via un index zéro-padé + nom d'origine assaini.
    const idx = (req._fileIndex = (req._fileIndex ?? -1) + 1);
    const safe = file.originalname.replace(/[^\w.\-]+/g, '_');
    cb(null, `${String(idx).padStart(3, '0')}-${safe}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: MAX_FILES + 1 },
});

// --- Routes API ----------------------------------------------------------
app.get('/api/config', (req, res) => {
  res.json({
    formats: Object.entries(FORMATS).map(([id, v]) => ({ id, ...v })),
    templates: listTemplates(),
    hasLibass: filters.has('ass') || filters.has('subtitles'),
    aiEnabled: !!process.env.REPLICATE_API_TOKEN,
    maxFiles: MAX_FILES,
    maxFileMb: MAX_FILE_MB,
  });
});

const fields = upload.fields([
  { name: 'photos', maxCount: MAX_FILES },
  { name: 'music', maxCount: 1 },
]);

app.post('/api/render', fields, async (req, res) => {
  try {
    const photos = req.files?.photos || [];
    if (photos.length === 0) {
      return res.status(400).json({ error: 'Aucune photo reçue.' });
    }
    const b = req.body || {};

    // Réglages : defaults <- template <- champs du formulaire.
    const overrides = {
      format: b.format || undefined,
      slideDuration: b.duration ? parseFloat(b.duration) : undefined,
      transition: b.transition || undefined,
      transitionDuration: b.transitionDuration ? parseFloat(b.transitionDuration) : undefined,
      kenburns: b.kenburns === undefined ? undefined : b.kenburns === 'true' || b.kenburns === 'on',
      title: b.title || undefined,
      cta: b.cta || undefined,
      titleColor: b.titleColor || undefined,
      font: b.font || undefined,
    };
    const settings = resolveSettings({ template: b.template || undefined, overrides });

    // Légendes (JSON string optionnel).
    if (b.captions) {
      try {
        const arr = JSON.parse(b.captions);
        if (Array.isArray(arr)) {
          settings.captionsList = arr.map((it, i) =>
            typeof it === 'string' ? { text: it, slide: i } : { text: it.text, slide: Number.isInteger(it.slide) ? it.slide : i },
          );
        }
      } catch { /* légendes ignorées si JSON invalide */ }
    }

    // Musique uploadée éventuelle.
    const music = req.files?.music?.[0];
    if (music) settings.music = music.path;

    const workDir = join(WORK_ROOT, `job-${Date.now().toString(36)}`);
    mkdirSync(workDir, { recursive: true });
    const outPath = join(workDir, 'ad.mp4');

    const useAi = (b.ai === 'true' || b.ai === 'on') && !!process.env.REPLICATE_API_TOKEN;

    const job = jobs.create({
      uploadDir: req._uploadDir,
      workDir,
      outputPath: outPath,
      filename: (b.title ? b.title.replace(/[^\w.\-]+/g, '_') : 'pub') + '.mp4',
    });

    jobs.enqueue(job, async (j) => {
      let segments = collectSegments(req._uploadDir);
      if (useAi) {
        segments = await animateSegments(segments, {
          provider: 'replicate',
          tmpDir: join(workDir, 'ai'),
          prompt: b.aiPrompt || undefined,
        });
      }
      const result = await renderSlideshow({
        segments,
        settings,
        ffmpegBin,
        filters,
        outPath,
        onProgress: (sec, total) => { j.progress = Math.min(99, Math.round((sec / total) * 100)); },
      });
      j.result = { total: result.total, width: result.width, height: result.height, segments: result.segments };
    });

    res.status(202).json({ jobId: job.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job introuvable (peut-être expiré).' });
  const payload = { id: job.id, status: job.status, progress: job.progress };
  if (job.status === JobStatus.QUEUED) payload.queuePosition = jobs.queuePosition(job.id);
  if (job.status === JobStatus.ERROR) payload.error = job.error;
  if (job.status === JobStatus.DONE) payload.result = job.result;
  res.json(payload);
});

app.get('/api/jobs/:id/download', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job || job.status !== JobStatus.DONE || !existsSync(job.outputPath)) {
    return res.status(404).send('Vidéo non disponible.');
  }
  const size = statSync(job.outputPath).size;
  res.set('Content-Type', 'video/mp4');
  res.set('Content-Length', String(size));
  res.set('Content-Disposition', `attachment; filename="${job.filename}"`);
  createReadStream(job.outputPath).pipe(res);
});

// --- Frontend statique ---------------------------------------------------
app.use(express.static(PUBLIC_DIR));

// Gestion des erreurs multer (taille/nombre de fichiers).
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Upload refusé : ${err.message}` });
  }
  return res.status(500).json({ error: err.message || 'Erreur serveur.' });
});

app.listen(PORT, HOST, () => {
  console.log(`\n🎬 Générateur vidéo (interne) — http://${HOST}:${PORT}`);
  console.log(`   ffmpeg : ${ffmpegBin}`);
  console.log(`   libass : ${filters.has('ass') || filters.has('subtitles') ? 'oui' : 'NON (textes désactivés)'}`);
  console.log(`   IA     : ${process.env.REPLICATE_API_TOKEN ? 'activable' : 'désactivée (REPLICATE_API_TOKEN absent)'}`);
  if (!APP_PASSWORD) {
    console.warn('   ⚠️  APP_PASSWORD non défini : accès NON protégé. Définis-le pour un usage interne.');
  } else {
    console.log(`   auth   : activée (utilisateur « ${APP_USER} »)`);
  }
});
