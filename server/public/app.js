// Frontend du générateur de vidéos pub (interne).
'use strict';

const $ = (id) => document.getElementById(id);
const state = { files: [], config: null };

// --- Chargement de la config serveur -------------------------------------
async function loadConfig() {
  const res = await fetch('api/config');
  const cfg = await res.json();
  state.config = cfg;

  for (const t of cfg.templates) {
    const o = document.createElement('option');
    o.value = t.name;
    o.textContent = `${t.name} — ${t.description}`;
    $('template').appendChild(o);
  }
  const none = document.createElement('option');
  none.value = ''; none.textContent = '(aucun)';
  $('template').appendChild(none);
  $('template').value = cfg.templates[0]?.name || '';

  for (const f of cfg.formats) {
    const o = document.createElement('option');
    o.value = f.id;
    o.textContent = `${f.id} — ${f.label}`;
    $('format').appendChild(o);
  }
  const df = document.createElement('option');
  df.value = ''; df.textContent = '(template)';
  $('format').insertBefore(df, $('format').firstChild);
  $('format').value = '';

  if (cfg.aiEnabled) { $('aiWrap').hidden = false; $('aiPromptWrap').hidden = false; }
  if (!cfg.hasLibass) {
    $('captionsWrap').querySelector('textarea').disabled = true;
    $('title').placeholder = 'Textes indisponibles (libass absent côté serveur)';
  }
}

// --- Gestion des fichiers -------------------------------------------------
function addFiles(fileList) {
  const max = state.config?.maxFiles || 40;
  for (const file of fileList) {
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) continue;
    if (state.files.length >= max) { showError(`Maximum ${max} fichiers.`); break; }
    state.files.push({ file, url: URL.createObjectURL(file), id: Math.random().toString(36).slice(2) });
  }
  renderThumbs();
}

function renderThumbs() {
  const ul = $('thumbs');
  ul.innerHTML = '';
  state.files.forEach((item, i) => {
    const li = document.createElement('li');
    li.draggable = true;
    li.dataset.id = item.id;
    const isVideo = item.file.type.startsWith('video/');
    li.innerHTML =
      `<span class="idx">${i + 1}</span>` +
      `<button class="rm" title="Retirer">×</button>` +
      (isVideo ? `<video src="${item.url}" muted></video>` : `<img src="${item.url}" alt="" />`);
    li.querySelector('.rm').addEventListener('click', (e) => {
      e.stopPropagation();
      state.files = state.files.filter((f) => f.id !== item.id);
      renderThumbs();
    });
    addDragHandlers(li);
    ul.appendChild(li);
  });
  $('orderHint').hidden = state.files.length < 2;
  $('generate').disabled = state.files.length === 0;
}

// Réordonnancement par glisser-déposer des vignettes.
let dragId = null;
function addDragHandlers(li) {
  li.addEventListener('dragstart', () => { dragId = li.dataset.id; li.classList.add('dragging'); });
  li.addEventListener('dragend', () => { dragId = null; li.classList.remove('dragging'); });
  li.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!dragId || dragId === li.dataset.id) return;
    const from = state.files.findIndex((f) => f.id === dragId);
    const to = state.files.findIndex((f) => f.id === li.dataset.id);
    const [moved] = state.files.splice(from, 1);
    state.files.splice(to, 0, moved);
    renderThumbs();
  });
}

// --- Dropzone -------------------------------------------------------------
const dz = $('dropzone');
dz.addEventListener('click', () => $('fileInput').click());
$('fileInput').addEventListener('change', (e) => addFiles(e.target.files));
['dragenter', 'dragover'].forEach((ev) =>
  dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drag'); }));
['dragleave', 'drop'].forEach((ev) =>
  dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('drag'); }));
dz.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));

// --- Erreurs --------------------------------------------------------------
function showError(msg) {
  const el = $('error');
  el.textContent = msg;
  el.hidden = false;
}
function clearError() { $('error').hidden = true; }

// --- Génération -----------------------------------------------------------
$('generate').addEventListener('click', async () => {
  clearError();
  if (state.files.length === 0) return;

  const fd = new FormData();
  state.files.forEach((f) => fd.append('photos', f.file, f.file.name));
  const music = $('music').files[0];
  if (music) fd.append('music', music, music.name);

  if ($('template').value) fd.append('template', $('template').value);
  if ($('format').value) fd.append('format', $('format').value);
  if ($('duration').value) fd.append('duration', $('duration').value);
  if ($('transition').value) fd.append('transition', $('transition').value);
  if ($('title').value.trim()) fd.append('title', $('title').value.trim());
  if ($('cta').value.trim()) fd.append('cta', $('cta').value.trim());
  fd.append('titleColor', $('titleColor').value);
  fd.append('kenburns', $('kenburns').checked ? 'true' : 'false');

  const caps = $('captions').value.split('\n').map((s) => s.trim()).filter(Boolean);
  if (caps.length) fd.append('captions', JSON.stringify(caps));

  if (state.config?.aiEnabled && $('ai').checked) {
    fd.append('ai', 'true');
    if ($('aiPrompt').value.trim()) fd.append('aiPrompt', $('aiPrompt').value.trim());
  }

  $('generate').disabled = true;
  $('result').hidden = true;
  $('progress').hidden = false;
  setProgress(2, 'Envoi des photos…');

  try {
    const res = await fetch('api/render', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Échec du lancement du rendu.');
    pollJob(data.jobId);
  } catch (err) {
    $('progress').hidden = true;
    $('generate').disabled = false;
    showError(err.message);
  }
});

function setProgress(pct, text) {
  $('barFill').style.width = `${pct}%`;
  $('progressText').textContent = text;
}

async function pollJob(jobId) {
  try {
    const res = await fetch(`api/jobs/${jobId}`);
    const job = await res.json();
    if (!res.ok) throw new Error(job.error || 'Job introuvable.');

    if (job.status === 'queued') {
      setProgress(3, job.queuePosition > 0 ? `En file d'attente (position ${job.queuePosition + 1})…` : 'En attente…');
    } else if (job.status === 'rendering') {
      setProgress(Math.max(5, job.progress), `Rendu en cours… ${job.progress}%`);
    } else if (job.status === 'done') {
      setProgress(100, 'Terminé !');
      showResult(jobId, job.result);
      return;
    } else if (job.status === 'error') {
      throw new Error(job.error || 'Erreur pendant le rendu.');
    }
    setTimeout(() => pollJob(jobId), 1200);
  } catch (err) {
    $('progress').hidden = true;
    $('generate').disabled = false;
    showError(err.message);
  }
}

function showResult(jobId, result) {
  const url = `api/jobs/${jobId}/download`;
  $('preview').src = url;
  $('download').href = url;
  if (result) {
    $('resultMeta').textContent =
      `${result.width}×${result.height} · ${result.total.toFixed(1)} s · ${result.segments} plan(s)`;
  }
  $('progress').hidden = true;
  $('result').hidden = false;
  $('generate').disabled = false;
}

loadConfig().catch((e) => showError('Impossible de charger la configuration : ' + e.message));
