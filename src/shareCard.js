import QRCode from 'qrcode';

const APP_URL = 'cannapickforme.com';

const TYPE_PALETTE = {
  sativa:  { outline: '#fb923c', glow: 'rgba(251,146,60,0.35)',  label: '#fb923c', bg: 'rgba(251,146,60,0.08)' },
  hybrid:  { outline: '#4ade80', glow: 'rgba(74,222,128,0.35)',  label: '#4ade80', bg: 'rgba(74,222,128,0.08)'  },
  indica:  { outline: '#a78bfa', glow: 'rgba(167,139,250,0.35)', label: '#a78bfa', bg: 'rgba(167,139,250,0.08)' },
};

const MOOD_LABELS = {
  chill: 'Chill', social: 'Social', creative: 'Creative',
  energetic: 'Energetic', introspective: 'Introspective', romantic: 'Romantic',
};
const VIBE_LABELS = {
  solo: 'Solo Session', friends: 'Kickback', movie: 'Movie Night',
  adventure: 'Adventure', gaming: 'Gaming', datenight: 'Date Night',
};
const INTENSITY_LABELS = { low: 'Low & Mellow', moderate: 'Moderate Cruise', high: 'Sky High' };

// ── Silhouette paths per type ──────────────────────────────────────────────
// Each returns a series of canvas draw calls on ctx, centered at (cx, cy).
// Scale is applied so the figure fits within roughly 220×300 pts.

