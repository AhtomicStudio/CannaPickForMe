# Strain Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a strain manager to the admin dashboard that lets the admin add, edit, and hide strains using a single Firestore delta document layered on top of the bundled strains.json.

**Architecture:** A `strains/delta` Firestore document stores three fields — `hidden` (array of suppressed base strain IDs), `overrides` (map of strainId → changed fields), and `additions` (array of full new strain objects). On app load the delta is fetched once and cached; `getAllStrains()` merges it synchronously from the cache on every call. The admin dashboard reads and writes the same document.

**Tech Stack:** Firestore (firebase/firestore), vanilla JS, existing admin.css / admin.js / admin.html, Vite bundler.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/services/strainService.js` | Create | Firestore get/save for the delta document |
| `src/main.js` | Modify | Cache delta on init, apply it in `getAllStrains()` |
| `firestore.rules` | Modify | Allow reads/writes on `strains` collection |
| `admin.html` | Modify | Add strain manager section HTML |
| `src/admin.css` | Modify | Tag inputs, strain list rows, filter tabs |
| `src/admin.js` | Modify | Strain CRUD, tag input logic, list rendering |

---

## Task 1: Create `src/services/strainService.js`

**Files:**
- Create: `src/services/strainService.js`

- [ ] **Step 1: Create the file**

```js
/**
 * Strain Delta Service for CannaPickForMe
 * Reads and writes the single Firestore document that overlays strains.json.
 */

import { db } from '../firebase.js';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const DELTA_REF = () => doc(db, 'strains', 'delta');

const EMPTY_DELTA = { hidden: [], overrides: {}, additions: [] };

/**
 * Fetch the strain delta from Firestore.
 * Returns EMPTY_DELTA on error or if the document doesn't exist yet.
 */
export async function getStrainDelta() {
  try {
    const snap = await getDoc(DELTA_REF());
    if (!snap.exists()) return { ...EMPTY_DELTA };
    const data = snap.data();
    return {
      hidden:    Array.isArray(data.hidden)    ? data.hidden    : [],
      overrides: data.overrides && typeof data.overrides === 'object' ? data.overrides : {},
      additions: Array.isArray(data.additions) ? data.additions : [],
    };
  } catch (err) {
    console.warn('Failed to fetch strain delta:', err);
    return { ...EMPTY_DELTA };
  }
}

/**
 * Write the full delta object back to Firestore.
 */
export async function saveStrainDelta(delta) {
  await setDoc(DELTA_REF(), {
    hidden:    delta.hidden    ?? [],
    overrides: delta.overrides ?? {},
    additions: delta.additions ?? [],
  });
}
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: clean build, no errors. The file is not yet imported by anything so there is no functional change.

- [ ] **Step 3: Commit**

```bash
git add src/services/strainService.js
git commit -m "feat: add strainService — Firestore delta get/save"
```

---

## Task 2: Integrate delta into `main.js`

**Files:**
- Modify: `src/main.js` — lines 116–120 (`getAllStrains`), line 849–860 (`init`)

The delta is fetched once on startup and stored in a module-level variable. `getAllStrains()` stays synchronous — it reads from the cache. The app renders immediately with the bundled JSON, then re-renders the browse list once the delta arrives.

- [ ] **Step 1: Add the module-level cache and `applyDelta` helper**

After line 35 (after the `DISPENSARY_NAMES` block), add:

```js
// === STRAIN DELTA CACHE ===
let strainDelta = { hidden: [], overrides: {}, additions: [] };

function applyDelta(strains, delta) {
  const { hidden, overrides, additions } = delta;
  return strains
    .filter(s => !hidden.includes(s.id))
    .map(s => overrides[s.id] ? { ...s, ...overrides[s.id] } : s)
    .concat(additions);
}
```

- [ ] **Step 2: Update `getAllStrains()` to apply the cached delta**

Replace the existing `getAllStrains()` at line 117:

```js
function getAllStrains() {
  const customs = getCustomStrains();
  return applyDelta([...strainsData, ...customs], strainDelta);
}
```

