const SPARK_POSITIONS = [
  { top: '18%', left: '12%' },
  { top: '14%', left: '78%' },
  { top: '58%', left: '6%'  },
  { top: '62%', left: '82%' },
  { top: '8%',  left: '46%' },
];

export const tarotAnimation = {
  id: 'tarot',
  name: 'Tarot Card Draw',

  render(container, { strainName }) {
    const sparksHTML = SPARK_POSITIONS.map(
      pos => `<span class="anim-tarot-spark" style="top:${pos.top};left:${pos.left}">✦</span>`
    ).join('');

    container.innerHTML = `
      <div class="anim-tarot-scene">
        ${sparksHTML}
        <div class="anim-tarot-card anim-tarot-card--c1"></div>
        <div class="anim-tarot-card anim-tarot-card--c2"></div>
        <div class="anim-tarot-card anim-tarot-card--c3"></div>
        <div class="anim-tarot-card anim-tarot-card--c4"></div>
        <div class="anim-tarot-card anim-tarot-card--c5"></div>
        <div class="anim-tarot-label"></div>
      </div>
    `;

    // At 4.0s: card is edge-on — swap to winner face while invisible
    setTimeout(() => {
      const centerCard = container.querySelector('.anim-tarot-card--c3');
      if (centerCard) centerCard.classList.add('anim-tarot-card--winner');
    }, 4000);

    // At 4.5s: card face-front showing winner — show label + sparkles
    setTimeout(() => {
      const label = container.querySelector('.anim-tarot-label');
      if (label) {
        label.textContent = strainName;
        label.classList.add('visible');
      }
      container.querySelectorAll('.anim-tarot-spark').forEach((spark, i) => {
        setTimeout(() => spark.classList.add('pop'), i * 60);
      });
    }, 4500);
  },
};
