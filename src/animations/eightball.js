export const eightBallAnimation = {
  id: 'eightball',
  name: 'Magic 8-Ball',

  render(container, { strainName }) {
    container.innerHTML = `
      <div class="anim-ball-scene">
        <div class="anim-ball">
          <div class="anim-ball-window">
            <div class="anim-ball-mist"></div>
            <div class="anim-ball-reveal"></div>
          </div>
        </div>
        <div class="anim-ball-cloud"></div>
      </div>
    `;

    setTimeout(() => {
      const el = container.querySelector('.anim-ball-reveal');
      if (!el) return;
      el.textContent = strainName;
      el.classList.add('visible');
    }, 4500);
  },
};