- [ ] **Step 3: Add `initStrainDelta()` async initialiser**

After the `getAllStrains` function, add:

```js
async function initStrainDelta() {
  try {
    const { getStrainDelta } = await import('./services/strainService.js');
    strainDelta = await getStrainDelta();
    // Re-render browse list if it is currently visible
    const list = document.getElementById('strain-list');
    if (list) renderBrowseList();
  } catch {
    // Silent — fall back to raw JSON
  }
}
```

- [ ] **Step 4: Call `initStrainDelta()` in `init()`**

In the `init()` function, after `loadAds()`, add:

```js
initStrainDelta();
```

- [ ] **Step 5: Verify the build passes**

Run: `npm run build`
Expected: clean build. App behaviour is unchanged for users — delta is empty until the admin adds data.

- [ ] **Step 6: Commit**

```bash
git add src/main.js
git commit -m "feat: integrate Firestore strain delta into getAllStrains"
```

---

## Task 3: Update Firestore rules

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Add the `strains` collection rule**

Open `firestore.rules` and add the strains block so the file reads:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Ads collection — public reads, open writes (admin protected client-side)
    match /ads/{adId} {
      allow read: if true;
      allow write: if true;
    }

    // Strain delta — public reads, open writes (admin protected client-side)
    match /strains/{doc} {
      allow read: if true;
      allow write: if true;
    }

    // Deny everything else
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 2: Publish the rules in the Firebase console**

Go to Firebase Console → Firestore Database → Rules tab → paste the new rules → click **Publish**.

- [ ] **Step 3: Commit the rules file**

```bash
git add firestore.rules
git commit -m "feat: allow reads/writes on strains collection in Firestore rules"
```

---

## Task 4: Admin HTML — strain manager sections

**Files:**
- Modify: `admin.html`

Add two new `<section>` blocks inside `<div id="dashboard">`, after the closing `</section>` of the Manage Ads section (before `</div>`).

- [ ] **Step 1: Add the Add/Edit Strain form section**

```html
<!-- Add/Edit Strain Form -->
<section class="admin-section">
  <h2 id="strain-form-title">🌿 Add New Strain</h2>
  <form id="strain-form" class="admin-form">
    <input type="hidden" id="edit-strain-id" />
    <input type="hidden" id="edit-strain-is-addition" />

    <div class="admin-form__row">
      <div class="admin-form__group">
        <label for="strain-name">Name *</label>
        <input type="text" id="strain-name" required placeholder="e.g., Purple Haze" />
      </div>
      <div class="admin-form__group">
        <label>Type *</label>
        <div class="admin-radio-group">
          <label class="admin-radio"><input type="radio" name="strain-type" value="sativa" /> Sativa</label>
          <label class="admin-radio"><input type="radio" name="strain-type" value="indica" /> Indica</label>
          <label class="admin-radio"><input type="radio" name="strain-type" value="hybrid" checked /> Hybrid</label>
        </div>
      </div>
    </div>

    <div class="admin-form__group">
      <label>Effects</label>
      <div class="admin-tag-input" id="effects-tag-input">
        <div class="admin-tag-input__pills" id="effects-pills"></div>
        <div class="admin-tag-input__options" id="effects-options"></div>
      </div>
    </div>

    <div class="admin-form__group">
      <label>Flavors</label>
      <div class="admin-tag-input" id="flavors-tag-input">
        <div class="admin-tag-input__pills" id="flavors-pills"></div>
        <div class="admin-tag-input__options" id="flavors-options"></div>
      </div>
    </div>

    <div class="admin-form__group">
      <label for="strain-description">Description</label>
      <textarea id="strain-description" rows="3" placeholder="What does this strain feel like?"></textarea>
    </div>

    <div class="admin-form__row">
      <div class="admin-form__group">
        <label for="strain-genetics">Genetics</label>
        <input type="text" id="strain-genetics" placeholder="e.g., OG Kush × Durban Poison" />
      </div>
      <div class="admin-form__group">
        <label for="strain-rating">Rating (1.0–5.0)</label>
        <input type="number" id="strain-rating" min="1" max="5" step="0.1" placeholder="4.5" />
      </div>
    </div>

    <div class="admin-form__group">
      <label>Dispensaries</label>
      <div class="admin-checkbox-group" id="strain-dispensaries-group"></div>
    </div>

    <div class="admin-form__actions">
      <button type="button" id="btn-cancel-strain" class="admin-btn admin-btn--ghost hidden">Cancel Edit</button>
      <button type="submit" id="btn-submit-strain" class="admin-btn admin-btn--primary">Add Strain</button>
    </div>
  </form>
</section>

<!-- Strain List -->
<section class="admin-section">
  <h2>📋 Manage Strains</h2>
  <div class="admin-strain-controls">
    <input type="text" id="strain-admin-search" placeholder="Search by name..." />
    <div class="admin-filter-tabs" id="strain-filter-tabs">
      <button class="admin-filter-tab admin-filter-tab--active" data-filter="all">All</button>
      <button class="admin-filter-tab" data-filter="sativa">Sativa</button>
      <button class="admin-filter-tab" data-filter="indica">Indica</button>
      <button class="admin-filter-tab" data-filter="hybrid">Hybrid</button>
    </div>
  </div>
  <div id="strains-admin-list" class="admin-strains-list"></div>
</section>
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add admin.html
git commit -m "feat: add strain manager sections to admin HTML"
```

