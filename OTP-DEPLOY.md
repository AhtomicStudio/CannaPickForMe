# OTP Sign-In Code — Deployment Guide

This walks you through deploying the 6-digit code fallback flow that was added
alongside the existing Firebase Auth magic-link sign-in.

## What got built

- **`functions/index.js`** — two callable Cloud Functions:
  `requestSignInCode` and `verifySignInCode`. Codes are SHA-256 hashed before
  storage; rate-limited to 3 requests/email/minute; max 5 wrong guesses; 10-minute TTL.
- **Firestore collection `signInCodes`** — locked down in `firestore.rules` so
  clients cannot read or write it. Cloud Functions bypass the rules via Admin SDK.
- **`src/services/userService.js`** — `requestSignInCode` and `verifySignInCode`
  client wrappers that call the functions and finish sign-in via
  `signInWithCustomToken`.
- **`index.html`** — new `account-state-code` modal state with a 6-digit input.
- **`src/main.js`** — handlers for "Get a code instead", code submit, resend, back.
- **`src/style.css`** — `.account-link` and `.account-code-input` styles.

## Prerequisites

### 1. Upgrade Firebase to the Blaze plan (required)

Cloud Functions don't run on the free Spark plan.

1. Firebase Console → ⚙️ (settings gear) → Usage and billing → Details & settings.
2. Click **Modify plan** → **Blaze**.
3. Set a budget alert at, say, $5/month under "Set a budget alert" so you get
   emailed if anything runs away.
4. (Optional) Set up an actual hard quota in Google Cloud Console → IAM & Admin
   → Quotas if you want a real spend cap rather than just an alert.

The Blaze free tier covers 2M function invocations + 5GB Firestore reads/month.
For the OTP flow you'll be nowhere near that.

### 2. Get a Gmail App Password (required)

The functions send the OTP email through Gmail's SMTP server. App Passwords
require 2-Step Verification on the account.

1. Go to https://myaccount.google.com/security
2. Enable **2-Step Verification** if it isn't already on.
3. Search "App passwords" in the search bar at the top of My Account, or visit
   https://myaccount.google.com/apppasswords directly.
4. Create a new app password named "CannaPickForMe Functions".
5. Copy the 16-character password (shown once — save it now).

You can use any Gmail account, including your personal one. If you have Google
Workspace, use the workspace account instead so the From address matches your
domain.

### 3. Install Node and the Firebase CLI

```bash
# Check what you have
node --version       # need v20
firebase --version

# If missing:
npm install -g firebase-tools
firebase login
```

## Configure the project

### 1. Set the Firebase project ID

From the project root:

```bash
firebase use --add
# Pick your project, give it the alias "default"
```

This creates `.firebaserc` if it doesn't exist.

### 2. Install function dependencies

```bash
cd functions
npm install
cd ..
```

### 3. Set the environment variables

The functions read SMTP credentials from environment variables. For Cloud
Functions v2, the cleanest way is a `.env` file in `functions/`:

Create `functions/.env`:

```
GMAIL_USER=your.address@gmail.com
GMAIL_PASSWORD=abcd efgh ijkl mnop
APP_NAME=CannaPickForMe
APP_FROM_NAME=CannaPickForMe
```

⚠️ `.env` is gitignored. Never commit it.

For local emulator testing you can also create `functions/.env.local` with the
same content; the emulator picks it up.

## Deploy

### 1. Push the Firestore rules

The new `signInCodes` lockdown rule needs to land before the functions, otherwise
the functions will work but rules deployment can fail later if you forget.

```bash
firebase deploy --only firestore:rules
```

### 2. Deploy the functions

```bash
firebase deploy --only functions
```

First deploy takes 3–5 minutes (Google has to build the container, configure
permissions, etc.). Subsequent deploys are faster.

### 3. Smoke test

Open your live app, click sign in, enter your email, then on the "Check Your
Email" screen click "Get a 6-digit code instead". You should:

1. Get an email within a few seconds with subject `Your CannaPickForMe sign-in
   code is XXXXXX`.
2. The modal flips to the code-entry screen.
3. Type the code → you're signed in.

If something fails, check function logs:

```bash
firebase functions:log --only requestSignInCode
```

## Testing locally with emulators (optional)

```bash
firebase emulators:start --only functions,firestore,auth
```

Then in your app, before initializing Firebase, point the SDK at the emulators
(only in dev):

```js
import { connectFunctionsEmulator } from 'firebase/functions';
import { connectFirestoreEmulator } from 'firebase/firestore';
import { connectAuthEmulator } from 'firebase/auth';

if (import.meta.env.DEV) {
  connectFunctionsEmulator(functions, 'localhost', 5001);
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectAuthEmulator(auth, 'http://localhost:9099');
}
```

## Tuning knobs (in `functions/index.js`)

- `CODE_TTL_MS` — how long codes are valid (default 10 minutes)
- `MAX_ATTEMPTS` — wrong guesses allowed per code (default 5)
- `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX_REQUESTS` — request throttle
  (default 3 requests per email per minute)

## When to swap Gmail for a real ESP

Gmail SMTP caps at 500 sends/day. If you grow past that, swap the transporter
config in `functions/index.js`:

```js
// Was: nodemailer.createTransport({ service: 'gmail', auth: {...} })
// Becomes:
nodemailer.createTransport({
  host: 'smtp.resend.com',  // or postmark/sendgrid/etc.
  port: 587,
  auth: { user: 'resend', pass: process.env.RESEND_API_KEY },
});
```

No other code changes needed.

## Costs to expect

For a small app with the magic-link path as primary and OTP only as fallback:

- Cloud Functions: well under the 2M free invocations
- Firestore: each code = 1 write + 1 read + 1 delete. Negligible.
- Gmail SMTP: free up to 500/day

Realistic monthly spend: **$0**.
