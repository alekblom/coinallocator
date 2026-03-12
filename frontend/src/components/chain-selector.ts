import { store } from '../state';
import { getActiveChain, setActiveChain } from '../chain/manager';
import type { ChainId } from '../types';

interface ChainOption {
  id: ChainId;
  icon: string;
  label: string;
}

const CHAINS: ChainOption[] = [
  { id: 'solana', icon: '◎', label: 'Solana' },
  { id: 'sui', icon: '◆', label: 'Sui' },
  { id: 'ethereum', icon: 'Ξ', label: 'Ethereum' },
  { id: 'base', icon: '🔵', label: 'Base' },
  { id: 'polygon', icon: '⬡', label: 'Polygon' },
];

function getChainOption(id: ChainId): ChainOption {
  return CHAINS.find(c => c.id === id) || CHAINS[0];
}

export function createChainSelector(): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'chain-selector';

  function render(): void {
    const active = getActiveChain();
    const current = getChainOption(active);

    wrapper.innerHTML = `
      <button class="chain-pill chain-pill-${active}" id="chain-toggle">
        <span class="chain-pill-icon">${current.icon}</span>
        <span class="chain-pill-name">${current.label}</span>
        <span class="chain-pill-arrow">▾</span>
      </button>
      <div class="chain-dropdown" id="chain-dropdown" style="display: none">
        ${CHAINS.map(c => `
          <button class="chain-option ${active === c.id ? 'active' : ''}" data-chain="${c.id}">
            <span>${c.icon}</span> ${c.label}
          </button>
        `).join('')}
      </div>
    `;

    const toggle = wrapper.querySelector('#chain-toggle')!;
    const dropdown = wrapper.querySelector('#chain-dropdown') as HTMLElement;

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    });

    wrapper.querySelectorAll('.chain-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const chain = (btn as HTMLElement).dataset.chain as ChainId;
        dropdown.style.display = 'none';
        setActiveChain(chain);
      });
    });

    document.addEventListener('click', () => {
      dropdown.style.display = 'none';
    }, { once: true });
  }

  render();
  store.subscribe('wallet', () => render());

  return wrapper;
}
