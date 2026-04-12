export const boxAnimation = {
  id: 'box',
  name: 'Notes in a Box',

  render(container, { strainName, allScores }) {
    const competitors = allScores.slice(1, 4).map(s => s.strainName);
    while (competitors.length < 3) competitors.push('???');

    container.innerHTML = `
      <div class="anim-box-scene">
        <div class="anim-box-body">
          <div class="anim-box-lid"></div>
          <div class="anim-box-note">${competitors[0]}</div>
          <div class="anim-box-note">${competitors[1]}</div>
          <div class="anim-box-note">${competitors[2]}</div>
          <div class="anim-box-chosen"></div>
        </div>
      </div>
    `;

    setTimeout(() => {
      const chosen = container.querySelector('.anim-box-chosen');
      if (!chosen) return;
      chosen.textContent = strainName;
      chosen.classList.add('visible');
    }, 4500);
  },
};