---

## Task 5: Admin CSS — strain manager styles

**Files:**
- Modify: `src/admin.css`

Append all of the following to the end of `src/admin.css`:

- [ ] **Step 1: Append the styles**

```css
/* ============================================
   STRAIN MANAGER
   ============================================ */

/* Radio group */
.admin-radio-group {
  display: flex;
  gap: 1.25rem;
  padding: 0.5rem 0;
}

.admin-radio {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
  cursor: pointer;
}

.admin-radio input[type="radio"] {
  accent-color: var(--green-primary);
  width: 15px;
  height: 15px;
  cursor: pointer;
}

/* Textarea */
.admin-form__group textarea {
  width: 100%;
  padding: 0.65rem 0.75rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: 0.9rem;
  outline: none;
  resize: vertical;
  transition: border-color 0.2s;
}

.admin-form__group textarea:focus {
  border-color: var(--border-focus);
}

/* Number input */
.admin-form__group input[type="number"] {
  width: 100%;
  padding: 0.65rem 0.75rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.2s;
}

.admin-form__group input[type="number"]:focus {
  border-color: var(--border-focus);
}

/* Tag input */
.admin-tag-input {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.admin-tag-input__pills {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  min-height: 28px;
}

.admin-tag-input__options {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.admin-tag-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.admin-tag-pill--effect {
  background: rgba(192, 132, 252, 0.2);
  border: 1px solid rgba(192, 132, 252, 0.4);
  color: #c084fc;
}

.admin-tag-pill--effect:hover {
  background: rgba(192, 132, 252, 0.35);
}

.admin-tag-pill--flavor {
  background: rgba(251, 191, 36, 0.15);
  border: 1px solid rgba(251, 191, 36, 0.3);
  color: #fbbf24;
}

.admin-tag-pill--flavor:hover {
  background: rgba(251, 191, 36, 0.28);
}

.admin-tag-pill__remove {
  font-size: 0.65rem;
  opacity: 0.6;
  line-height: 1;
}

.admin-tag-option {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text-muted);
  transition: all 0.15s;
}

.admin-tag-option:hover {
  border-color: var(--green-primary);
  color: var(--text-primary);
}

/* Checkbox group */
.admin-checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
}

.admin-checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
  cursor: pointer;
}

.admin-checkbox-label input[type="checkbox"] {
  accent-color: var(--green-primary);
  width: 15px;
  height: 15px;
  cursor: pointer;
}

/* Strain controls bar */
.admin-strain-controls {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.admin-strain-controls input[type="text"] {
  width: 100%;
  padding: 0.6rem 0.75rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: 0.85rem;
  outline: none;
  transition: border-color 0.2s;
}

.admin-strain-controls input[type="text"]:focus {
  border-color: var(--border-focus);
}

/* Filter tabs */
.admin-filter-tabs {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.admin-filter-tab {
  padding: 0.3rem 0.85rem;
  border-radius: 999px;
  font-family: var(--font-body);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text-muted);
  transition: all 0.2s;
}

.admin-filter-tab:hover {
  color: var(--text-primary);
  border-color: var(--text-muted);
}

.admin-filter-tab--active {
  background: rgba(34, 197, 94, 0.12);
  border-color: var(--green-primary);
  color: var(--green-glow);
}

/* Strain list */
.admin-strains-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.admin-strain-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.5rem;
  border-bottom: 1px solid var(--border);
  transition: background 0.15s;
}

.admin-strain-row:hover {
  background: rgba(255, 255, 255, 0.02);
}

.admin-strain-row--hidden {
  opacity: 0.45;
}

.admin-strain-row__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.admin-strain-row__dot[data-type="sativa"]  { background: #fbbf24; }
.admin-strain-row__dot[data-type="indica"]  { background: #c084fc; }
.admin-strain-row__dot[data-type="hybrid"]  { background: #4ade80; }

.admin-strain-row__name {
  flex: 1;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.admin-strain-row--hidden .admin-strain-row__name {
  text-decoration: line-through;
  color: var(--text-muted);
}

.admin-strain-row__badges {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.admin-strain-row__actions {
  display: flex;
  gap: 0.3rem;
  flex-shrink: 0;
}
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add src/admin.css
git commit -m "feat: add strain manager styles to admin CSS"
```

