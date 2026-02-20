import { getAvailableWallets, connectWallet } from './adapter';
import { $ } from '../utils/dom';

let modalEl: HTMLElement | null = null;

export function showWalletModal(): void {
  if (modalEl) return;

  const wallets = getAvailableWallets();

  modalEl = document.createElement('div');
  modalEl.className = 'modal-backdrop';
  modalEl.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Connect Wallet</h2>
        <button class="modal-close" id="wallet-modal-close">\u00d7</button>
      </div>
      <div class="wallet-list">
        ${wallets.map(w => `
          <button class="wallet-option" data-wallet="${w.name}">
            <div class="wallet-option-icon">
              <img src="${w.icon}" alt="${w.name}" />
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

  document.body.appendChild(modalEl);

  // Close on backdrop click
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeWalletModal();
  });

  // Close button
  $('#wallet-modal-close', modalEl)?.addEventListener('click', closeWalletModal);

  // Wallet selection
  modalEl.querySelectorAll('.wallet-option').forEach(btn => {
    btn.addEventListener('click', async () => {
      const name = (btn as HTMLElement).dataset.wallet!;
      closeWalletModal();
      await connectWallet(name);
    });
  });
}

export function closeWalletModal(): void {
  if (modalEl) {
    modalEl.remove();
    modalEl = null;
  }
}
