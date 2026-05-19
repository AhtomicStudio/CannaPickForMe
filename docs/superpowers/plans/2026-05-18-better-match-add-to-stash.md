# Better-Match Add to Stash Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a stash toggle button to each organic strain card in the better-match modal so users can add strains directly without leaving the modal.

**Architecture:** Two changes — a new `.btn--in-stash` CSS class in `style.css`, and wiring in `showBetterMatchesModal` in `main.js`. The button HTML is injected into each organic card during the existing `organicCards.map()` render, and a click listener is added in the post-render wiring block (alongside the existing expand listener). All required stash functions (`addToStash`, `removeFromStash`, `isInStash`, `updateStashUI`) are already imported/defined at the call site.

**Tech Stack:** Vanilla JS, CSS custom properties, existing `src/storage/store.js` stash API

---

### Task 1: Add `.btn--in-stash` CSS class

**Files:**
- Modify: `src/style.css` — add after the `.bm-score-badge` block (line ~1749)

- [ ] **Step 1: Add the style**

In `src/style.css`, add after the `.bm-score-badge` block (around line 1749):

```css
.bm-stash-btn {
  margin-top: 6px;
  font-size: 0.78rem;
  padding: 3px 10px;
  align-self: flex-start;
}

.btn--in-stash {
  background: rgba(134, 239, 172, 0.12) !important;
  color: #86efac !important;
  border-color: rgba(134, 239, 172, 0.25) !important;
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: `✓ built in <N>ms` with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/style.css
git commit -m "feat: add .btn--in-stash style for better-match stash button"
```

---

### Task 2: Add stash button HTML and click wiring to better-match cards

**Files:**
- Modify: `src/main.js` — `showBetterMatchesModal` function (lines ~1253–1305)

- [ ] **Step 1: Add stash button to the card HTML**

In `src/main.js`, find the `organicCards` map inside `showBetterMatchesModal` (around line 1253). Replace the current card template with:

```js
    return { index: i, html: `
      <div class="strain-card better-match-card">
        <div class="strain-card__type-dot" data-type="${strain.type}"></div>
        <div class="strain-card__info">
          <div class="strain-card__name bm-name-row">
            <span>${strain.name}</span>
            <span class="bm-score-badge">${Math.min(100, match.score)}% match</span>
          </div>
          <div class="strain-card__meta">${type} · ${effects}</div>
          <button class="btn-juicy compact bm-stash-btn${isInStash(strain.id) ? ' btn--in-stash' : ''}" data-strain-id="${strain.id}">
            ${isInStash(strain.id) ? '✓ In Stash' : '＋ Stash'}
          </button>
        </div>
        ${buildExpandBody(strain)}
      </div>` };
```

- [ ] **Step 2: Wire the stash button click listener**

In the same function, find the post-render wiring block (after `list.innerHTML = slots.join('')`, around line 1297). Add the stash button wiring **before** the expand listener block:

```js
  // Wire stash toggle buttons on organic strain cards.
  list.querySelectorAll('.bm-stash-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // prevent expand/collapse from triggering
      const id = btn.dataset.strainId;
      if (isInStash(id)) {
        removeFromStash(id);
        btn.textContent = '＋ Stash';
        btn.classList.remove('btn--in-stash');
      } else {
        addToStash(id);
        btn.textContent = '✓ In Stash';
        btn.classList.add('btn--in-stash');
      }
      updateStashUI();
    });
  });
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: `✓ built in <N>ms` with no errors.

- [ ] **Step 4: Verify in browser**

```bash
npm run dev
```

1. Add at least 2 strains to your stash, run the quiz, get a result
2. If the "See strains beyond your stash" button appears, tap it
3. Each organic strain card should show a `＋ Stash` button below the type/effects line
4. Tap `＋ Stash` on a card — button should change to `✓ In Stash` (green tint), stash count badge should update
5. Tap `✓ In Stash` — button should revert to `＋ Stash`, stash count should decrement
6. Tap the card info area (not the button) — card should still expand/collapse as before
7. Strains already in your stash should show `✓ In Stash` immediately when the modal opens

- [ ] **Step 5: Commit**

```bash
git add src/main.js
git commit -m "feat: add stash toggle button to better-match modal strain cards"
```