---

## Task 6: Admin JS — strain CRUD logic

**Files:**
- Modify: `src/admin.js`

This is the largest task. Add all strain management logic to `admin.js`.

- [ ] **Step 1: Add imports and constants at the top of the file**

After the existing import line (`import './admin.css';`), add:

```js
import strainsData from './data/strains.json';
import { getStrainDelta, saveStrainDelta } from './services/strainService.js';
```

After the existing `const SESSION_KEY = 'cpfm_admin_auth';` line, add:

```js
const DISPENSARY_NAMES = {
  'cookies-hayward': 'Cookies Hayward',
};

const ALL_EFFECTS = ['Creative','Energetic','Euphoric','Focused','Giggly','Happy','Hungry','Relaxed','Sleepy','Talkative','Tingly','Uplifted'];
const ALL_FLAVORS  = ['Apple','Banana','Berry','Blueberry','Candy','Cheese','Cherry','Chocolate','Citrus','Coffee','Creamy','Diesel','Earthy','Floral','Flowery','Fruity','Grape','Guava','Lemon','Mango','Melon','Mint','Minty','Nutty','Orange','Peach','Pine','Pineapple','Plum','Pungent','Sour','Spicy','Strawberry','Sweet','Tropical','Vanilla','Woody'];
```

- [ ] **Step 2: Add strain state variables**

After the existing `let existingImageUrl = null;` state block, add:

```js
// === STRAIN STATE ===
let strainDelta      = { hidden: [], overrides: {}, additions: [] };
let editingStrainId  = null;
let editingStrainIsAddition = false;
let selectedEffects  = [];
let selectedFlavors  = [];
let strainSearchQuery = '';
let strainTypeFilter  = 'all';
```

- [ ] **Step 3: Add the tag input helpers**

After the state block, add:

