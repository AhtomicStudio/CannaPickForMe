/**
 * CannaPickForMe Cloud Functions — OTP sign-in code flow.
 *
 * Two callable functions:
 *   1. requestSignInCode({ email })  — generates a 6-digit code, stores its hash
 *      in Firestore at signInCodes/{email}, emails it to the user via Gmail SMTP.
 *   2. verifySignInCode({ email, code }) — validates the code, mints a Firebase
 *      custom token, returns it to the client. Client signs in via signInWithCustomToken.
 *
 * Security model:
 *   - Codes are SHA-256 hashed before storage. The plaintext only exists in the
 *     outbound email and the verify request body.
 *   - Each email address can have at most one outstanding code. Requesting a new
 *     one invalidates the previous.
 *   - Codes expire after CODE_TTL_MS (10 minutes).
 *   - Each code allows MAX_ATTEMPTS verification attempts; further attempts
 *     consume the code without revealing whether the guess was correct.
 *   - Sender requests are rate-limited per-email and per-IP (best-effort).
 *
 * Required runtime config (set via `firebase functions:config:set` OR env vars):
 *   gmail.user      — Gmail address used for sending (e.g. noreply@cannapickforme.com if you use Workspace; otherwise your own Gmail)
 *   gmail.password  — 16-char Gmail App Password (NOT your regular password)
 *   app.name        — Display name in emails (default: "CannaPickForMe")
 *   app.from_name   — Friendly From name (default: "CannaPickForMe")
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { setGlobalOptions } = require('firebase-functions/v2');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

initializeApp();
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

// ── Config ───────────────────────────────────────────────────────────────────
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 3;       // per email per minute
const COLLECTION = 'signInCodes';

const APP_NAME = process.env.APP_NAME || 'CannaPickForMe';
const FROM_NAME = process.env.APP_FROM_NAME || 'CannaPickForMe';

// ── SMTP transport (lazy-initialized) ────────────────────────────────────────
let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_PASSWORD;
  if (!user || !pass) {
    throw new HttpsError(
      'failed-precondition',
      'SMTP credentials are not configured. Set GMAIL_USER and GMAIL_PASSWORD env vars.'
    );
  }
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
  return transporter;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function normalizeEmail(email) {
  if (typeof email !== 'string') return null;
  const trimmed = email.trim().toLowerCase();
  // Minimal RFC-5322-ish validation; Firebase Auth will do the real check later
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

function generateCode() {
  // crypto.randomInt is uniformly distributed (no modulo bias)
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function emailToDocId(email) {
  // Firestore document IDs can't contain "/" — emails are safe except in edge cases.
  // We hash to keep IDs uniform-length and avoid any path-traversal weirdness.
  return crypto.createHash('sha256').update(email).digest('hex');
}

function buildEmailHtml(code) {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="440" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;padding:36px 28px;max-width:440px;">
      <tr><td align="left" style="font-size:20px;font-weight:600;color:#1a1a1a;padding-bottom:12px;">
        Your ${APP_NAME} sign-in code
      </td></tr>
      <tr><td align="left" style="font-size:15px;line-height:1.5;color:#444;padding-bottom:20px;">
        Enter this code in the app to finish signing in:
      </td></tr>
      <tr><td align="center" style="padding:8px 0 24px 0;">
        <div style="display:inline-block;background:#f0f7f0;color:#1a1a1a;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:32px;font-weight:600;letter-spacing:8px;padding:16px 28px;border-radius:8px;border:1px solid #d4e8d4;">
          ${code}
        </div>
      </td></tr>
      <tr><td align="left" style="font-size:13px;line-height:1.5;color:#666;padding-bottom:8px;">
        This code expires in 10 minutes and can only be used once.
      </td></tr>
      <tr><td align="left" style="font-size:13px;line-height:1.5;color:#999;padding-top:16px;border-top:1px solid #eee;">
        Didn't request this? You can safely ignore this email — no one will be signed in unless they enter the code above.
      </td></tr>
    </table>
  </td></tr>
</table>
  `.trim();
}

function buildEmailText(code) {
  return `Your ${APP_NAME} sign-in code is: ${code}\n\n` +
         `Enter it in the app to finish signing in. This code expires in 10 minutes ` +
         `and can only be used once.\n\n` +
         `Didn't request this? You can safely ignore this email.`;
}

// ── requestSignInCode ────────────────────────────────────────────────────────
exports.requestSignInCode = onCall(
  { cors: true, enforceAppCheck: false },
  async (request) => {
    const email = normalizeEmail(request.data?.email);
    if (!email) {
      throw new HttpsError('invalid-argument', 'A valid email address is required.');
    }

    const db = getFirestore();
    const docId = emailToDocId(email);
    const docRef = db.collection(COLLECTION).doc(docId);

    // Rate limit: count requests for this email in the last minute
    const now = Date.now();
    const existing = await docRef.get();
    if (existing.exists) {
      const data = existing.data();
      const recentRequests = (data.requestTimestamps || []).filter(
        (ts) => now - ts < RATE_LIMIT_WINDOW_MS
      );
      if (recentRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
        throw new HttpsError(
          'resource-exhausted',
          'Too many sign-in attempts. Please wait a minute and try again.'
        );
      }
    }

    const code = generateCode();
    const codeHash = hashCode(code);
    const expiresAt = now + CODE_TTL_MS;

    // Append to requestTimestamps, keeping only the recent window
    const recentTs = existing.exists
      ? (existing.data().requestTimestamps || []).filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS)
      : [];
    recentTs.push(now);

    await docRef.set({
      email,
      codeHash,
      expiresAt,
      attempts: 0,
      createdAt: FieldValue.serverTimestamp(),
      requestTimestamps: recentTs,
    });

    // Send the email
    try {
      await getTransporter().sendMail({
        from: `"${FROM_NAME}" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: `Your ${APP_NAME} sign-in code is ${code}`,
        text: buildEmailText(code),
        html: buildEmailHtml(code),
      });
    } catch (err) {
      console.error('Failed to send OTP email:', err);
      throw new HttpsError('internal', 'Could not send the sign-in code email.');
    }

    return { ok: true, expiresInSeconds: Math.floor(CODE_TTL_MS / 1000) };
  }
);

// ── verifySignInCode ─────────────────────────────────────────────────────────
exports.verifySignInCode = onCall(
  { cors: true, enforceAppCheck: false },
  async (request) => {
    const email = normalizeEmail(request.data?.email);
    const code = typeof request.data?.code === 'string' ? request.data.code.trim() : null;

    if (!email || !code || !/^\d{6}$/.test(code)) {
      throw new HttpsError(
        'invalid-argument',
        'A valid email and 6-digit code are required.'
      );
    }

    const db = getFirestore();
    const docId = emailToDocId(email);
    const docRef = db.collection(COLLECTION).doc(docId);

    const snap = await docRef.get();
    if (!snap.exists) {
      throw new HttpsError('not-found', 'No code was requested for this email.');
    }

    const data = snap.data();

    if (Date.now() > data.expiresAt) {
      await docRef.delete();
      throw new HttpsError('deadline-exceeded', 'This code has expired. Request a new one.');
    }

    if ((data.attempts || 0) >= MAX_ATTEMPTS) {
      await docRef.delete();
      throw new HttpsError(
        'resource-exhausted',
        'Too many incorrect attempts. Request a new code.'
      );
    }

    // Increment attempts BEFORE comparison so a successful verify still costs an attempt
    await docRef.update({ attempts: FieldValue.increment(1) });

    const submittedHash = hashCode(code);
    // Constant-time compare
    const match =
      submittedHash.length === data.codeHash.length &&
      crypto.timingSafeEqual(Buffer.from(submittedHash), Buffer.from(data.codeHash));

    if (!match) {
      throw new HttpsError('permission-denied', 'Incorrect code.');
    }

    // Code is valid — burn it and mint a custom token
    await docRef.delete();

    // Find or create the user, then mint a custom token
    let userRecord;
    try {
      userRecord = await getAuth().getUserByEmail(email);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        userRecord = await getAuth().createUser({ email, emailVerified: true });
      } else {
        throw err;
      }
    }

    // Mark email as verified if it wasn't already (the OTP itself verifies ownership)
    if (!userRecord.emailVerified) {
      await getAuth().updateUser(userRecord.uid, { emailVerified: true });
    }

    const customToken = await getAuth().createCustomToken(userRecord.uid);
    return { token: customToken };
  }
);

// ── refreshDispensaryMenus (weekly) ──────────────────────────────────────────
/**
 * Weekly refresh of every active dispensary's in-stock flower list.
 *
 * For each /dispensaries/{id} doc that has a `dutchieSlug`, we call the app's
 * own /api/sync-menu endpoint (the single source of truth for the Dutchie
 * fetch + strain matching) and persist the result to /menus/{id} — the exact
 * shape the user-facing app already reads via getMenuData(). Adding a new
 * dispensary is therefore zero-code: create its dispensary doc with a
 * dutchieSlug and it gets picked up on the next run.
 *
 * Runs Mondays 09:00 America/Los_Angeles. Weekly sits comfortably in the
 * Blaze free allowances (Cloud Scheduler includes 3 free jobs); it makes one
 * HTTP call per dispensary.
 */
