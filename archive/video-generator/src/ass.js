// Génération d'un fichier de sous-titres ASS (Advanced SubStation Alpha) rendu
// par le filtre libass de ffmpeg (`subtitles`). Plus portable que `drawtext`
// (qui exige un build ffmpeg avec libfreetype) et offre une belle typographie.

// #RRGGBB -> &H00BBGGRR& (ASS : alpha, bleu, vert, rouge ; alpha 00 = opaque).
function hexToAss(hex) {
  const h = String(hex).replace('#', '').trim();
  if (h.length !== 6) return '&H00FFFFFF&';
  const r = h.slice(0, 2);
  const g = h.slice(2, 4);
  const b = h.slice(4, 6);
  return `&H00${b}${g}${r}`.toUpperCase();
}

function assTime(seconds) {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const cs = Math.round((s - Math.floor(s)) * 100);
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  return `${h}:${pad(m)}:${pad(sec)}.${pad(cs)}`;
}

// Échappe les caractères spéciaux ASS dans le texte.
function escapeText(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\r?\n/g, '\\N');
}

// Construit le contenu d'un fichier .ass.
//
// options : { width, height, font, fontSize, titleColor, titleOutline }
// events  : [{ text, start, end, align?, marginV?, fontSize?, fade? }]
//   align : 2 = bas centre, 5 = milieu centre, 8 = haut centre (numpad ASS).
export function buildAss(options, events) {
  const {
    width,
    height,
    font = 'Sans',
    fontSize = 64,
    titleColor = '#FFFFFF',
    titleOutline = '#000000',
  } = options;

  // fontSize est calibré pour 1080p ; on met à l'échelle sur la hauteur réelle.
  const scaled = Math.round((fontSize * height) / 1080);

  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    // Style principal : contour marqué + ombre pour rester lisible sur photo.
    `Style: Default,${font},${scaled},${hexToAss(titleColor)},${hexToAss(titleColor)},${hexToAss(titleOutline)},&H64000000,1,0,0,0,100,100,0,0,1,${Math.max(2, Math.round(scaled / 18))},2,5,60,60,60,1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];

  const lines = events.map((ev) => {
    const align = ev.align ?? 5;
    const marginV = ev.marginV ?? 60;
    const fs = ev.fontSize ? Math.round((ev.fontSize * height) / 1080) : null;
    const fadeMs = ev.fade ?? 300;
    const overrides =
      `{\\an${align}` +
      (fs ? `\\fs${fs}` : '') +
      `\\fad(${fadeMs},${fadeMs})}`;
    return `Dialogue: 0,${assTime(ev.start)},${assTime(ev.end)},Default,,0,0,${marginV},,${overrides}${escapeText(ev.text)}`;
  });

  return header.concat(lines).join('\n') + '\n';
}