```js
// === TAG INPUT ===
function renderTagInput(pillsEl, optionsEl, selected, allOptions, pillClass, onChange) {
  pillsEl.innerHTML = selected.map(v =>
    `<span class="admin-tag-pill admin-tag-pill--${pillClass}" data-value="${v}">
      ${v} <span class="admin-tag-pill__remove">✕</span>
    </span>`
  ).join('');

  optionsEl.innerHTML = allOptions
    .filter(v => !selected.includes(v))
    .map(v => `<span class="admin-tag-option" data-value="${v}">${v}</span>`)
    .join('');

  pillsEl.querySelectorAll('.admin-tag-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      onChange(selected.filter(v => v !== pill.dataset.value));
    });
  });

  optionsEl.querySelectorAll('.admin-tag-option').forEach(opt => {
    opt.addEventListener('click', () => {
      onChange([...selected, opt.dataset.value]);
    });
  });
}

function refreshEffects() {
  renderTagInput(
    document.getElementById('effects-pills'),
    document.getElementById('effects-options'),
    selectedEffects,
    ALL_EFFECTS,
    'effect',
    (next) => { selectedEffects = next; refreshEffects(); }
  );
}

function refreshFlavors() {
  renderTagInput(
    document.getElementById('flavors-pills'),
    document.getElementById('flavors-options'),
    selectedFlavors,
    ALL_FLAVORS,
    'flavor',
    (next) => { selectedFlavors = next; refreshFlavors(); }
  );
}
```

- [ ] **Step 4: Add the dispensary checkbox renderer**

```js
function renderDispensaryCheckboxes(selected = []) {
  const group = document.getElementById('strain-dispensaries-group');
  group.innerHTML = Object.entries(DISPENSARY_NAMES).map(([key, label]) =>
    `<label class="admin-checkbox-label">
      <input type="checkbox" value="${key}" ${selected.includes(key) ? 'checked' : ''} />
      ${label}
    </label>`
  ).join('');
}

function getSelectedDispensaries() {
  return [...document.querySelectorAll('#strain-dispensaries-group input:checked')]
    .map(el => el.value);
}
```

- [ ] **Step 5: Add `resetStrainForm()` and `startEditingStrain()`**

```js
function resetStrainForm() {
  editingStrainId = null;
  editingStrainIsAddition = false;
  selectedEffects = [];
  selectedFlavors = [];

  document.getElementById('strain-form-title').textContent = '🌿 Add New Strain';
  document.getElementById('strain-form').reset();
  document.querySelector('input[name="strain-type"][value="hybrid"]').checked = true;
  document.getElementById('edit-strain-id').value = '';
  document.getElementById('edit-strain-is-addition').value = '';
  document.getElementById('btn-cancel-strain').classList.add('hidden');
  document.getElementById('btn-submit-strain').textContent = 'Add Strain';

  refreshEffects();
  refreshFlavors();
  renderDispensaryCheckboxes([]);
}

function startEditingStrain(strainId, isAddition) {
  // Resolve the full strain object (base + any existing override, or addition)
  let strain;
  if (isAddition) {
    strain = strainDelta.additions.find(s => s.id === strainId);
  } else {
    const base = strainsData.find(s => s.id === strainId) || {};
    const override = strainDelta.overrides[strainId] || {};
    strain = { ...base, ...override };
  }
  if (!strain) return;

  editingStrainId = strainId;
  editingStrainIsAddition = isAddition;
  selectedEffects = [...(strain.effects || [])];
  selectedFlavors = [...(strain.flavors || [])];

  document.getElementById('strain-form-title').textContent = '✏️ Edit Strain';
  document.getElementById('edit-strain-id').value = strainId;
  document.getElementById('edit-strain-is-addition').value = isAddition ? 'true' : '';
  document.getElementById('strain-name').value = strain.name || '';
  const typeRadio = document.querySelector(`input[name="strain-type"][value="${strain.type || 'hybrid'}"]`);
  if (typeRadio) typeRadio.checked = true;
  document.getElementById('strain-description').value = strain.description || '';
  document.getElementById('strain-genetics').value = strain.genetics || '';
  document.getElementById('strain-rating').value = strain.rating != null ? strain.rating : '';
  document.getElementById('btn-cancel-strain').classList.remove('hidden');
  document.getElementById('btn-submit-strain').textContent = 'Save Changes';

  refreshEffects();
  refreshFlavors();
  renderDispensaryCheckboxes(strain.dispensaries || []);

  document.getElementById('strain-form-title').scrollIntoView({ behavior: 'smooth' });
}
```

