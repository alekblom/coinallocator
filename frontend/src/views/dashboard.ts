import { store } from '../state';
import { navigate } from '../router';
import { $ } from '../utils/dom';
import { truncateAddress, formatSol, bpsToPercent } from '../utils/format';
import { bytesToName } from '../solana/pda';
import { fetchUserSplits, buildDistributeTx, buildClaimTx } from '../solana/program';
import { signAndSendTransaction, getConnection } from '../wallet/adapter';
import { showToast } from '../components/toast';
import { SPLIT_COLORS, EXPLORER_URL, SOLANA_NETWORK } from '../constants';
import { PublicKey } from '@solana/web3.js';
import type { DeployedSplit } from '../types';

export function renderDashboard(outlet: HTMLElement): (() => void) | void {
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
    if (!pubkey) return;

    const content = $('#dashboard-content', outlet)!;
    const stats = $('#dashboard-stats', outlet)!;

    content.innerHTML = `
      <div class="dashboard-loading">
        <div class="spinner" style="margin: 0 auto var(--space-4)"></div>
        <p class="text-muted">Loading your splits...</p>
      </div>
    `;

    try {
      const rawSplits = await fetchUserSplits(new PublicKey(pubkey));

      const conn = getConnection();
      const splits: DeployedSplit[] = await Promise.all(
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
          <div class="stat-value">${formatSol(totalBalance)} SOL</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Distributed</div>
          <div class="stat-value">${formatSol(totalDistributed)} SOL</div>
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

      content.innerHTML = `<div class="dashboard-grid" id="splits-grid"></div>`;
      const grid = $('#splits-grid', content)!;

      splits.forEach((split, si) => {
        const card = document.createElement('div');
        card.className = 'split-card';
        card.innerHTML = `
          <div class="split-card-header">
            <span class="split-card-name">${split.name || 'Unnamed Split'}</span>
            <span class="split-card-address" title="${split.address}">${truncateAddress(split.address, 4)}</span>
          </div>
          <div class="split-card-body">
            <div class="split-card-balance">
              <div class="split-card-balance-amount">${formatSol(split.balance)} SOL</div>
              <div class="split-card-balance-label">Current Balance</div>
            </div>
            <div class="split-card-recipients">
              ${split.recipients.map((r, i) => `
                <div class="split-card-recipient">
                  <span class="split-card-recipient-address" style="color: ${SPLIT_COLORS[i]}">${truncateAddress(r.wallet, 4)}</span>
                  <span class="split-card-recipient-share">${bpsToPercent(r.shareBps)}%</span>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="split-card-actions">
            <button class="btn-secondary btn-sm distribute-btn" data-split="${si}">Distribute</button>
            <button class="btn-secondary btn-sm claim-btn" data-split="${si}">Claim</button>
            <a href="${EXPLORER_URL}/address/${split.address}?cluster=${SOLANA_NETWORK}" target="_blank" class="btn-secondary btn-sm">Explorer</a>
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
    } catch (err: any) {
      content.innerHTML = `
        <div class="dashboard-empty">
          <h2>Error loading splits</h2>
          <p>${err.message || 'Failed to fetch data from Solana'}</p>
          <button class="btn-secondary" id="retry-load">Retry</button>
        </div>
      `;
      $('#retry-load', content)?.addEventListener('click', loadSplits);
    }
  }

  async function handleDistribute(split: DeployedSplit): Promise<void> {
    try {
      const pubkey = store.getState().wallet.publicKey!;
      const recipientWallets = split.recipients.map(r => new PublicKey(r.wallet));
      const tx = await buildDistributeTx(
        new PublicKey(split.address),
        new PublicKey(pubkey),
        recipientWallets,
      );
      const sig = await signAndSendTransaction(tx);
      showToast('Funds distributed!', 'success');
      loadSplits();
    } catch (err: any) {
      showToast(err.message || 'Distribution failed', 'error');
    }
  }

  async function handleClaim(split: DeployedSplit): Promise<void> {
    try {
      const pubkey = store.getState().wallet.publicKey!;
      const tx = await buildClaimTx(
        new PublicKey(split.address),
        new PublicKey(pubkey),
      );
      const sig = await signAndSendTransaction(tx);
      showToast('Funds claimed!', 'success');
      loadSplits();
    } catch (err: any) {
      showToast(err.message || 'Claim failed', 'error');
    }
  }
}
