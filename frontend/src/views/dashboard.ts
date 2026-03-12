import { store } from '../state';
import { navigate } from '../router';
import { $ } from '../utils/dom';
import { truncateAddress, formatSol, formatNativeAmount, bpsToPercent } from '../utils/format';
import { showToast } from '../components/toast';
import { SPLIT_COLORS, EXPLORER_URL, SOLANA_NETWORK, SUI_EXPLORER_URL } from '../constants';
import { getActiveChain, getNativeToken, getNativeExplorerUrl, getNativeDecimals } from '../chain/manager';
import { isEvmChain } from '../evm/networks';
import { getLabels } from '../utils/labels';
import { fetchTxHistory, type TxHistoryEntry } from '../utils/tx-history';
import type { DeployedSplit } from '../types';

export function renderDashboard(outlet: HTMLElement): (() => void) | void {
  const token = getNativeToken();

  outlet.innerHTML = `
    <div class="dashboard-page fade-in">
      <div class="dashboard-header">
        <h1>Dashboard</h1>
        <button class="btn-primary" id="new-split-btn">+ New Split</button>
      </div>

      <div class="dashboard-stats" id="dashboard-stats"></div>
      <div id="dashboard-content"></div>
    </div>
  `;

  $('#new-split-btn', outlet)?.addEventListener('click', () => navigate('/configure'));

  loadSplits();

  const refreshInterval = setInterval(loadSplits, 30000);
  return () => clearInterval(refreshInterval);

  async function loadSplits(): Promise<void> {
    const pubkey = store.getState().wallet.publicKey;
    if (!pubkey) {
      const content = $('#dashboard-content', outlet)!;
      content.innerHTML = `
        <div class="dashboard-empty">
          <h2>Connect your wallet</h2>
          <p>Connect a wallet to view your deployed splits.</p>
          <button class="btn-primary" id="dash-connect-wallet">Connect Wallet</button>
        </div>
      `;
      $('#dash-connect-wallet', content)?.addEventListener('click', async () => {
        const { showWalletModal } = await import('../wallet/ui');
        showWalletModal();
        const unsub = store.subscribe('wallet', (state) => {
          if (state.wallet.connected) {
            unsub();
            loadSplits();
          }
        });
      });
      return;
    }

    const content = $('#dashboard-content', outlet)!;
    const stats = $('#dashboard-stats', outlet)!;
    const chain = getActiveChain();
    const token = getNativeToken();
    const decimals = getNativeDecimals();

    content.innerHTML = `
      <div class="dashboard-loading">
        <div class="spinner" style="margin: 0 auto var(--space-4)"></div>
        <p class="text-muted">Loading your splits...</p>
      </div>
    `;

    try {
      let splits: DeployedSplit[];

      if (isEvmChain(chain)) {
        const { fetchUserSplits } = await import('../evm/program');
        splits = await fetchUserSplits(pubkey);
      } else if (chain === 'sui') {
        const { fetchUserSplits } = await import('../sui/program');
        splits = await fetchUserSplits(pubkey);
      } else {
        const { fetchUserSplits } = await import('../solana/program');
        const { getConnection } = await import('../wallet/adapter');
        const { PublicKey } = await import('@solana/web3.js');
        const { bytesToName } = await import('../solana/pda');

        const rawSplits = await fetchUserSplits(new PublicKey(pubkey));
        const conn = getConnection();

        splits = await Promise.all(
          rawSplits.map(async (s: any) => {
            const balance = await conn.getBalance(new PublicKey(s.address));
            return {
              address: s.address,
              name: bytesToName(s.data.name),
              authority: s.data.creator.toBase58(),
              recipients: s.data.recipients.map((r: any) => ({
                wallet: r.wallet.toBase58(),
                shareBps: r.shareBps,
                claimedSol: r.claimedSol.toNumber(),
              })),
              balance,
              totalReceived: s.data.totalReceivedSol?.toNumber?.() || 0,
              createdAt: s.data.createdAt?.toNumber?.() || 0,
            };
          }),
        );
      }

      store.update('dashboard', { splits, loading: false });

      // Stats
      const totalBalance = splits.reduce((sum, s) => sum + s.balance, 0);
      const totalDistributed = splits.reduce(
        (sum, s) => sum + s.recipients.reduce((rs, r) => rs + r.claimedSol, 0),
        0,
      );

      stats.innerHTML = `
        <div class="stat-card">
          <div class="stat-label">Total Splits</div>
          <div class="stat-value">${splits.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Balance</div>
          <div class="stat-value">${formatNativeAmount(totalBalance, decimals)} ${token}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Distributed</div>
          <div class="stat-value">${formatNativeAmount(totalDistributed, decimals)} ${token}</div>
        </div>
      `;

      if (splits.length === 0) {
        content.innerHTML = `
          <div class="dashboard-empty">
            <h2>No splits yet</h2>
            <p>Create your first fund-splitting contract to get started.</p>
            <button class="btn-primary" id="empty-create">Create Split</button>
          </div>
        `;
        $('#empty-create', content)?.addEventListener('click', () => navigate('/configure'));
        return;
      }

      const explorerBase = getNativeExplorerUrl();

      content.innerHTML = `<div class="dashboard-grid" id="splits-grid"></div>`;
      const grid = $('#splits-grid', content)!;

      splits.forEach((split, si) => {
        const card = document.createElement('div');
        card.className = 'split-card';

        const labels = getLabels(split.address);

        let explorerLink: string;
        if (chain === 'sui') {
          explorerLink = `${explorerBase}/object/${split.address}`;
        } else if (isEvmChain(chain)) {
          explorerLink = `${explorerBase}/address/${split.address}`;
        } else {
          explorerLink = `${EXPLORER_URL}/address/${split.address}?cluster=${SOLANA_NETWORK}`;
        }

        card.innerHTML = `
          <div class="split-card-header">
            <span class="split-card-name">${split.name || 'Unnamed Split'}</span>
            <div class="split-card-header-right">
              <button class="btn-secondary btn-sm share-btn" data-split="${si}" title="Share payment page">Share</button>
              <span class="split-card-address" title="${split.address}">${truncateAddress(split.address, 4)}</span>
            </div>
          </div>
          <div class="split-card-body">
            <div class="split-card-balance">
              <div class="split-card-balance-amount">${formatNativeAmount(split.balance, decimals)} ${token}</div>
              <div class="split-card-balance-label">Current Balance</div>
            </div>
            <div class="split-card-recipients">
              ${split.recipients.map((r, i) => `
                <div class="split-card-recipient">
                  <div>
                    ${labels[r.wallet] ? `<span class="split-card-recipient-label">${labels[r.wallet]}</span>` : ''}
                    <span class="split-card-recipient-address" style="color: ${SPLIT_COLORS[i]}">${truncateAddress(r.wallet, 4)}</span>
                  </div>
                  <span class="split-card-recipient-share">${bpsToPercent(r.shareBps)}%</span>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="split-card-actions">
            <button class="btn-secondary btn-sm distribute-btn" data-split="${si}">Distribute</button>
            <button class="btn-secondary btn-sm claim-btn" data-split="${si}">Claim</button>
            <a href="${explorerLink}" target="_blank" class="btn-secondary btn-sm">Explorer</a>
          </div>
          <div class="tx-history-section">
            <button class="tx-history-toggle" data-split="${si}">
              <span class="tx-history-arrow">&#9654;</span> Transaction History
            </button>
            <div class="tx-history-content" id="tx-history-${si}" style="display: none;"></div>
          </div>
        `;

        // Copy address
        const addrEl = card.querySelector('.split-card-address');
        addrEl?.addEventListener('click', () => {
          navigator.clipboard.writeText(split.address);
          showToast('Address copied!', 'info');
        });

        grid.appendChild(card);
      });

      // Share button handlers
      grid.querySelectorAll('.share-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt((btn as HTMLElement).dataset.split!);
          navigate(`/split/${splits[idx].address}`);
        });
      });

      // Distribute handlers
      grid.querySelectorAll('.distribute-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const idx = parseInt((btn as HTMLElement).dataset.split!);
          await handleDistribute(splits[idx]);
        });
      });

      // Claim handlers
      grid.querySelectorAll('.claim-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const idx = parseInt((btn as HTMLElement).dataset.split!);
          await handleClaim(splits[idx]);
        });
      });

      // Transaction history toggles
      grid.querySelectorAll('.tx-history-toggle').forEach(btn => {
        btn.addEventListener('click', async () => {
          const idx = parseInt((btn as HTMLElement).dataset.split!);
          const contentEl = document.getElementById(`tx-history-${idx}`)!;
          const arrow = btn.querySelector('.tx-history-arrow')!;

          if (contentEl.style.display === 'none') {
            contentEl.style.display = 'block';
            arrow.textContent = '\u25BC';

            // Lazy load on first expand
            if (!contentEl.dataset.loaded) {
              contentEl.innerHTML = '<div class="tx-history-loading">Loading...</div>';
              try {
                const entries = await fetchTxHistory(splits[idx].address);
                contentEl.dataset.loaded = '1';
                renderTxHistory(contentEl, entries, token, decimals);
              } catch {
                contentEl.innerHTML = '<div class="tx-history-loading">Failed to load history</div>';
              }
            }
          } else {
            contentEl.style.display = 'none';
            arrow.textContent = '\u25B6';
          }
        });
      });
    } catch (err: any) {
      content.innerHTML = `
        <div class="dashboard-empty">
          <h2>Error loading splits</h2>
          <p>${err.message || 'Failed to fetch data'}</p>
          <button class="btn-secondary" id="retry-load">Retry</button>
        </div>
      `;
      $('#retry-load', content)?.addEventListener('click', loadSplits);
    }
  }

  async function handleDistribute(split: DeployedSplit): Promise<void> {
    try {
      const chain = getActiveChain();
      if (isEvmChain(chain)) {
        const { distribute } = await import('../evm/program');
        await distribute(split.address);
      } else if (chain === 'sui') {
        const { buildDistributeTx } = await import('../sui/program');
        const { signAndSendSuiTransaction } = await import('../chain/sui');
        const tx = buildDistributeTx(split.address);
        await signAndSendSuiTransaction(tx);
      } else {
        const { buildDistributeTx } = await import('../solana/program');
        const { signAndSendTransaction } = await import('../wallet/adapter');
        const { PublicKey } = await import('@solana/web3.js');
        const pubkey = store.getState().wallet.publicKey!;
        const recipientWallets = split.recipients.map(r => new PublicKey(r.wallet));
        const tx = await buildDistributeTx(
          new PublicKey(split.address),
          new PublicKey(pubkey),
          recipientWallets,
        );
        await signAndSendTransaction(tx);
      }
      showToast('Funds distributed!', 'success');
      loadSplits();
    } catch (err: any) {
      showToast(err.message || 'Distribution failed', 'error');
    }
  }

  async function handleClaim(split: DeployedSplit): Promise<void> {
    try {
      const chain = getActiveChain();
      if (isEvmChain(chain)) {
        const { claim } = await import('../evm/program');
        await claim(split.address);
      } else if (chain === 'sui') {
        const { buildClaimTx } = await import('../sui/program');
        const { signAndSendSuiTransaction } = await import('../chain/sui');
        const tx = buildClaimTx(split.address);
        await signAndSendSuiTransaction(tx);
      } else {
        const { buildClaimTx } = await import('../solana/program');
        const { signAndSendTransaction } = await import('../wallet/adapter');
        const { PublicKey } = await import('@solana/web3.js');
        const pubkey = store.getState().wallet.publicKey!;
        const tx = await buildClaimTx(
          new PublicKey(split.address),
          new PublicKey(pubkey),
        );
        await signAndSendTransaction(tx);
      }
      showToast('Funds claimed!', 'success');
      loadSplits();
    } catch (err: any) {
      showToast(err.message || 'Claim failed', 'error');
    }
  }
}

function renderTxHistory(container: HTMLElement, entries: TxHistoryEntry[], token: string, decimals: number): void {
  if (entries.length === 0) {
    container.innerHTML = '<div class="tx-history-loading">No transactions found</div>';
    return;
  }

  const TYPE_BADGES: Record<string, { label: string; cls: string }> = {
    deposit: { label: 'Deposit', cls: 'tx-badge-deposit' },
    distribute: { label: 'Distribute', cls: 'tx-badge-distribute' },
    claim: { label: 'Claim', cls: 'tx-badge-claim' },
    unknown: { label: 'Unknown', cls: 'tx-badge-unknown' },
  };

  container.innerHTML = entries.map(tx => {
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
