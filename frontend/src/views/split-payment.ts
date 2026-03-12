import { store } from '../state';
import { $ } from '../utils/dom';
import { truncateAddress, formatNativeAmount, bpsToPercent } from '../utils/format';
import { showToast } from '../components/toast';
import { SPLIT_COLORS, EXPLORER_URL, SOLANA_NETWORK } from '../constants';
import { getActiveChain, getNativeToken, getNativeExplorerUrl, getNativeDecimals } from '../chain/manager';
import { isEvmChain } from '../evm/networks';
import { getLabels } from '../utils/labels';
import { fetchSplitByAddress } from '../utils/fetch-split';
import { showWalletModal } from '../wallet/ui';
import { fetchTxHistory, type TxHistoryEntry } from '../utils/tx-history';
import type { DeployedSplit } from '../types';
import QRCode from 'qrcode';

export function renderSplitPayment(outlet: HTMLElement, params?: Record<string, string>): (() => void) | void {
  const address = params?.address;
  if (!address) {
    outlet.innerHTML = `<div class="split-payment-error"><h2>Invalid URL</h2><p>No split address provided.</p></div>`;
    return;
  }

  outlet.innerHTML = `
    <div class="split-payment-loading fade-in">
      <div class="spinner" style="margin: 0 auto var(--space-4)"></div>
      <p class="text-muted">Loading split...</p>
    </div>
  `;

  loadSplit(address);

  async function loadSplit(addr: string): Promise<void> {
    try {
      const split = await fetchSplitByAddress(addr);
      renderSplitPage(split);
    } catch (err: any) {
      outlet.innerHTML = `
        <div class="split-payment-error fade-in">
          <h2>Split Not Found</h2>
          <p>${err.message || 'Could not load split data.'}</p>
        </div>
      `;
    }
  }

  async function renderSplitPage(split: DeployedSplit): Promise<void> {
    const chain = getActiveChain();
    const token = getNativeToken();
    const decimals = getNativeDecimals();
    const labels = getLabels(split.address);
    const explorerBase = getNativeExplorerUrl();

    let explorerLink: string;
    if (chain === 'sui') {
      explorerLink = `${explorerBase}/object/${split.address}`;
    } else if (isEvmChain(chain)) {
      explorerLink = `${explorerBase}/address/${split.address}`;
    } else {
      explorerLink = `${EXPLORER_URL}/address/${split.address}?cluster=${SOLANA_NETWORK}`;
    }

    // Generate QR code
    let qrDataUrl = '';
    try {
      qrDataUrl = await QRCode.toDataURL(split.address, {
        width: 200,
        margin: 2,
        color: { dark: '#e0e0e0', light: '#1a1a2e' },
      });
    } catch { /* QR generation failed — proceed without */ }

    const walletConnected = store.getState().wallet.connected;

    outlet.innerHTML = `
      <div class="split-payment-page fade-in">
        <div class="split-payment-card">
          <div class="split-payment-name">${split.name || 'Unnamed Split'}</div>
          <div class="split-payment-address" id="copy-address" title="Click to copy">
            ${truncateAddress(split.address, 8)}
            <span style="font-size: var(--font-size-xs)">&#x2398;</span>
          </div>

          ${qrDataUrl ? `
            <div class="split-payment-qr">
              <img src="${qrDataUrl}" alt="QR Code" />
            </div>
          ` : ''}

          <div class="split-payment-balance">
            <div class="split-payment-balance-amount">${formatNativeAmount(split.balance, decimals)} ${token}</div>
            <div class="split-payment-balance-label">Current Balance</div>
          </div>

          <div class="split-payment-recipients">
            <h3>Recipients</h3>
            ${split.recipients.map((r, i) => `
              <div class="split-payment-recipient">
                <div>
                  ${labels[r.wallet] ? `<span class="split-payment-recipient-label">${labels[r.wallet]}</span>` : ''}
                  <span class="split-payment-recipient-address" style="color: ${SPLIT_COLORS[i % SPLIT_COLORS.length]}">${truncateAddress(r.wallet, 6)}</span>
                </div>
                <span class="split-payment-recipient-share">${bpsToPercent(r.shareBps)}%</span>
              </div>
            `).join('')}
          </div>

          <div class="split-payment-send">
            ${walletConnected ? `
              <div class="split-payment-send-form">
                <input class="input" type="number" id="send-amount" step="0.001" min="0.001" placeholder="Amount" />
                <button class="btn-primary" id="send-btn">Send ${token}</button>
              </div>
            ` : `
              <button class="btn-primary" id="connect-wallet-btn" style="width: 100%">Connect Wallet to Send ${token}</button>
            `}
          </div>

          <div class="split-payment-actions">
            <a href="${explorerLink}" target="_blank" class="btn-secondary btn-sm">View on Explorer</a>
          </div>
        </div>

        <div class="split-payment-activity" id="recent-activity">
          <h3>Recent Activity</h3>
          <div class="tx-history-loading">Loading...</div>
        </div>
      </div>
    `;

    // Copy address
    $('#copy-address', outlet)?.addEventListener('click', () => {
      navigator.clipboard.writeText(split.address);
      showToast('Address copied!', 'info');
    });

    // Connect wallet
    $('#connect-wallet-btn', outlet)?.addEventListener('click', () => {
      showWalletModal();
      const unsub = store.subscribe('wallet', (state) => {
        if (state.wallet.connected) {
          unsub();
          renderSplitPage(split);
        }
      });
    });

    // Send funds
    $('#send-btn', outlet)?.addEventListener('click', async () => {
      const amountInput = $('#send-amount', outlet) as HTMLInputElement;
      const amount = parseFloat(amountInput.value);
      if (!amount || amount <= 0) {
        showToast('Enter a valid amount', 'error');
        return;
      }

      const btn = $('#send-btn', outlet) as HTMLButtonElement;
      btn.disabled = true;
      btn.textContent = 'Sending...';

      try {
        if (isEvmChain(chain)) {
          const { sendToSplit } = await import('../evm/program');
          await sendToSplit(split.address, amount.toString());
        } else if (chain === 'sui') {
          const { buildDepositTx } = await import('../sui/program');
          const { signAndSendSuiTransaction } = await import('../chain/sui');
          const amountMist = Math.round(amount * 1e9);
          const tx = buildDepositTx(split.address, amountMist);
          await signAndSendSuiTransaction(tx);
        } else {
          const { SystemProgram, PublicKey, Transaction } = await import('@solana/web3.js');
          const { signAndSendTransaction } = await import('../wallet/adapter');
          const lamports = Math.round(amount * 1e9);
          const tx = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: new PublicKey(store.getState().wallet.publicKey!),
              toPubkey: new PublicKey(split.address),
              lamports,
            }),
          );
          await signAndSendTransaction(tx);
        }

        showToast(`Sent ${amount} ${token}!`, 'success');
        // Reload to refresh balance
        loadSplit(split.address);
      } catch (err: any) {
        showToast(err.message || 'Transfer failed', 'error');
        btn.disabled = false;
        btn.textContent = `Send ${token}`;
      }
    });

    // Load recent activity
    const activityEl = $('#recent-activity', outlet);
    if (activityEl) {
      try {
        const entries = await fetchTxHistory(split.address, 10);
        renderRecentActivity(activityEl, entries, token, decimals);
      } catch {
        activityEl.querySelector('.tx-history-loading')!.textContent = 'Failed to load activity';
      }
    }
  }
}

