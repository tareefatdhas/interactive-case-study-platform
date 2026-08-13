import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const kit = path.join(root, 'media-kit');
const landscapeArt = path.join(kit, 'source/classfully-response-field-master.png');
const verticalArt = path.join(kit, 'source/classfully-response-field-vertical.png');

const colors = {
  paper: '#FFFEFA',
  ink: '#101A38',
  violet: '#5146E5',
  coral: '#DF664E',
  muted: '#697087',
  line: '#E3E5ED',
};

const markPaths = `
  <defs>
    <mask id="path-cut"><rect width="64" height="64" fill="white"/><path d="M17 36.5 28.5 48 51 20.5" fill="none" stroke="black" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round" transform="translate(-2.56 0) scale(1.08 1)"/></mask>
  </defs>
  <g mask="url(#path-cut)" transform="translate(-2.56 0) scale(1.08 1)">
    <path fill="${colors.ink}" d="M8 13.5A9.5 9.5 0 0 1 17.5 4h27A9.5 9.5 0 0 1 54 13.5v14A9.5 9.5 0 0 1 44.5 37H25L13.5 47v-10.7A9.5 9.5 0 0 1 8 27.5v-14Z"/>
    <path fill="${colors.violet}" d="M25 23.5h22.5A8.5 8.5 0 0 1 56 32v17.5a9.5 9.5 0 0 1-9.5 9.5H30a9 9 0 0 1-9-9V27.5a4 4 0 0 1 4-4Z"/>
  </g>
  <circle cx="53" cy="15" r="5.5" fill="${colors.coral}"/>`;

const mark = (size = 64, x = 0, y = 0) => `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 64 64">${markPaths}</svg>`;

function svgDocument(width, height, body, background = null) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${background ? `<rect width="100%" height="100%" fill="${background}"/>` : ''}${body}</svg>`;
}

function wordmark({ x, y, markSize, textSize, color = colors.ink }) {
  const textX = x + markSize + Math.round(markSize * 0.35);
  const baseline = y + Math.round(markSize * 0.76);
  return `${mark(markSize, x, y)}<text x="${textX}" y="${baseline}" fill="${color}" font-family="Georgia, 'Times New Roman', serif" font-size="${textSize}" font-weight="600" letter-spacing="-${Math.max(1, textSize * 0.025)}">Classfully<tspan fill="${colors.coral}">.</tspan></text>`;
}

function copyBlock({ x, y, width, headlineSize, bodySize, includeEyebrow = true }) {
  const eyebrow = includeEyebrow ? `<text x="${x}" y="${y}" fill="${colors.violet}" font-family="Arial, sans-serif" font-size="${Math.round(bodySize * 0.58)}" font-weight="700" letter-spacing="${Math.round(bodySize * 0.1)}">THE INTERACTIVE LAYER FOR UNIVERSITY COURSES</text>` : '';
  const headlineY = y + (includeEyebrow ? headlineSize * 0.92 : 0);
  return `${eyebrow}<text x="${x}" y="${headlineY}" fill="${colors.ink}" font-family="Georgia, 'Times New Roman', serif" font-size="${headlineSize}" font-weight="500" letter-spacing="-${headlineSize * 0.028}"><tspan x="${x}" dy="0">Make the classroom interactive.</tspan><tspan x="${x}" dy="${headlineSize * 1.05}" fill="${colors.violet}">Build every student's journey.</tspan></text><text x="${x}" y="${headlineY + headlineSize * 2.6}" fill="${colors.muted}" font-family="Arial, sans-serif" font-size="${bodySize}">Live interaction, participation, and progress across the whole course.</text>`;
}

async function writeSvg(relativePath, svg) {
  const target = path.join(kit, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, svg);
  return target;
}