- [ ] **Step 6: Add the strain list renderer**

```js
function renderStrainList() {
  const container = document.getElementById('strains-admin-list');
  const allBase = strainsData;
  const allAdditions = strainDelta.additions;

  // Combine: base strains first, then additions
  let rows = [
    ...allBase.map(s => ({ ...s, _isAddition: false })),
    ...allAdditions.map(s => ({ ...s, _isAddition: true })),
  ];

  // Apply search
  if (strainSearchQuery) {
    rows = rows.filter(s => s.name.toLowerCase().includes(strainSearchQuery));
  }

  // Apply type filter
  if (strainTypeFilter !== 'all') {
    rows = rows.filter(s => s.type === strainTypeFilter);
  }

  if (rows.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);padding:1rem 0.5rem;font-size:0.85rem;">No strains match.</p>';
    return;
  }

  container.innerHTML = rows.map(s => {
    const isHidden   = strainDelta.hidden.includes(s.id);
    const isAddition = s._isAddition;
    const hasOverride = !isAddition && !!strainDelta.overrides[s.id];

    return `
      <div class="admin-strain-row ${isHidden ? 'admin-strain-row--hidden' : ''}" data-id="${s.id}">
        <span class="admin-strain-row__dot" data-type="${s.type}"></span>
        <span class="admin-strain-row__name">${s.name}</span>
        <div class="admin-strain-row__badges">
          ${isAddition  ? '<span class="admin-tag" style="border-color:var(--green-primary);color:var(--green-glow)">🌱 Added</span>' : ''}
          ${hasOverride ? '<span class="admin-tag" style="border-color:#fbbf24;color:#fbbf24">edited</span>' : ''}
        </div>
        <div class="admin-strain-row__actions">
          ${isHidden
            ? `<button class="admin-btn admin-btn--small" data-action="restore" data-id="${s.id}">↩ Restore</button>`
            : `<button class="admin-btn admin-btn--small" data-action="edit" data-id="${s.id}" data-addition="${isAddition}">✏️</button>
               <button class="admin-btn admin-btn--small admin-btn--danger" data-action="${isAddition ? 'delete' : 'hide'}" data-id="${s.id}">
                 ${isAddition ? '🗑️' : '🙈 Hide'}
               </button>`
          }
        </div>
      </div>
    `;
  }).join('');

  // Wire buttons
  container.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () =>
      startEditingStrain(btn.dataset.id, btn.dataset.addition === 'true')
    );
  });

  container.querySelectorAll('[data-action="hide"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      strainDelta.hidden.push(btn.dataset.id);
      await saveStrainDelta(strainDelta);
      renderStrainList();
    });
  });

  container.querySelectorAll('[data-action="restore"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      strainDelta.hidden = strainDelta.hidden.filter(id => id !== btn.dataset.id);
      await saveStrainDelta(strainDelta);
      renderStrainList();
    });
  });

  container.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this strain permanently?')) return;
      strainDelta.additions = strainDelta.additions.filter(s => s.id !== btn.dataset.id);
      await saveStrainDelta(strainDelta);
      renderStrainList();
    });
  });
}
```

- [ ] **Step 7: Add the strain form submit handler and init hook**

Find the `// === INIT ===` section. Add the following new function just before it:

