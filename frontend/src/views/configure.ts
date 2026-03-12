import { store, generateId } from '../state';
import { navigate } from '../router';
import { $ } from '../utils/dom';
import { validateRecipients } from '../utils/validation';
import { truncateAddress } from '../utils/format';
import { SPLIT_COLORS, MAX_RECIPIENTS } from '../constants';
import { getActiveChain } from '../chain/manager';
import { isEvmChain } from '../evm/networks';
import type { RecipientConfig } from '../types';

function getAddressPlaceholder(): string {
  const chain = getActiveChain();
  if (chain === 'sui') return 'Sui wallet address (0x...)';
  if (isEvmChain(chain)) return 'EVM wallet address (0x...)';
  return 'Solana wallet address';
}

export function renderConfigure(outlet: HTMLElement): void {
  outlet.innerHTML = `
    <div class="configure-page fade-in">
      <h1>Configure Your Split</h1>
      <p class="configure-subtitle">Set up recipients and their share percentages. Percentages must total 100%.</p>

      <div class="configure-layout">
        <div class="configure-form">
          <div class="split-name-input">
            <label>Split Name</label>
            <input class="input" type="text" id="split-name" placeholder="e.g. Team Revenue Split" maxlength="32" />
          </div>

          <div class="recipients-header">
            <h2>Recipients</h2>
            <span class="text-muted" id="recipient-count"></span>
          </div>

          <div id="recipients-list"></div>

          <button class="add-recipient-btn" id="add-recipient">
            + Add Recipient
          </button>

          <div class="allocation-bar">
            <div class="allocation-bar-inner" id="allocation-bar"></div>
          </div>
          <div class="allocation-status">
            <span id="allocation-total"></span>
            <span class="allocation-remaining" id="allocation-remaining"></span>
          </div>

          <div id="validation-errors" style="color: var(--color-error); font-size: var(--font-size-sm);"></div>

          <div class="configure-actions">
            <button class="btn-primary" id="continue-deploy" disabled>
              Continue to Deploy
            </button>
          </div>
        </div>

        <div class="configure-sidebar">
          <div class="preview-card">
            <h3>Split Preview</h3>
            <div class="donut-chart" id="donut-chart">
              <div class="donut-chart-inner">
                <span class="donut-chart-total" id="donut-total">0%</span>
                <span class="donut-chart-label">allocated</span>
              </div>
            </div>
            <div class="legend" id="legend"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  const state = store.getState();

  // Set initial name
  const nameInput = $('#split-name', outlet) as HTMLInputElement;
  nameInput.value = state.split.name;
  nameInput.addEventListener('input', () => {
    store.update('split', { name: nameInput.value });
  });

  renderRecipients();
  updatePreview();

  // Add recipient
  $('#add-recipient', outlet)?.addEventListener('click', () => {
    const { recipients } = store.getState().split;
    if (recipients.length >= MAX_RECIPIENTS) return;
    store.update('split', {
      recipients: [...recipients, { id: generateId(), address: '', percentage: 0, label: '' }],
    });
    renderRecipients();
    updatePreview();
  });

  // Continue
  $('#continue-deploy', outlet)?.addEventListener('click', () => {
    const { recipients } = store.getState().split;
    const { valid } = validateRecipients(recipients);
    const name = store.getState().split.name.trim();
    if (valid && name) {
      store.resetDeploy();
      navigate('/deploy');
    }
  });

  function renderRecipients(): void {
    const list = $('#recipients-list', outlet)!;
    const { recipients } = store.getState().split;

    list.innerHTML = recipients.map((r, i) => `
      <div class="recipient-row" data-id="${r.id}">
        <div class="label-input">
          <input class="input" type="text" placeholder="Label (optional)"
            value="${r.label || ''}" data-field="label" data-index="${i}" maxlength="24" />
        </div>
        <div class="address-input">
          <input class="input input-mono" type="text" placeholder="${getAddressPlaceholder()}"
            value="${r.address}" data-field="address" data-index="${i}" />
        </div>
        <div class="percent-input">
          <input class="input" type="number" step="0.01" min="0" max="100"
            placeholder="%" value="${r.percentage || ''}" data-field="percentage" data-index="${i}" />
          <span class="percent-suffix">%</span>
        </div>
        <button class="remove-btn" data-remove="${i}" ${recipients.length <= 1 ? 'disabled style="opacity:0.2"' : ''}>
          \u2715
        </button>
      </div>
    `).join('');

    $('#recipient-count', outlet)!.textContent = `${recipients.length} / ${MAX_RECIPIENTS}`;

    // Input handlers
    list.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', (e) => {
        const el = e.target as HTMLInputElement;
        const idx = parseInt(el.dataset.index!);
        const field = el.dataset.field as 'address' | 'percentage' | 'label';
        const { recipients } = store.getState().split;
        const updated = [...recipients];

        if (field === 'percentage') {
          updated[idx] = { ...updated[idx], percentage: parseFloat(el.value) || 0 };
        } else if (field === 'label') {
          updated[idx] = { ...updated[idx], label: el.value };
        } else {
          updated[idx] = { ...updated[idx], address: el.value };
        }

        store.update('split', { recipients: updated });
        updatePreview();
      });
    });

    // Remove handlers
    list.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt((btn as HTMLElement).dataset.remove!);
        const { recipients } = store.getState().split;
        if (recipients.length <= 1) return;
        const updated = recipients.filter((_, i) => i !== idx);
        store.update('split', { recipients: updated });
        renderRecipients();
        updatePreview();
      });
    });
  }

  function updatePreview(): void {
    const { recipients } = store.getState().split;
    const { valid, totalPercent, errors } = validateRecipients(recipients);

    // Donut chart
    const chart = $('#donut-chart', outlet)!;
    const segments: string[] = [];
    let cumulative = 0;

    recipients.forEach((r, i) => {
      if (r.percentage > 0) {
        const start = cumulative;
        cumulative += r.percentage;
        segments.push(`${SPLIT_COLORS[i % SPLIT_COLORS.length]} ${start}% ${cumulative}%`);
      }
    });

    if (segments.length > 0) {
      chart.style.background = `conic-gradient(${segments.join(', ')}${cumulative < 100 ? `, var(--color-bg-tertiary) ${cumulative}% 100%` : ''})`;
    } else {
      chart.style.background = 'var(--color-bg-tertiary)';
    }

    $('#donut-total', outlet)!.textContent = `${Math.round(totalPercent)}%`;

    // Legend
    const legend = $('#legend', outlet)!;
    legend.innerHTML = recipients
      .filter(r => r.address || r.percentage > 0)
      .map((r, i) => `
        <div class="legend-item">
          <span class="legend-dot" style="background: ${SPLIT_COLORS[i % SPLIT_COLORS.length]}"></span>
          <span class="legend-address">${r.label || (r.address ? truncateAddress(r.address, 6) : 'No address')}</span>
          <span class="legend-percent">${r.percentage}%</span>
        </div>
      `).join('');

    // Allocation bar
    const bar = $('#allocation-bar', outlet)!;
    const clamped = Math.min(totalPercent, 100);
    bar.style.width = `${clamped}%`;

    if (totalPercent === 100) {
      bar.style.background = 'var(--color-success)';
    } else if (totalPercent > 100) {
      bar.style.background = 'var(--color-error)';
    } else {
      bar.style.background = 'var(--color-gradient)';
    }

    $('#allocation-total', outlet)!.textContent = `${totalPercent}% allocated`;

    const remaining = $('#allocation-remaining', outlet)!;
    const diff = 100 - totalPercent;
    remaining.className = 'allocation-remaining';
    if (diff === 0) {
      remaining.textContent = 'Complete';
      remaining.classList.add('complete');
    } else if (diff < 0) {
      remaining.textContent = `${Math.abs(diff)}% over`;
      remaining.classList.add('over');
    } else {
      remaining.textContent = `${diff}% remaining`;
    }

    // Errors
    const errEl = $('#validation-errors', outlet)!;
    errEl.innerHTML = errors.map(e => `<div>${e}</div>`).join('');

    // Continue button
    const continueBtn = $('#continue-deploy', outlet) as HTMLButtonElement;
    const name = store.getState().split.name.trim();
    continueBtn.disabled = !valid || !name;
  }
}