function drawSativaSilhouette(ctx, cx, cy, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;

  // Tall, upright character — energetic pose, arms up, spiky leaf crown

  // Crown spikes (sativa — tall narrow leaves radiating up)
  const spikes = [
    [-55, -155, -20, -90], [-30, -175, -5, -95], [0, -185, 0, -95],
    [30, -175, 5, -95],  [55, -155, 20, -90],
  ];
  spikes.forEach(([x1,y1,x2,y2]) => {
    ctx.beginPath(); ctx.moveTo(x2,y2); ctx.lineTo(x1,y1); ctx.stroke();
  });

  // Head
  ctx.beginPath();
  ctx.ellipse(0, -65, 28, 32, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Neck
  ctx.beginPath(); ctx.moveTo(-8, -33); ctx.lineTo(-8, -20); ctx.moveTo(8, -33); ctx.lineTo(8, -20); ctx.stroke();

  // Body — torso (slim/tall)
  ctx.beginPath(); ctx.moveTo(-22, -20); ctx.lineTo(-25, 70); ctx.lineTo(25, 70); ctx.lineTo(22, -20); ctx.closePath(); ctx.stroke();

  // Arms raised up (energetic)
  ctx.beginPath(); ctx.moveTo(-22, 0); ctx.quadraticCurveTo(-70, -30, -80, -70); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(22, 0);  ctx.quadraticCurveTo(70, -30, 80, -70);  ctx.stroke();
  // Hands
  ctx.beginPath(); ctx.arc(-80, -73, 7, 0, Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.arc(80, -73, 7, 0, Math.PI*2);  ctx.stroke();

  // Legs — stride pose
  ctx.beginPath(); ctx.moveTo(-10, 70); ctx.lineTo(-22, 140); ctx.lineTo(-14, 140); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(10, 70);  ctx.lineTo(22, 140);  ctx.lineTo(14, 140);  ctx.stroke();

  ctx.restore();
}

function drawHybridSilhouette(ctx, cx, cy, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;

  // Balanced pose — arms out to sides, mixed leaf crown (sativa + indica blend)

  // Crown — alternating leaf fan
  const fan = [
    [-50, -155], [-28, -170], [0, -178], [28, -170], [50, -155],
  ];
  fan.forEach(([x,y]) => {
    ctx.beginPath(); ctx.moveTo(0, -92); ctx.lineTo(x, y); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI*2); ctx.stroke();
  });

  // Head
  ctx.beginPath(); ctx.arc(0, -58, 30, 0, Math.PI*2); ctx.stroke();

  // Body
  ctx.beginPath(); ctx.moveTo(-24, -28); ctx.lineTo(-28, 65); ctx.lineTo(28, 65); ctx.lineTo(24, -28); ctx.closePath(); ctx.stroke();

  // Arms — relaxed out to sides
  ctx.beginPath(); ctx.moveTo(-24, 5); ctx.lineTo(-80, 30); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(24, 5);  ctx.lineTo(80, 30);  ctx.stroke();
  ctx.beginPath(); ctx.arc(-80, 30, 7, 0, Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.arc(80, 30, 7, 0, Math.PI*2);  ctx.stroke();

  // Legs — standing
  ctx.beginPath(); ctx.moveTo(-10, 65); ctx.lineTo(-16, 140); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(10, 65);  ctx.lineTo(16, 140);  ctx.stroke();
  // Feet
  ctx.beginPath(); ctx.moveTo(-16,140); ctx.lineTo(-30,140); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(16,140);  ctx.lineTo(30,140);  ctx.stroke();

  ctx.restore();
}

function drawIndicaSilhouette(ctx, cx, cy, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;

  // Relaxed, slightly slouched — wide rounded crown, arms low, cozy

  // Crown — wide rounded indica leaves (broad, short)
  const leaves = [[-52,-130],[-28,-148],[0,-155],[28,-148],[52,-130]];
  leaves.forEach(([x,y]) => {
    ctx.beginPath();
    ctx.moveTo(0, -85);
    ctx.quadraticCurveTo(x * 0.6, y * 0.7, x, y);
    ctx.stroke();
  });
  // Round crown fill suggestion
  ctx.beginPath();
  ctx.ellipse(0, -130, 52, 28, 0, 0, Math.PI*2);
  ctx.stroke();

  // Head — rounder/wider
  ctx.beginPath(); ctx.ellipse(0, -52, 34, 30, 0, 0, Math.PI*2); ctx.stroke();

  // Body — wider, shorter
  ctx.beginPath(); ctx.moveTo(-30, -22); ctx.lineTo(-35, 58); ctx.lineTo(35, 58); ctx.lineTo(30, -22); ctx.closePath(); ctx.stroke();

  // Arms — hanging down, relaxed
  ctx.beginPath(); ctx.moveTo(-30, 0); ctx.quadraticCurveTo(-68, 30, -65, 60); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(30, 0);  ctx.quadraticCurveTo(68, 30, 65, 60);   ctx.stroke();
  ctx.beginPath(); ctx.arc(-65, 60, 7, 0, Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.arc(65, 60, 7, 0, Math.PI*2);  ctx.stroke();

  // Legs — shorter, wide stance
  ctx.beginPath(); ctx.moveTo(-12, 58); ctx.lineTo(-20, 118); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(12, 58);  ctx.lineTo(20, 118);  ctx.stroke();
  // Feet
  ctx.beginPath(); ctx.moveTo(-20,118); ctx.lineTo(-36,118); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(20,118);  ctx.lineTo(36,118);  ctx.stroke();

  ctx.restore();
}

const SILHOUETTES = { sativa: drawSativaSilhouette, hybrid: drawHybridSilhouette, indica: drawIndicaSilhouette };

// ── QR Code ────────────────────────────────────────────────────────────────

async function drawQR(ctx, url, x, y, size) {
  try {
    const dataUrl = await QRCode.toDataURL(url, {
      width: size, margin: 1,
      color: { dark: '#ffffff', light: '#00000000' },
    });
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
    ctx.drawImage(img, x - size / 2, y, size, size);
  } catch { /* skip QR on error */ }
}

// ── Rounded rect helper ────────────────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ── Main render ────────────────────────────────────────────────────────────

export async function renderShareCard({ strainName, strainType, matchScore, sessionAnswers, strainId }) {
  const W = 600, H = 960;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  const type = (strainType || 'hybrid').toLowerCase();
  const pal = TYPE_PALETTE[type] || TYPE_PALETTE.hybrid;

  // ── Background ─────────────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0,   '#06080f');
  bg.addColorStop(0.5, '#0d1120');
  bg.addColorStop(1,   '#12172e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Ambient glow behind silhouette
  const glow = ctx.createRadialGradient(W/2, 290, 20, W/2, 290, 200);
  glow.addColorStop(0, pal.glow);
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // ── Corner accent lines ────────────────────────────────────────────────
  ctx.strokeStyle = pal.outline;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.4;
  // TL
  ctx.beginPath(); ctx.moveTo(24, 60); ctx.lineTo(24, 24); ctx.lineTo(70, 24); ctx.stroke();
  // TR
  ctx.beginPath(); ctx.moveTo(W-24, 60); ctx.lineTo(W-24, 24); ctx.lineTo(W-70, 24); ctx.stroke();
  // BL
  ctx.beginPath(); ctx.moveTo(24, H-60); ctx.lineTo(24, H-24); ctx.lineTo(70, H-24); ctx.stroke();
  // BR
  ctx.beginPath(); ctx.moveTo(W-24, H-60); ctx.lineTo(W-24, H-24); ctx.lineTo(W-70, H-24); ctx.stroke();
  ctx.globalAlpha = 1;

  // ── App logo / brand ───────────────────────────────────────────────────
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '600 18px "Outfit", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🌿 CannaPickForMe', W/2, 50);

  // ── Silhouette ─────────────────────────────────────────────────────────
  const drawFn = SILHOUETTES[type] || drawHybridSilhouette;
  drawFn(ctx, W/2, 280, pal.outline);

  // ── Divider ────────────────────────────────────────────────────────────
  const div = ctx.createLinearGradient(60, 0, W-60, 0);
  div.addColorStop(0, 'transparent');
  div.addColorStop(0.5, pal.outline);
  div.addColorStop(1, 'transparent');
  ctx.strokeStyle = div;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.moveTo(60, 490); ctx.lineTo(W-60, 490); ctx.stroke();
  ctx.globalAlpha = 1;

  // ── "The universe chose" label ─────────────────────────────────────────
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '400 15px "Outfit", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('YOUR PERFECT MATCH', W/2, 525);

  // ── Strain name ────────────────────────────────────────────────────────
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = pal.outline;
  ctx.shadowBlur = 20;
  const nameFontSize = strainName.length > 16 ? 42 : 52;
  ctx.font = `800 ${nameFontSize}px "Space Grotesk", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(strainName, W/2, 580);
  ctx.shadowBlur = 0;

  // ── Type pill ──────────────────────────────────────────────────────────
  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
  const pillW = 110, pillH = 32, pillX = W/2 - pillW/2, pillY = 598;
  roundRect(ctx, pillX, pillY, pillW, pillH, 16);
  ctx.fillStyle = pal.bg;
  ctx.fill();
  ctx.strokeStyle = pal.outline;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = pal.label;
  ctx.font = '700 14px "Outfit", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(typeLabel, W/2, pillY + 21);

  // ── Match score ────────────────────────────────────────────────────────
  ctx.fillStyle = pal.label;
  ctx.font = `800 64px "Space Grotesk", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.shadowColor = pal.glow;
  ctx.shadowBlur = 24;
  ctx.fillText(`${matchScore}%`, W/2, 710);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '500 16px "Outfit", system-ui, sans-serif';
  ctx.fillText('MATCH', W/2, 732);

  // ── Vibe tags from session answers ────────────────────────────────────
  const tags = [
    MOOD_LABELS[sessionAnswers?.mood],
    INTENSITY_LABELS[sessionAnswers?.intensity],
    VIBE_LABELS[sessionAnswers?.vibe],
  ].filter(Boolean);

  if (tags.length) {
    ctx.font = '500 13px "Outfit", system-ui, sans-serif';
    let tagX = W/2 - (tags.join('  ·  ').length * 3.5);
    ctx.fillStyle = 'rgba(255,255,255,0.40)';
    ctx.fillText(tags.join('  ·  '), W/2, 760);
  }

  // ── CTA line ───────────────────────────────────────────────────────────
  ctx.fillStyle = 'rgba(255,255,255,0.30)';
  ctx.font = '400 14px "Outfit", system-ui, sans-serif';
  ctx.fillText('Find your perfect strain at cannapickforme.com', W/2, 800);

  // ── QR code + URL ──────────────────────────────────────────────────────
  const deepLink = strainId
    ? `https://${APP_URL}/?s=${encodeURIComponent(strainId)}`
    : `https://${APP_URL}`;

  const qrSize = 80;
  await drawQR(ctx, deepLink, W/2, H - qrSize - 48, qrSize);

  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '600 13px "Space Grotesk", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(APP_URL, W/2, H - 26);

  return canvas;
}

// ── Share / Download ───────────────────────────────────────────────────────

export async function shareResult(cardData) {
  const canvas = await renderShareCard(cardData);

  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) { reject(new Error('Canvas export failed')); return; }

      const file = new File([blob], 'my-strain.png', { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `CannaPickForMe picked ${cardData.strainName} for me!`,
            text: `${cardData.matchScore}% match — ${cardData.strainName} is my top pick. Find yours at ${APP_URL}`,
          });
          resolve('shared');
        } catch (err) {
          if (err.name !== 'AbortError') {
            // Fall through to download
            triggerDownload(blob, file.name);
            resolve('downloaded');
          } else {
            resolve('cancelled');
          }
        }
      } else {
        triggerDownload(blob, file.name);
        resolve('downloaded');
      }
    }, 'image/png');
  });
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