```js
function initStrainManager() {
  // Load delta and render list
  getStrainDelta().then(delta => {
    strainDelta = delta;
    resetStrainForm();
    renderStrainList();
  });

  // Search
  document.getElementById('strain-admin-search').addEventListener('input', e => {
    strainSearchQuery = e.target.value.toLowerCase();
    renderStrainList();
  });

  // Filter tabs
  document.getElementById('strain-filter-tabs').querySelectorAll('.admin-filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-filter-tab').forEach(t => t.classList.remove('admin-filter-tab--active'));
      tab.classList.add('admin-filter-tab--active');
      strainTypeFilter = tab.dataset.filter;
      renderStrainList();
    });
  });

  // Cancel edit
  document.getElementById('btn-cancel-strain').addEventListener('click', resetStrainForm);

  // Form submit
  document.getElementById('strain-form').addEventListener('submit', async e => {
    e.preventDefault();
    const submitBtn = document.getElementById('btn-submit-strain');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Saving...';
    submitBtn.disabled = true;

    try {
      const name = document.getElementById('strain-name').value.trim();
      const type = document.querySelector('input[name="strain-type"]:checked').value;
      const description = document.getElementById('strain-description').value.trim();
      const genetics = document.getElementById('strain-genetics').value.trim() || null;
      const ratingRaw = document.getElementById('strain-rating').value;
      const rating = ratingRaw ? parseFloat(ratingRaw) : null;
      const dispensaries = getSelectedDispensaries();

      if (editingStrainIsAddition) {
        // Replace addition in-place
        const idx = strainDelta.additions.findIndex(s => s.id === editingStrainId);
        if (idx >= 0) {
          strainDelta.additions[idx] = {
            ...strainDelta.additions[idx],
            name, type, effects: selectedEffects, flavors: selectedFlavors,
            description, genetics, rating, dispensaries, isAddition: true,
          };
        }
      } else if (editingStrainId) {
        // Save override for base strain
        strainDelta.overrides[editingStrainId] = {
          name, type, effects: selectedEffects, flavors: selectedFlavors,
          description, genetics, rating, dispensaries,
        };
      } else {
        // New addition
        const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        strainDelta.additions.push({
          id, name, type,
          effects: selectedEffects,
          flavors: selectedFlavors,
          description, genetics, rating, dispensaries,
          isAddition: true,
        });
      }

      await saveStrainDelta(strainDelta);
      resetStrainForm();
      renderStrainList();
    } catch (err) {
      console.error('Error saving strain:', err);
      alert('Failed to save strain. Check console for details.');
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });
}
```

- [ ] **Step 8: Call `initStrainManager()` inside `showDashboard()`**

Find the `showDashboard()` function. It currently calls `loadAdsList()`. Add the strain manager call after it:

```js
function showDashboard() {
  document.getElementById('login-gate').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
  loadAdsList();
  initStrainManager();
}
```

- [ ] **Step 9: Verify the build passes**

Run: `npm run build`
Expected: clean build, no errors.

- [ ] **Step 10: Commit**

```bash
git add src/admin.js
git commit -m "feat: strain manager CRUD in admin dashboard"
```

---

## Task 7: Final build, push, and manual smoke test

- [ ] **Step 1: Run a final build**

```bash
npm run build
```

Expected: clean build.

- [ ] **Step 2: Push to deploy**

```bash
git push origin main
```

- [ ] **Step 3: Smoke test the admin dashboard**

1. Go to `cannapickforme.com/admin`, log in.
2. Scroll to **Add New Strain**. Fill in a name, pick a type, click a few effects and flavors, add a description. Click **Add Strain**.
3. Verify the new strain appears in the list below with a 🌱 badge.
4. Click **✏️** on the new strain. Verify the form pre-fills. Change the name. Click **Save Changes**. Verify the list updates.
5. Click **🗑️** on the new strain. Confirm deletion. Verify it disappears from the list.
6. Find a base strain (e.g., "Blue Dream"). Click **✏️**. Change the description. Save. Verify it shows an "edited" badge.
7. Click **🙈 Hide** on a base strain. Verify it appears with strikethrough.
8. Click **↩ Restore** on that strain. Verify it returns to normal.
9. Open the main app (`cannapickforme.com`), go to Browse. Verify:
   - The hidden strain is gone from the list.
   - The edited strain shows the new description in its expanded panel.
   - The new addition appears at the bottom of the list.
