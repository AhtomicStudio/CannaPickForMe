export const scalesAnimation = {
  id: 'scales',
  name: 'Weighing Scales',

  render(container, { allScores }) {
    container.innerHTML = `
      <div class="scales">
        <div class="scales__beam">
          <div class="scales__pillar"></div>
          <div class="scales__arm">
            <div class="scales__plate scales__plate--left">
              <div class="scales__names" id="anim-scale-left"></div>
            </div>
            <div class="scales__plate scales__plate--right">
              <div class="scales__names" id="anim-scale-right"></div>
            </div>
          </div>
        </div>
        <div class="scales__base"></div>
      </div>
    `;

    const leftNames  = container.querySelector('#anim-scale-left');
    const rightNames = container.querySelector('#anim-scale-right');

    const SPREAD_DURATION = 4000;
    const nameDelay = Math.min(
      200,
      (SPREAD_DURATION - 600) / Math.max(allScores.length, 1)
    );

    allScores.forEach((s, i) => {
      const side = i % 2 === 0 ? leftNames : rightNames;
      setTimeout(() => {
        if (!side) return;
        const span = document.createElement('span');
        span.className = 'scales__name';
        span.textContent = s.strainName;
        side.appendChild(span);
      }, 300 + i * nameDelay);
    });
  },
};
