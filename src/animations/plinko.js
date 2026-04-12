const PLINKO_PEGS = [
  { x: 16, y: 22 }, { x: 42, y: 22 }, { x: 68, y: 22 }, { x: 94, y: 22 },
  { x: 29, y: 47 }, { x: 55, y: 47 }, { x: 81, y: 47 },
  { x: 16, y: 72 }, { x: 42, y: 72 }, { x: 68, y: 72 }, { x: 94, y: 72 },
  { x: 29, y: 97 }, { x: 55, y: 97 }, { x: 81, y: 97 },
  { x: 16, y: 122 }, { x: 42, y: 122 }, { x: 68, y: 122 }, { x: 94, y: 122 },
  { x: 29, y: 147 }, { x: 55, y: 147 }, { x: 81, y: 147 },
];

export const plinkoAnimation = {
  id: 'plinko',
  name: 'Plinko Drop',

  render(container, { strainName, allScores }) {
    const others = allScores.slice(1, 5).map(s => s.strainName);
    const slots = [
      others[0] || '???',
      others[1] || '???',
      strainName,
      others[2] || '???',
      others[3] || '???',
    ];

    const pegsHTML = PLINKO_PEGS.map(
      p => `<div class="anim-plinko-peg" style="left:${p.x}px;top:${p.y}px"></div>`
    ).join('');

    const slotsHTML = slots.map((name, i) =>
      `<div class="anim-plinko-slot" data-slot="${i}">${name}</div>`
    ).join('');

    container.innerHTML = `
      <div class="anim-plinko-board">
        ${pegsHTML}
        <div class="anim-plinko-leaf">🍃</div>
        <div class="anim-plinko-slots">${slotsHTML}</div>
      </div>
    `;

    setTimeout(() => {
      const slot = container.querySelector('[data-slot="2"]');
      if (slot) slot.classList.add('anim-plinko-slot--winner');
    }, 4300);
  },
};
