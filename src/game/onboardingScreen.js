/**
 * CannaGotchi — Onboarding Screen
 * Seed selection: pick Indica / Sativa / Hybrid, name your monster, go.
 */

import { MONSTER_TYPES } from './monsters.js';
import { renderSprite } from './pixelArt.js';

/**
 * Render the onboarding UI into a container.
 * @param {HTMLElement} container
 * @param {function({ monsterType: string, monsterName: string }): void} onComplete
 */
export function renderOnboarding(container, onComplete) {
  let selectedType = null;

  container.innerHTML = `
    <div class="game-onboarding">
      <h2 class="game-retro-title">Choose Your Seed</h2>
      <p class="game-subtitle">Pick a strain type to grow your CannaGotchi.</p>
      <div class="game-seed-cards" id="seed-cards"></div>
      <div class="game-name-section hidden" id="name-section">
        <label class="game-label" for="monster-name-input">Name Your Monster</label>
        <input type="text" id="monster-name-input" class="game-input" placeholder="e.g. Purps" maxlength="16" autocomplete="off" />
        <button id="btn-confirm-seed" class="btn btn--primary btn--glow game-confirm-btn" disabled>
          🌱 Plant It!
        </button>
      </div>
    </div>
  `;

  const cardsContainer = container.querySelector('#seed-cards');
  const nameSection = container.querySelector('#name-section');
  const nameInput = container.querySelector('#monster-name-input');
  const confirmBtn = container.querySelector('#btn-confirm-seed');

  // Render the 3 seed cards
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
      </div>
    `;
    cardsContainer.appendChild(card);

    // Render pixel seed sprite
    const spriteEl = card.querySelector(`#seed-sprite-${type.id}`);
    renderSprite(spriteEl, `${type.id}_seed`, 6);

    card.addEventListener('click', () => {
      selectedType = type.id;
      cardsContainer.querySelectorAll('.game-seed-card').forEach(c =>
        c.classList.toggle('game-seed-card--selected', c.dataset.type === type.id)
      );
      nameSection.classList.remove('hidden');
      nameInput.focus();
      updateConfirm();
    });
  });

  function updateConfirm() {
    confirmBtn.disabled = !selectedType || nameInput.value.trim().length === 0;
  }

  nameInput.addEventListener('input', updateConfirm);

  confirmBtn.addEventListener('click', () => {
    if (!selectedType || !nameInput.value.trim()) return;
    onComplete({
      monsterType: selectedType,
      monsterName: nameInput.value.trim(),
    });
  });
}
