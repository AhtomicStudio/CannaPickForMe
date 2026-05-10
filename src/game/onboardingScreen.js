/**
 * CannaGotchi — Onboarding Screen
 * Three-step seed selection: pick strain type → pick variant → name your Cannabud.
 */

import { MONSTER_TYPES, getVariant } from './monsters.js';
import { renderSprite } from './pixelArt.js';

/**
 * Render the onboarding UI into a container.
 * @param {HTMLElement} container
 * @param {function({ monsterType, monsterVariant, monsterName }): void} onComplete
 */
export function renderOnboarding(container, onComplete) {
  let selectedType = null;
  let selectedVariant = null;

  function paintStrainStep() {
    container.innerHTML = `
      <div class="game-onboarding">
        <h2 class="game-retro-title">Choose Your Seed</h2>
        <p class="game-subtitle">Pick a strain type to grow your Cannabud.<br>Care for it, level it up, battle other Cannabuds.</p>
        <div class="game-seed-cards" id="seed-cards"></div>
      </div>`;

    const cards = container.querySelector('#seed-cards');
    Object.values(MONSTER_TYPES).forEach(type => {
      const card = document.createElement('button');
      card.className = 'game-seed-card';
      card.dataset.type = type.id;
      card.innerHTML = `
        <div class="game-seed-card__sprite" id="seed-sprite-${type.id}"></div>
        <div class="game-seed-card__name">${type.emoji} ${type.name}</div>
        <div class="game-seed-card__desc">${type.description}</div>
        <div class="game-seed-card__stats">
          <span>HP ${type.baseStats.hp}</span>
          <span>ATK ${type.baseStats.atk}</span>
          <span>DEF ${type.baseStats.def}</span>
          <span>SPD ${type.baseStats.spd}</span>
        </div>`;
      cards.appendChild(card);
      const spriteEl = card.querySelector(`#seed-sprite-${type.id}`);
      renderSprite(spriteEl, `${type.id}_seed`, 6);
      card.addEventListener('click', () => {
        selectedType = type.id;
        paintVariantStep();
      });
    });
  }

  function paintVariantStep() {
    const type = MONSTER_TYPES[selectedType];
    container.innerHTML = `
      <div class="game-onboarding">
        <h2 class="game-retro-title">Pick Your Variant</h2>
        <p class="game-subtitle">${type.emoji} ${type.name} comes in three phenotypes.<br>Pure flavor — variant doesn't change stats.</p>
        <div class="game-seed-cards" id="variant-cards"></div>
        <button class="btn-juicy compact" id="back-to-type" style="margin-top:0.6rem">← Back</button>
      </div>`;

    const cards = container.querySelector('#variant-cards');
    type.variants.forEach(variant => {
      const card = document.createElement('button');
      card.className = 'game-seed-card';
      card.dataset.variant = variant.id;
      card.innerHTML = `
        <div class="game-seed-card__sprite" id="var-sprite-${variant.id}"></div>
        <div class="game-seed-card__name" style="color:${variant.color}">${variant.name}</div>
        <div class="game-seed-card__desc">${variant.desc}</div>`;
      cards.appendChild(card);
      const spriteEl = card.querySelector(`#var-sprite-${variant.id}`);
      // Show seed sprite painted with this variant's palette remap
      renderSprite(spriteEl, `${type.id}_seed`, 6, { paletteRemap: variant.paletteRemap });
      card.addEventListener('click', () => {
        selectedVariant = variant.id;
        paintNameStep();
      });
    });

    container.querySelector('#back-to-type').addEventListener('click', () => {
      selectedVariant = null;
      paintStrainStep();
    });
  }

  function paintNameStep() {
    const type = MONSTER_TYPES[selectedType];
    const variant = getVariant(selectedType, selectedVariant);
    container.innerHTML = `
      <div class="game-onboarding">
        <h2 class="game-retro-title">Name Your Cannabud</h2>
        <p class="game-subtitle">A ${variant.name} ${type.name}, ready to grow.</p>
        <div class="game-seed-card game-seed-card--selected" style="border-color:${variant.color};max-width:200px;margin:0 auto 1rem">
          <div class="game-seed-card__sprite" id="name-sprite"></div>
          <div class="game-seed-card__name" style="color:${variant.color}">${variant.name}</div>
        </div>
        <div class="game-name-section">
          <label class="game-label" for="monster-name-input">Pick a name (max 16 chars)</label>
          <input type="text" id="monster-name-input" class="game-input" placeholder="e.g. Purps" maxlength="16" autocomplete="off" />
          <button id="btn-confirm-seed" class="btn btn--primary btn--glow game-confirm-btn" disabled>🌱 Plant It!</button>
          <button class="btn-juicy compact" id="back-to-variant" style="margin-top:0.6rem">← Back</button>
        </div>
      </div>`;

    renderSprite(container.querySelector('#name-sprite'), `${type.id}_seed`, 6, { paletteRemap: variant.paletteRemap });

    const input = container.querySelector('#monster-name-input');
    const confirm = container.querySelector('#btn-confirm-seed');
    input.focus();
    input.addEventListener('input', () => {
      confirm.disabled = input.value.trim().length === 0;
    });
    confirm.addEventListener('click', () => {
      if (!input.value.trim()) return;
      onComplete({
        monsterType:    selectedType,
        monsterVariant: selectedVariant,
        monsterName:    input.value.trim(),
      });
    });
    container.querySelector('#back-to-variant').addEventListener('click', paintVariantStep);
  }

  paintStrainStep();
}
