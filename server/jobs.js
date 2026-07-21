// Gestion des jobs de rendu : file d'attente à concurrence limitée + suivi d'état.
// En mémoire (suffisant pour un usage interne). Chaque job a son dossier temp.

import { rmSync } from 'node:fs';

export const JobStatus = {
  QUEUED: 'queued',
  RENDERING: 'rendering',
  DONE: 'done',
  ERROR: 'error',
};

export class JobManager {
  constructor({ concurrency = 1, ttlMs = 60 * 60 * 1000 } = {}) {
    this.jobs = new Map();
    this.queue = [];
    this.active = 0;
    this.concurrency = concurrency;
    this.ttlMs = ttlMs;
    this._seq = 0;
    // Nettoyage périodique des jobs expirés.
    this._timer = setInterval(() => this.sweep(), 5 * 60 * 1000);
    if (this._timer.unref) this._timer.unref();
  }

  create(meta) {
    const id = `${Date.now().toString(36)}-${(++this._seq).toString(36)}`;
    const job = {
      id,
      status: JobStatus.QUEUED,
      progress: 0,
      createdAt: Date.now(),
      error: null,
      outputPath: null,
      result: null,
      ...meta,
    };
    this.jobs.set(id, job);
    return job;
  }

  get(id) {
    return this.jobs.get(id);
  }

  // Enfile un job avec sa fonction de rendu async `run(job)`.
  enqueue(job, run) {
    this.queue.push({ job, run });
    this._pump();
  }

  _pump() {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const { job, run } = this.queue.shift();
      this.active++;
      job.status = JobStatus.RENDERING;
      Promise.resolve()
        .then(() => run(job))
        .then(() => {
          job.status = JobStatus.DONE;
          job.progress = 100;
        })
        .catch((err) => {
          job.status = JobStatus.ERROR;
          job.error = err?.message || String(err);
        })
        .finally(() => {
          this.active--;
          if (job.uploadDir) {
            try { rmSync(job.uploadDir, { recursive: true, force: true }); } catch { /* ignore */ }
          }
          this._pump();
        });
    }
  }

  // Position dans la file (0 = en cours de traitement imminent).
  queuePosition(id) {
    return this.queue.findIndex((q) => q.job.id === id);
  }

  sweep() {
    const now = Date.now();
    for (const [id, job] of this.jobs) {
      if (now - job.createdAt > this.ttlMs) {
        if (job.workDir) {
          try { rmSync(job.workDir, { recursive: true, force: true }); } catch { /* ignore */ }
        }
        this.jobs.delete(id);
      }
    }
  }
}
