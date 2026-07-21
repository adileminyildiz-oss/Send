// Formats de sortie et valeurs par défaut.

export const FORMATS = {
  '16:9': { width: 1920, height: 1080, label: 'Paysage (YouTube, site web, TV)' },
  '9:16': { width: 1080, height: 1920, label: 'Vertical (Reels, TikTok, Shorts, Stories)' },
  '1:1': { width: 1080, height: 1080, label: 'Carré (feed Instagram/Facebook)' },
  '4:5': { width: 1080, height: 1350, label: 'Portrait (feed Instagram)' },
};

// Extensions d'images acceptées en entrée.
export const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tif', '.tiff', '.heic',
]);

// Extensions vidéo (clips IA ou rushes déjà animés) acceptées en entrée.
export const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.m4v', '.mkv']);

// Réglages par défaut d'un rendu (surchargés par le template puis par les flags CLI).
export const DEFAULTS = {
  format: '9:16',
  fps: 30,
  slideDuration: 3.0, // secondes par photo
  transition: 'fade', // voir XFADE_TRANSITIONS
  transitionDuration: 0.7,
  kenburns: true,
  kenburnsIntensity: 0.12, // zoom max supplémentaire (1.0 -> 1.12)
  music: null,
  musicVolume: 0.8,
  audioFadeOut: 2.0,
  crf: 20, // qualité H.264 (plus bas = meilleure qualité)
  preset: 'medium',
  // Textes
  title: null,
  cta: null, // call-to-action affiché sur le dernier plan
  captions: null, // chemin d'un JSON [{ text, slide? }] ou tableau
  // Style texte (ASS / libass)
  font: 'Sans',
  titleColor: '#FFFFFF',
  titleOutline: '#000000',
  fontSize: 64, // relatif à une hauteur de 1080 ; mis à l'échelle automatiquement
};

// Transitions xfade proposées (sous-ensemble utile et bien supporté).
export const XFADE_TRANSITIONS = new Set([
  'fade', 'fadeblack', 'fadewhite', 'dissolve', 'wipeleft', 'wiperight',
  'wipeup', 'wipedown', 'slideleft', 'slideright', 'slideup', 'slidedown',
  'smoothleft', 'smoothright', 'circleopen', 'circleclose', 'radial', 'none',
]);