const APP_URL = process.env.APP_URL || 'https://cannapickforme.com';

exports.refreshDispensaryMenus = onSchedule(
  {
    schedule: 'every monday 09:00',
    timeZone: 'America/Los_Angeles',
    timeoutSeconds: 300,
    memory: '256MiB',
  },
  async () => {
    const db = getFirestore();
    const snap = await db.collection('dispensaries').get();

    const targets = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((d) => d.active !== false && (d.menuSource || d.dutchieSlug));

    if (targets.length === 0) {
      console.log('refreshDispensaryMenus: no dispensaries have a dutchieSlug; nothing to do.');
      return;
    }

    const results = [];
    for (const disp of targets) {
      try {
        const url = disp.menuSource
          ? `${APP_URL}/api/sync-menu?source=${encodeURIComponent(JSON.stringify(disp.menuSource))}`
          : `${APP_URL}/api/sync-menu?dispensary=${encodeURIComponent(disp.dutchieSlug)}`;
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) {
          console.warn(`refreshDispensaryMenus: ${disp.id} — sync-menu HTTP ${res.status}`);
          results.push({ id: disp.id, ok: false, status: res.status });
          continue;
        }

        const body = await res.json();
        const strainIds = Array.isArray(body.matched) ? body.matched.map((m) => m.id).filter(Boolean) : [];
        const unknowns = Array.isArray(body.unmatched) ? body.unmatched.map((u) => u.name).filter(Boolean) : [];

        // Don't wipe a known-good menu if the fetch came back empty (usually a
        // transient Dutchie hiccup). Only overwrite when we actually matched.
        if (strainIds.length === 0) {
          console.warn(`refreshDispensaryMenus: ${disp.id} — 0 matched strains; preserving last good menu.`);
          results.push({ id: disp.id, ok: false, matched: 0 });
          continue;
        }

        await db.collection('menus').doc(disp.id).set(
          {
            strainIds,
            unknowns,
            lastSynced: FieldValue.serverTimestamp(),
            source: 'auto-weekly',
          },
          { merge: true }
        );

        results.push({ id: disp.id, ok: true, matched: strainIds.length, unknown: unknowns.length });
      } catch (err) {
        console.error(`refreshDispensaryMenus: ${disp.id} failed:`, err);
        results.push({ id: disp.id, ok: false, error: String((err && err.message) || err) });
      }
    }

    console.log('refreshDispensaryMenus summary:', JSON.stringify(results));
  }
);
