interface PickingState {
  activePickingType: 'DOM' | 'Image' | null;
  mouseMoveHandler: ((e: MouseEvent) => void) | null;
  clickHandler: ((e: MouseEvent) => void) | null;
}

export const injectDiscordButton = () => {
  window.addEventListener('DOMContentLoaded', function () {
    const inIframe = window.self !== window.top;
    if (inIframe) {
      return;
    }

    // Create Discord button if it doesn't exist
    if (document.querySelector('#mcp-discord-button')) {
      return;
    }

    const createDiscordButton = () => {
      // Check if already dismissed
      if (localStorage.getItem('discord-button-dismissed') === 'true') {
        return;
      }

      const container = document.createElement('div');
      container.id = 'mcp-discord-button';
      container.className = 'mcp-discord-container';
      container.style.cssText = `
        position: fixed;
        bottom: 16px;
        right: 16px;
        z-index: 1000000;
        max-width: 320px;
      `;

      container.innerHTML = `
        <div class="mcp-discord-card" style="
          background: linear-gradient(to right, #4f46e5, #7c3aed);
          color: white;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(79, 70, 229, 0.3);
          transition: all 200ms ease;
          position: relative;
        ">
          <button class="mcp-discord-close" style="
            position: absolute;
            top: -8px;
            right: -8px;
            width: 24px;
            height: 24px;
            background: #6b7280;
            color: white;
            border: none;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            transition: background-color 200ms;
          ">×</button>
          <a href="https://discord.gg/Z6VpTav33k" target="_blank" rel="noopener noreferrer" style="
            display: block;
            padding: 16px;
            color: white;
            text-decoration: none;
          ">
            <div style="display: flex; align-items: flex-start; gap: 12px;">
              <svg style="width: 24px; height: 24px; flex-shrink: 0; margin-top: 2px;" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              <div style="flex: 1; min-width: 0;">
                <div style="font-weight: bold; font-size: 14px; margin-bottom: 6px;">
                  🎉 Join Discord Community
                </div>
                <div style="font-size: 12px; opacity: 0.95; line-height: 1.4;">
                  <div style="margin-bottom: 2px;">💎 <span style="font-weight: 600;">Get Premium FREE</span></div>
                  <div style="margin-bottom: 2px;">🐛 Debug help & tutorials</div>
                  <div>🤝 Share workflows & tips</div>
                </div>
              </div>
            </div>
          </a>
        </div>
      `;

      const closeButton = container.querySelector(
        '.mcp-discord-close'
      ) as HTMLElement;
      const card = container.querySelector('.mcp-discord-card') as HTMLElement;

      // Hover effects
      card.addEventListener('mouseenter', () => {
        card.style.transform = 'scale(1.05)';
        card.style.boxShadow = '0 15px 35px rgba(79, 70, 229, 0.4)';
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = 'scale(1)';
        card.style.boxShadow = '0 10px 25px rgba(79, 70, 229, 0.3)';
      });

      closeButton.addEventListener('mouseenter', () => {
        closeButton.style.background = '#374151';
      });

      closeButton.addEventListener('mouseleave', () => {
        closeButton.style.background = '#6b7280';
      });

      closeButton.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        container.remove();
        localStorage.setItem('discord-button-dismissed', 'true');
      });

      document.body.appendChild(container);
    };

    createDiscordButton();
  });
};