function renderRecentActivity(container: HTMLElement, entries: TxHistoryEntry[], token: string, decimals: number): void {
  const heading = '<h3>Recent Activity</h3>';

  if (entries.length === 0) {
    container.innerHTML = heading + '<div class="tx-history-loading">No transactions yet</div>';
    return;
  }

  const TYPE_BADGES: Record<string, { label: string; cls: string }> = {
    deposit: { label: 'Deposit', cls: 'tx-badge-deposit' },
    distribute: { label: 'Distribute', cls: 'tx-badge-distribute' },
    claim: { label: 'Claim', cls: 'tx-badge-claim' },
    unknown: { label: 'Unknown', cls: 'tx-badge-unknown' },
  };

  container.innerHTML = heading + entries.map(tx => {
    const badge = TYPE_BADGES[tx.type] || TYPE_BADGES.unknown;
    const date = tx.timestamp
      ? new Date(tx.timestamp * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '';
    const amount = tx.amount ? `${(tx.amount / Math.pow(10, decimals)).toFixed(4)} ${token}` : '';

    return `
      <div class="tx-entry">
        <span class="tx-badge ${badge.cls}">${badge.label}</span>
        <span class="tx-date">${date}</span>
        ${amount ? `<span class="tx-amount">${amount}</span>` : ''}
        <a href="${tx.explorerUrl}" target="_blank" class="tx-explorer-link">View</a>
      </div>
    `;
  }).join('');
}
