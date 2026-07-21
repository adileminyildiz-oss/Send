// Chargement et fusion des templates de pub.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, isAbsolute, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULTS } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', 'templates');

export function listTemplates() {
  if (!existsSync(TEMPLATES_DIR)) return [];
  return readdirSync(TEMPLATES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        const t = JSON.parse(readFileSync(join(TEMPLATES_DIR, f), 'utf8'));
        return { name: t.name || f.replace(/\.json$/, ''), description: t.description || '' };
      } catch {
        return { name: f.replace(/\.json$/, ''), description: '(illisible)' };
      }
    });
}

// Charge un template par nom (templates/<name>.json) ou par chemin de fichier.
export function loadTemplate(nameOrPath) {
  let file = nameOrPath;
  if (!file.endsWith('.json') && !isAbsolute(file) && !file.includes('/')) {
    file = join(TEMPLATES_DIR, `${nameOrPath}.json`);
  }
  if (!existsSync(file)) {
    const avail = listTemplates().map((t) => t.name).join(', ');
    throw new Error(`Template introuvable : « ${nameOrPath} ». Disponibles : ${avail}`);
  }
  return JSON.parse(readFileSync(file, 'utf8'));
}

// Construit les réglages effectifs : DEFAULTS <- template <- overrides CLI.
export function resolveSettings({ template, overrides = {} }) {
  let base = { ...DEFAULTS };
  if (template) {
    const t = loadTemplate(template);
    delete t.name;
    delete t.description;
    base = { ...base, ...t };
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v !== undefined && v !== null) base[k] = v;
  }
  return base;
}
