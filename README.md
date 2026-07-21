# 🎬 Générateur de vidéos publicitaires

Transforme un simple **dossier de photos** en **vidéo publicitaire prête à
publier** (MP4) — verticale pour Reels/TikTok/Shorts, carrée pour le feed, ou
paysage pour YouTube/site web.

Deux modes, combinables :

1. **Montage local (ffmpeg)** — 100 % gratuit, hors-ligne, déterministe :
   diaporama animé avec effet **Ken Burns** (zoom/pano lent), **transitions**,
   **titres / légendes / call-to-action**, et **musique** de fond.
2. **IA image → vidéo (option)** — anime réellement chaque photo (mouvement
   généré) via un modèle externe (Replicate). Nécessite une clé API et un budget.

> ℹ️ Ce projet est un **outil de production vidéo**. Il n'invente pas d'images :
> il met en mouvement et monte **tes** photos. Le mouvement « IA » (mode 2) est
> délégué à un service externe que tu configures.

---

## 🚀 Démarrage rapide

### 1. Prérequis

- **Node.js ≥ 18** (`node --version`)
- **ffmpeg** avec **libx264** et **libass** (pour les textes).
  - macOS : `brew install ffmpeg`
  - Debian/Ubuntu : `sudo apt install ffmpeg`
  - Windows : [gyan.dev](https://www.gyan.dev/ffmpeg/builds/) (build « full »)

  L'outil détecte ffmpeg automatiquement (PATH, variable `FFMPEG_BIN`, ou option
  `--ffmpeg <chemin>`).

### 2. Génère ta première pub

```bash
# 1. Mets tes photos dans le dossier photos/ (numérote-les pour l'ordre)
# 2. Lance :
node bin/generate-ad.js photos \
  --template promo \
  --title "Soldes -50%" \
  --cta "Commande maintenant" \
  --music music/track.mp3 \
  --output output/ma-pub.mp4
```

La vidéo apparaît dans `output/`.

---

## 🧰 Utilisation

```
generate-ad <dossier-photos> [options]
```

| Option | Description |
| --- | --- |
| `-o, --output <fichier>` | MP4 de sortie (défaut : `output/ad-<horodatage>.mp4`) |
| `-t, --template <nom>` | Style prêt à l'emploi (`--list-templates`) |
| `-f, --format <ratio>` | `9:16`, `16:9`, `1:1`, `4:5` |
| `-d, --duration <sec>` | Durée par photo |
| `--transition <nom>` | `fade`, `dissolve`, `slideleft`, `wiperight`, ... |
| `--transition-duration <s>` | Durée de la transition |
| `--kenburns <on\|off>` | Active/désactive le zoom/pano |
| `-m, --music <fichier>` | Musique de fond (bouclée puis coupée) |
| `--music-volume <0-1>` | Volume de la musique |
| `--title <texte>` | Titre au début |
| `--cta <texte>` | Call-to-action à la fin |
| `--captions <fichier.json>` | Légendes par photo (voir `examples/`) |
| `--font <nom>` | Police (`Sans`, `Serif`, ...) |
| `--title-color <#hex>` | Couleur du texte |
| `--crf <n>` | Qualité H.264 (18 = haute, 28 = basse ; défaut 20) |
| `--ai` | Anime les photos via IA (mode hybride) |
| `--ai-provider <nom>` | Provider IA (`replicate`) |
| `--ai-model <owner/name>` | Modèle IA image→vidéo |
| `--ai-prompt <texte>` | Prompt de mouvement pour l'IA |
| `-v, --verbose` | Sortie ffmpeg complète |
| `-h, --help` | Aide |

### Templates fournis

| Template | Usage |
| --- | --- |
| `promo` | Pub dynamique et rythmée (soldes, promo produit), vertical |
| `story` | Story verticale plein écran (Instagram/TikTok/Shorts) |
| `elegant` | Haut de gamme, fondus doux (immobilier, mode, resto), paysage |
| `square` | Carré pour le feed Instagram/Facebook |

Les réglages se cumulent ainsi : **valeurs par défaut → template → options CLI**
(l'option CLI a toujours le dernier mot).

### Légendes par photo

Crée un fichier JSON (voir `examples/captions.example.json`) :

```json
[
  { "text": "Notre nouvelle collection", "slide": 0 },
  { "text": "Fabriqué à la main", "slide": 1 },
  "Livraison offerte"
]
```

Puis : `--captions mes-legendes.json`. Le champ `slide` (index de la photo,
commençant à 0) est optionnel ; sans lui, la légende suit l'ordre du tableau.

---

## 🤖 Mode IA (image → vidéo)

Le mode `--ai` remplace chaque photo par un **clip animé** généré par un modèle
externe, puis assemble ces clips avec les mêmes transitions/musique/textes.

Actuellement supporté : **[Replicate](https://replicate.com)**.

```bash
export REPLICATE_API_TOKEN="r8_..."           # obligatoire
# (optionnel) choisir le modèle et ses entrées :
export REPLICATE_MODEL="wan-video/wan-2.2-i2v-fast"
export REPLICATE_IMAGE_FIELD="image"          # nom du champ image du modèle
export REPLICATE_EXTRA_INPUT='{"num_frames":81}'

node bin/generate-ad.js photos \
  --ai \
  --ai-prompt "léger mouvement de caméra cinématique" \
  --template story \
  --output output/pub-ia.mp4
```

> ⚠️ **Coût & réseau** : chaque photo animée = un appel payant au service. Les
> noms de modèles et de champs d'entrée évoluent souvent côté Replicate — d'où
> leur configuration par variables d'environnement. Consulte la page du modèle
> choisi pour les bons champs (`REPLICATE_IMAGE_FIELD`, `REPLICATE_EXTRA_INPUT`).

Ajouter un autre provider (Runway, Pika, fal.ai, Veo...) = un fichier dans
`src/ai/` exposant `animate(imagePath, outPath, opts)`, référencé dans
`src/ai/index.js`.

---

## 🗂️ Structure du projet

```
bin/generate-ad.js     Point d'entrée CLI
src/
  cli.js               Parsing des arguments, orchestration
  config.js            Formats de sortie, valeurs par défaut, transitions
  templates.js         Chargement/fusion des templates
  segments.js          Collecte + tri naturel des médias d'entrée
  ffmpeg.js            Détection du binaire ffmpeg + exécution
  slideshow.js         Construction du filter_complex (Ken Burns, xfade, audio)
  ass.js               Génération des sous-titres ASS (textes via libass)
  ai/
    index.js           Dispatcher des providers IA
    replicate.js       Provider Replicate (image → vidéo)
templates/*.json       Styles de pub prêts à l'emploi
photos/                Tes photos d'entrée (non versionnées)
music/                 Tes musiques (non versionnées)
output/                Vidéos générées (non versionnées)
examples/              Exemples (légendes...)
```

Aucune dépendance npm : tout repose sur Node et ffmpeg.

---

## 🔧 Dépannage

- **« ffmpeg est introuvable »** → installe ffmpeg, ou `export FFMPEG_BIN=/chemin/ffmpeg`, ou `--ffmpeg /chemin`.
- **Les textes n'apparaissent pas** → ton build ffmpeg n'a pas **libass**. Installe un build complet (voir prérequis).
- **Photo mal cadrée** → elle est recadrée pour remplir le format ; garde le sujet centré, ou change de `--format`.
- **Rendu lent** → baisse la qualité avec `--preset veryfast` ou `--crf 24`.

## Licence

MIT.
