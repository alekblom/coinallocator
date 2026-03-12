import { getAvailableWallets, connectWallet } from './adapter';
import { getSuiAvailableWallets, connectSuiWallet } from '../chain/sui';
import { getEvmAvailableWallets, connectEvmWallet } from '../chain/evm';
import { getActiveChain, setActiveChain } from '../chain/manager';
import { isEvmChain } from '../evm/networks';
import { $ } from '../utils/dom';
import type { ChainId } from '../types';

interface ChainTab {
  id: ChainId;
  icon: string;
  label: string;
}

const CHAIN_TABS: ChainTab[] = [
  { id: 'solana', icon: '◎', label: 'Solana' },
  { id: 'sui', icon: '◆', label: 'Sui' },
  { id: 'ethereum', icon: 'Ξ', label: 'Ethereum' },
  { id: 'base', icon: '🔵', label: 'Base' },
  { id: 'polygon', icon: '⬡', label: 'Polygon' },
];

let modalEl: HTMLElement | null = null;

export function showWalletModal(): void {
  if (modalEl) return;

  modalEl = document.createElement('div');
  modalEl.className = 'modal-backdrop';

  renderModal(getActiveChain());

  document.body.appendChild(modalEl);

  // Close on backdrop click
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeWalletModal();
  });
}

function renderModal(selectedChain: ChainId): void {
  if (!modalEl) return;

  let wallets: { name: string; icon: string; detected: boolean; chain: ChainId }[];

  if (selectedChain === 'solana') {
    wallets = getAvailableWallets().map(w => ({
      name: w.name,
      icon: w.icon,
      detected: w.detected,
      chain: 'solana' as const,
    }));
  } else if (selectedChain === 'sui') {
    wallets = getSuiAvailableWallets();
  } else {
    wallets = getEvmAvailableWallets(selectedChain);
  }

  const chainLabel = CHAIN_TABS.find(c => c.id === selectedChain)?.label || selectedChain;

  modalEl.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Connect Wallet</h2>
        <button class="modal-close" id="wallet-modal-close">\u00d7</button>
      </div>
      <div class="wallet-chain-tabs">
        ${CHAIN_TABS.map(tab => `
          <button class="wallet-chain-tab ${selectedChain === tab.id ? 'active' : ''}" data-chain="${tab.id}">
            <span>${tab.icon}</span> ${tab.label}
          </button>
        `).join('')}
      </div>
      <div class="wallet-list">
        ${wallets.length === 0 ? `
          <div class="wallet-empty">No ${chainLabel} wallets detected</div>
        ` : wallets.map(w => `
          <button class="wallet-option" data-wallet="${w.name}" data-chain="${w.chain}">
            <div class="wallet-option-icon">
              ${w.icon ? `<img src="${w.icon}" alt="${w.name}" />` : `<span class="wallet-option-icon-placeholder">${w.name[0]}</span>`}
            </div>
            <div>
              <div class="wallet-option-name">${w.name}</div>
              <div class="wallet-option-status ${w.detected ? 'wallet-option-detected' : ''}">
                ${w.detected ? 'Detected' : 'Not installed'}
              </div>
            </div>
          </button>
        `).join('')}
      </div>
    </div>
  `;

  // Close button
  $('#wallet-modal-close', modalEl)?.addEventListener('click', closeWalletModal);

  // Chain tabs
  modalEl.querySelectorAll('.wallet-chain-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const chain = (tab as HTMLElement).dataset.chain as ChainId;
      setActiveChain(chain);
      renderModal(chain);
    });
  });

  // Wallet selection
  modalEl.querySelectorAll('.wallet-option').forEach(btn => {
    btn.addEventListener('click', async () => {
      const name = (btn as HTMLElement).dataset.wallet!;
      const chain = (btn as HTMLElement).dataset.chain as ChainId;
      closeWalletModal();
      if (chain === 'sui') {
        await connectSuiWallet(name);
      } else if (isEvmChain(chain)) {
        await connectEvmWallet(name, chain);
      } else {
        await connectWallet(name);
      }
    });
  });
}

export function closeWalletModal(): void {
  if (modalEl) {
    modalEl.remove();
    modalEl = null;
  }
}
