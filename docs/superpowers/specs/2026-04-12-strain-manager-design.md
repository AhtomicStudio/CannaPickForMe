# Strain Manager — Admin Dashboard Design

**Goal:** Let the admin add, edit, and hide strains from the CannaPickForMe admin dashboard without touching code or triggering a deploy for every change.

**Architecture:** `strains.json` stays bundled and unchanged. A single Firestore document (`strains/delta`) stores only the diff — hidden IDs, field-level overrides for base strains, and full objects for new additions. The app merges at runtime: JSON first, then delta on top.

**Tech Stack:** Firestore (existing), vanilla JS, existing admin.css/admin.js/admin.html

---

## Data Model

### Firestore document: `strains/delta`

```json
{
  "hidden":    ["blue-dream", "og-kush"],
  "overrides": {
    "og-kush": { "description": "Updated copy...", "genetics": "..." }
  },
  "additions": [
    {
      "id": "purple-sunset",
      "name": "Purple Sunset",
      "type": "indica",
      "effects": ["Relaxed", "Sleepy"],
      "flavors": ["Grape", "Berry"],
      "description": "...",
      "genetics": "...",
      "rating": 4.2,
      "dispensaries": [],
      "isAddition": true
    }
  ]
}
```

- `hidden` — base strain IDs suppressed from the app. Admin can restore any at any time.
- `overrides` — map of `strainId → partial object`. Only changed fields are stored. Merged on top of the base strain at runtime.
- `additions` — full strain objects created via admin. Appended after base strains in the merged list.

### Merge logic (app runtime)

1. Start with `strainsData` from bundled JSON.
2. Fetch `strains/delta` from Firestore (one read, cached for the session).
3. Filter out strains whose `id` is in `hidden`.
4. For each strain in `overrides`, shallow-merge the override fields onto the matching base strain.
5. Append `additions` to the end of the list.
6. Result replaces the previous `getAllStrains()` output.

If the Firestore fetch fails (offline, quota), fall back to the raw JSON — no crash, no empty list.

---

## New Firestore Service: `strainService.js`

Single file at `src/services/strainService.js`. Exports:

```js
getStrainDelta()           // fetch the delta doc; returns { hidden, overrides, additions }
saveStrainDelta(delta)     // write the full delta doc back
```

All admin operations (hide, restore, add, edit) call `getStrainDelta()`, mutate the object in memory, then call `saveStrainDelta()`. One read + one write per action.

---

## App Changes: `main.js`

`getAllStrains()` becomes async:

```js
async function getAllStrains() {
  const base = [...strainsData];
  const delta = await fetchStrainDelta(); // cached after first call
  return applyDelta(base, delta);
}
```

`applyDelta(base, delta)` is a pure function: filter hidden, merge overrides, append additions.

All callers of `getAllStrains()` that are already async (render functions, questionnaire) await the result. The stash and browse screens already re-render on demand so no structural changes are needed there.

---

## Admin Dashboard

### New section: "🌿 Manage Strains"

Added below the Ads section in `admin.html`. Two panels:

**Panel 1 — Add / Edit form**

Fields:
- **Name** — text input, required
- **Type** — radio buttons: Sativa / Indica / Hybrid
- **Effects** — tag input. Preset chips for all 12 known effects (Creative, Energetic, Euphoric, Focused, Giggly, Happy, Hungry, Relaxed, Sleepy, Talkative, Tingly, Uplifted). Click to toggle. Currently selected effects shown as removable purple chips.
- **Flavors** — tag input. Preset chips for all 37 known flavors. Click to toggle. Selected flavors shown as removable gold chips.
- **Description** — textarea
- **Genetics** — text input, optional (placeholder: "Parent A × Parent B" or leave blank for 🤫)
- **Rating** — number input, 1.0–5.0 step 0.1, optional
- **Dispensaries** — checkbox list of known dispensary keys from `DISPENSARY_NAMES` (`cookies-hayward` → "Cookies Hayward")
- **Save / Cancel** — same pattern as the ad form

Editing a **base strain** pre-fills all fields from the bundled JSON data. Saving writes only the changed fields to `overrides`.

Editing an **addition** pre-fills from the additions array. Saving replaces that object in `additions`.

**Panel 2 — Strain list**

- Search input (filters by name)
- Type filter tabs: All / Sativa / Indica / Hybrid
- Rows showing: name, type dot, effect count, dispensary badge if set
- Each row: **Edit** button, **Hide** button (base strains) or **Delete** button (additions)
- Hidden base strains appear with strikethrough text and a **Restore** button instead of Hide/Edit
- Additions show a 🌱 badge

All 167 base strains are listed (loaded from bundled JSON, no Firestore reads for the list itself). Additions from the delta are appended.

---

## Firestore Rules

`strains` collection needs read/write access. Add to `firestore.rules`:

```
match /strains/{doc} {
  allow read: if true;
  allow write: if true;
}
```

User must publish the updated rules in the Firebase console.

---

## Files Touched

| File | Change |
|---|---|
| `src/services/strainService.js` | Create — Firestore delta get/save |
| `src/main.js` | Make `getAllStrains()` async, add delta fetch + merge |
| `src/admin.js` | Add strain CRUD logic, delta read/write |
| `src/admin.css` | Add strain section styles (tag inputs, strain list rows) |
| `admin.html` | Add strain manager section markup |
| `firestore.rules` | Add `strains` collection rule |

---

## Out of Scope

- Bulk import / CSV upload
- Per-strain image upload
- Sorting/reordering additions
- THC/CBD percentage fields (not in current data model)
