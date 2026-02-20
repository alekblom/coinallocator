import { store } from '../state';
import { navigate } from '../router';
import { $ } from '../utils/dom';
import { truncateAddress, percentToBps } from '../utils/format';
import { initiatePayment } from '../utils/stripe';
import { buildCreateSplitTx } from '../solana/program';
import { deriveSplitPDA, nameToBytes } from '../solana/pda';
import { signAndSendTransaction } from '../wallet/adapter';
import { showToast } from '../components/toast';
import { SPLIT_COLORS, EXPLORER_URL, SOLANA_NETWORK, PLATFORM_FEE } from '../constants';
import { PublicKey } from '@solana/web3.js';

export function renderDeploy(outlet: HTMLElement): (() => void) | void {
  const { split, wallet } = store.getState();

  if (!split.recipients.length || !wallet.publicKey) {
    navigate('/configure');
    return;
  }

  // Derive PDA
  const nameBytes = nameToBytes(split.name);
  const [splitPda] = deriveSplitPDA(new PublicKey(wallet.publicKey), nameBytes);

  render();

  function render(): void {
    const { step } = store.getState().deploy;

    outlet.innerHTML = `
      <div class="deploy-page fade-in">
        <h1>Deploy Your Split</h1>
        <p class="deploy-subtitle">Review and deploy your fund-splitting contract to Solana.</p>

        <div class="deploy-steps">
          <div class="deploy-step ${step === 'preview' ? 'active' : ['payment', 'deploying', 'done'].includes(step) ? 'done' : ''}">
            <span class="deploy-step-num">1</span>
            <span>Review</span>
          </div>
          <div class="deploy-step ${step === 'payment' ? 'active' : ['deploying', 'done'].includes(step) ? 'done' : ''}">
            <span class="deploy-step-num">2</span>
            <span>Payment</span>
          </div>
          <div class="deploy-step ${step === 'deploying' ? 'active' : step === 'done' ? 'done' : ''}">
            <span class="deploy-step-num">3</span>
            <span>Deploy</span>
          </div>
        </div>

        <div class="deploy-content" id="deploy-content"></div>
      </div>
    `;

    const content = $('#deploy-content', outlet)!;

    switch (step) {
      case 'preview':
        renderPreview(content);
        break;
      case 'payment':
        renderPayment(content);
        break;
      case 'deploying':
        renderDeploying(content);
        break;
      case 'done':
        renderSuccess(content);
        break;
      case 'error':
        renderError(content);
        break;
    }
  }

  function renderPreview(content: HTMLElement): void {
    content.innerHTML = `
      <div class="deploy-preview">
        <h3>Split Configuration</h3>
        <div class="deploy-detail">
          <span class="deploy-detail-label">Name</span>
          <span class="deploy-detail-value">${split.name}</span>
        </div>
        <div class="deploy-detail">
          <span class="deploy-detail-label">Network</span>
          <span class="deploy-detail-value">${SOLANA_NETWORK}</span>
        </div>
        <div class="deploy-detail">
          <span class="deploy-detail-label">Split Address</span>
          <span class="deploy-detail-value">${truncateAddress(splitPda.toBase58(), 6)}</span>
        </div>
        <div class="deploy-detail">
          <span class="deploy-detail-label">Recipients</span>
          <span class="deploy-detail-value">${split.recipients.length}</span>
        </div>
        <div class="deploy-detail">
          <span class="deploy-detail-label">Platform Fee</span>
          <span class="deploy-detail-value">$${PLATFORM_FEE}</span>
        </div>

        <div class="deploy-recipients" style="margin-top: var(--space-6)">
          <h3 style="margin-bottom: var(--space-3)">Recipients</h3>
          ${split.recipients.map((r, i) => `
            <div class="deploy-recipient">
              <span class="deploy-recipient-address" style="color: ${SPLIT_COLORS[i]}">${truncateAddress(r.address, 6)}</span>
              <span class="deploy-recipient-share">${r.percentage}%</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="deploy-actions">
        <button class="btn-secondary" id="deploy-back">Back to Configure</button>
        <button class="btn-primary" id="deploy-pay">Pay & Deploy - $${PLATFORM_FEE}</button>
      </div>
    `;

    $('#deploy-back', content)?.addEventListener('click', () => navigate('/configure'));
    $('#deploy-pay', content)?.addEventListener('click', async () => {
      store.update('deploy', { step: 'payment' });
      render();
      await handlePayAndDeploy();
    });
  }

  function renderPayment(content: HTMLElement): void {
    content.innerHTML = `
      <div class="payment-section">
        <div class="deploying-spinner"></div>
        <div class="payment-amount text-gradient">$${PLATFORM_FEE}</div>
        <p class="payment-desc">Processing payment...</p>
        <p class="text-muted" style="font-size: var(--font-size-xs)">
          Payment via Stripe (stub - auto-completing for demo)
        </p>
      </div>
    `;
  }

  function renderDeploying(content: HTMLElement): void {
    content.innerHTML = `
      <div class="deploying-section">
        <div class="deploying-spinner"></div>
        <div class="deploying-text">Deploying to Solana ${SOLANA_NETWORK}...</div>
        <div class="deploying-subtext">Please approve the transaction in your wallet</div>
      </div>
    `;
  }

  function renderSuccess(content: HTMLElement): void {
    const { txSignature, splitAddress } = store.getState().deploy;

    content.innerHTML = `
      <div class="deploy-success">
        <div class="success-icon">\u2713</div>
        <div class="success-title">Split Deployed!</div>
        <div class="success-address">${splitAddress || ''}</div>
        <p class="text-muted" style="margin-bottom: var(--space-6)">
          Your fund-splitting contract is now live on Solana ${SOLANA_NETWORK}.
          Share the address above to receive funds.
        </p>
        <div class="success-actions">
          ${txSignature ? `<a href="${EXPLORER_URL}/tx/${txSignature}?cluster=${SOLANA_NETWORK}" target="_blank" class="btn-secondary">View Transaction</a>` : ''}
          <button class="btn-primary" id="goto-dashboard">Go to Dashboard</button>
        </div>
      </div>
    `;

    $('#goto-dashboard', content)?.addEventListener('click', () => navigate('/dashboard'));
  }

  function renderError(content: HTMLElement): void {
    const { error } = store.getState().deploy;
    content.innerHTML = `
      <div class="deploy-error">
        <div style="font-size: 48px; margin-bottom: var(--space-4)">\u2717</div>
        <h2>Deployment Failed</h2>
        <p style="margin: var(--space-4) 0">${error || 'Unknown error'}</p>
        <button class="btn-secondary" id="deploy-retry">Try Again</button>
      </div>
    `;

    $('#deploy-retry', content)?.addEventListener('click', () => {
      store.resetDeploy();
      render();
    });
  }

  async function handlePayAndDeploy(): Promise<void> {
    try {
      // Step 1: Payment (stub)
      await initiatePayment();

      // Step 2: Deploy
      store.update('deploy', { step: 'deploying' });
      render();

      const { tx, splitAddress } = await buildCreateSplitTx(
        new PublicKey(wallet.publicKey!),
        split.name,
        split.recipients,
      );

      const sig = await signAndSendTransaction(tx);

      store.update('deploy', {
        step: 'done',
        txSignature: sig,
        splitAddress: splitAddress.toBase58(),
      });
      render();
      showToast('Split deployed successfully!', 'success');
    } catch (err: any) {
      store.update('deploy', {
        step: 'error',
        error: err.message || 'Deployment failed',
      });
      render();
      showToast('Deployment failed', 'error');
    }
  }

  const unsub = store.subscribe('deploy', () => render());
  return () => unsub();
}