async function renderSvg(svg, relativePath, width, height) {
  const target = path.join(kit, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await sharp(Buffer.from(svg), { density: 300 }).resize(width, height, { fit: 'fill' }).png({ quality: 100, compressionLevel: 9 }).toFile(target);
  return target;
}

async function renderComposition({ relativePath, width, height, art = landscapeArt, artPosition = 'center', overlay }) {
  const target = path.join(kit, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await sharp(art)
    .resize(width, height, { fit: 'cover', position: artPosition, kernel: sharp.kernel.lanczos3 })
    .composite([{ input: Buffer.from(svgDocument(width, height, overlay)) }])
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(target);
  return target;
}

async function buildLogos() {
  const markSvg = svgDocument(64, 64, markPaths);
  const appIconSvg = svgDocument(1024, 1024, `<rect x="32" y="32" width="960" height="960" rx="218" fill="${colors.paper}"/>${mark(720, 152, 152)}`);
  const lockupSvg = svgDocument(780, 180, wordmark({ x: 24, y: 26, markSize: 128, textSize: 94 }));
  const reverseSvg = svgDocument(780, 180, wordmark({ x: 24, y: 26, markSize: 128, textSize: 94, color: colors.paper }), colors.ink);

  await writeSvg('logos/classfully-mark-color.svg', markSvg);
  await writeSvg('logos/classfully-app-icon.svg', appIconSvg);
  await writeSvg('logos/classfully-lockup-color.svg', lockupSvg);
  await writeSvg('logos/classfully-lockup-reversed.svg', reverseSvg);
  await renderSvg(markSvg, 'logos/classfully-mark-color-2048.png', 2048, 2048);
  await renderSvg(appIconSvg, 'logos/classfully-app-icon-1024.png', 1024, 1024);
  await renderSvg(appIconSvg, 'logos/classfully-profile-400.png', 400, 400);
  await renderSvg(appIconSvg, 'logos/classfully-google-play-icon-512.png', 512, 512);
  await sharp(path.join(kit, 'logos/classfully-app-icon-1024.png')).flatten({ background: colors.paper }).png({ quality: 100, compressionLevel: 9 }).toFile(path.join(kit, 'logos/classfully-apple-app-icon-1024.png'));
  await renderSvg(lockupSvg, 'logos/classfully-lockup-color-2400.png', 2400, 554);
  await renderSvg(reverseSvg, 'logos/classfully-lockup-reversed-2400.png', 2400, 554);
}

async function buildLandscapeAssets() {
  const assets = [
    { relativePath: 'banners/classfully-master-16x9-3840x2160.png', width: 3840, height: 2160, x: 250, logoY: 180, markSize: 128, textSize: 94, copyY: 720, headline: 178, body: 48, position: 'right' },
    { relativePath: 'banners/classfully-linkedin-cover-4200x700.png', width: 4200, height: 700, x: 240, logoY: 130, markSize: 96, textSize: 72, copyY: 390, headline: 84, body: 30, position: 'right' },
    { relativePath: 'banners/classfully-x-header-1500x500.png', width: 1500, height: 500, x: 130, logoY: 70, markSize: 74, textSize: 54, copyY: 285, headline: 54, body: 20, position: 'right' },
    { relativePath: 'banners/classfully-youtube-channel-2560x1440.png', width: 2560, height: 1440, x: 700, logoY: 590, markSize: 82, textSize: 60, copyY: 810, headline: 58, body: 0, position: 'right', youtube: true },
    { relativePath: 'social/classfully-open-graph-1200x630.png', width: 1200, height: 630, x: 72, logoY: 54, markSize: 66, textSize: 48, copyY: 310, headline: 58, body: 20, position: 'right' },
    { relativePath: 'store/classfully-google-play-feature-1024x500.png', width: 1024, height: 500, x: 58, logoY: 44, markSize: 58, textSize: 42, copyY: 245, headline: 48, body: 18, position: 'right' },
    { relativePath: 'store/classfully-listing-gallery-1600x900.png', width: 1600, height: 900, x: 110, logoY: 82, markSize: 82, textSize: 60, copyY: 405, headline: 74, body: 25, position: 'right' },
  ];

  for (const asset of assets) {
    const overlay = asset.youtube
      ? `${wordmark({ x: asset.x, y: asset.logoY, markSize: asset.markSize, textSize: asset.textSize })}<text x="${asset.x}" y="${asset.copyY}" fill="${colors.ink}" font-family="Georgia, 'Times New Roman', serif" font-size="${asset.headline}" font-weight="500" letter-spacing="-${asset.headline * 0.025}">Make the classroom interactive<tspan fill="${colors.coral}">.</tspan></text>`
      : `${wordmark({ x: asset.x, y: asset.logoY, markSize: asset.markSize, textSize: asset.textSize })}${copyBlock({ x: asset.x, y: asset.copyY, width: asset.width * 0.48, headlineSize: asset.headline, bodySize: asset.body, includeEyebrow: asset.width >= 1200 })}`;
    await renderComposition({ relativePath: asset.relativePath, width: asset.width, height: asset.height, artPosition: asset.position, overlay });
  }
}

async function buildSocialAssets() {
  const assets = [
    { relativePath: 'social/classfully-square-2160x2160.png', width: 2160, height: 2160, x: 150, logoY: 150, markSize: 120, textSize: 88, copyY: 720, headline: 116, body: 38 },
    { relativePath: 'social/classfully-portrait-2160x2700.png', width: 2160, height: 2700, x: 150, logoY: 150, markSize: 120, textSize: 88, copyY: 750, headline: 116, body: 38 },
    { relativePath: 'social/classfully-story-2160x3840.png', width: 2160, height: 3840, x: 150, logoY: 180, markSize: 120, textSize: 88, copyY: 860, headline: 124, body: 40 },
  ];
  for (const asset of assets) {
    const overlay = `${wordmark({ x: asset.x, y: asset.logoY, markSize: asset.markSize, textSize: asset.textSize })}${copyBlock({ x: asset.x, y: asset.copyY, width: asset.width - asset.x * 2, headlineSize: asset.headline, bodySize: asset.body })}`;
    await renderComposition({ relativePath: asset.relativePath, width: asset.width, height: asset.height, art: verticalArt, artPosition: 'bottom', overlay });
  }
}

async function buildPreview() {
  const files = [
    'banners/classfully-linkedin-cover-4200x700.png',
    'social/classfully-open-graph-1200x630.png',
    'store/classfully-google-play-feature-1024x500.png',
    'social/classfully-square-2160x2160.png',
    'social/classfully-portrait-2160x2700.png',
    'social/classfully-story-2160x3840.png',
    'logos/classfully-app-icon-1024.png',
  ];
  const thumbs = await Promise.all(files.map(async (file) => {
    const input = path.join(kit, file);
    const image = await sharp(input).resize(640, 420, { fit: 'contain', background: colors.paper }).png().toBuffer();
    return { input: image };
  }));
  const width = 1340;
  const height = Math.ceil(thumbs.length / 2) * 470 + 120;
  const canvas = sharp({ create: { width, height, channels: 4, background: '#F4F3F8' } });
  const composites = thumbs.map((thumb, index) => ({ input: thumb.input, left: index % 2 === 0 ? 20 : 680, top: 80 + Math.floor(index / 2) * 470 }));
  await canvas.composite(composites).png({ quality: 100 }).toFile(path.join(kit, 'preview/classfully-media-kit-contact-sheet.png'));
}

async function buildManifest() {
  const groups = ['logos', 'banners', 'social', 'store'];
  const assets = [];
  for (const group of groups) {
    const directory = path.join(kit, group);
    for (const name of (await fs.readdir(directory)).sort()) {
      const file = path.join(directory, name);
      const stat = await fs.stat(file);
      const asset = { file: path.relative(kit, file), bytes: stat.size };
      if (/\.(png|jpe?g|webp)$/i.test(name)) {
        const metadata = await sharp(file).metadata();
        Object.assign(asset, { width: metadata.width, height: metadata.height, format: metadata.format, alpha: Boolean(metadata.hasAlpha) });
      } else if (name.endsWith('.svg')) {
        Object.assign(asset, { format: 'svg', scalable: true });
      }
      assets.push(asset);
    }
  }
  await fs.writeFile(path.join(kit, 'asset-manifest.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), assets }, null, 2)}\n`);
}

await buildLogos();
await buildLandscapeAssets();
await buildSocialAssets();
await buildPreview();
await buildManifest();
console.log('Classfully media kit built in media-kit/');
