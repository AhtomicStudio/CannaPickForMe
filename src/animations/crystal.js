export const crystalAnimation = {
  id: 'crystal',
  name: 'Crystal Ball Oracle',

  render(container, { strainName }) {
    container.innerHTML = `
      <div class="anim-crystal-scene">
        <div class="anim-crystal-haze anim-crystal-haze--1"></div>
        <div class="anim-crystal-haze anim-crystal-haze--2"></div>
        <div class="anim-crystal-haze anim-crystal-haze--3"></div>
        <div class="anim-crystal-wrap">
          <div style="position:relative">
            <div class="anim-crystal-tendril anim-crystal-tendril--1"></div>
            <div class="anim-crystal-tendril anim-crystal-tendril--2"></div>
            <div class="anim-crystal-tendril anim-crystal-tendril--3"></div>
            <div class="anim-crystal-ball">
              <div class="anim-crystal-smoke anim-crystal-smoke--1"></div>
              <div class="anim-crystal-smoke anim-crystal-smoke--2"></div>
              <div class="anim-crystal-smoke anim-crystal-smoke--3"></div>
              <div class="anim-crystal-shine"></div>
              <div class="anim-crystal-name"></div>
            </div>
          </div>
          <div class="anim-crystal-base"></div>
        </div>
      </div>
    `;

    // Strain name materializes inside ball at 4.5s
    setTimeout(() => {
      const nameEl = container.querySelector('.anim-crystal-name');
      if (!nameEl) return;
      nameEl.textContent = strainName;
      nameEl.classList.add('visible');
    }, 4500);
  },
};
