import { navigate } from '../router';

export function renderLanding(outlet: HTMLElement): void {
  outlet.innerHTML = `
    <div class="landing">
      <section class="hero">
        <div class="hero-content">
          <div class="hero-badge">
            <span class="dot"></span>
            Multi-Chain Support
          </div>
          <h1>Split Funds <span class="text-gradient">On-Chain</span></h1>
          <p class="hero-subtitle">
            Deploy smart contracts that automatically split incoming funds
            across multiple wallets. Supports Solana, Sui, Ethereum, Base, and Polygon.
          </p>
          <div class="hero-actions">
            <button class="btn-primary" id="hero-cta">Get Started</button>
            <button class="btn-secondary" id="hero-learn">Learn More</button>
          </div>
        </div>
      </section>

      <section class="features">
        <h2>How <span class="text-gradient">CoinAllocator</span> Works</h2>
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon">\u2699</div>
            <h3>Configure</h3>
            <p>Set up your split with up to 10 recipient wallets and custom percentage allocations.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">\u26a1</div>
            <h3>Deploy</h3>
            <p>Deploy your split as a smart contract on any supported chain. One-time $5 fee, gas costs separate.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">\u2195</div>
            <h3>Distribute</h3>
            <p>Anyone can send funds to your split address. Recipients claim their share anytime.</p>
          </div>
        </div>
      </section>

      <section class="how-it-works">
        <h2>Three Simple Steps</h2>
        <div class="steps">
          <div class="step">
            <div class="step-number">1</div>
            <h3>Add Recipients</h3>
            <p>Enter wallet addresses and set the percentage each should receive.</p>
          </div>
          <div class="step">
            <div class="step-number">2</div>
            <h3>Deploy Contract</h3>
            <p>Review your split, pay the platform fee, and deploy to your chosen chain.</p>
          </div>
          <div class="step">
            <div class="step-number">3</div>
            <h3>Manage & Claim</h3>
            <p>Track balances and distributions from your dashboard.</p>
          </div>
        </div>
      </section>

      <section class="pricing">
        <div class="pricing-card">
          <div class="pricing-amount text-gradient">$5</div>
          <div class="pricing-label">One-time deployment fee</div>
          <div class="pricing-features">
            <div class="pricing-feature">
              <span class="pricing-check">\u2713</span>
              <span>Up to 10 recipient wallets</span>
            </div>
            <div class="pricing-feature">
              <span class="pricing-check">\u2713</span>
              <span>Percentage-based splits</span>
            </div>
            <div class="pricing-feature">
              <span class="pricing-check">\u2713</span>
              <span>On-chain smart contract</span>
            </div>
            <div class="pricing-feature">
              <span class="pricing-check">\u2713</span>
              <span>Push or pull distribution</span>
            </div>
            <div class="pricing-feature">
              <span class="pricing-check">\u2713</span>
              <span>5 chains supported</span>
            </div>
          </div>
          <button class="btn-primary" id="pricing-cta" style="width: 100%">
            Start Building Your Split
          </button>
        </div>
      </section>

      <footer class="footer">
        <p>CoinAllocator &mdash; Multi-chain fund splitting &mdash; A Buidlings product</p>
      </footer>
    </div>
  `;

  const handleCta = () => {
    const BA = (window as any).BuidlingsAuth;
    if (typeof BA !== 'undefined' && !BA.isLoggedIn()) {
      BA.login();
      const handler = () => {
        if (typeof BA !== 'undefined' && BA.isLoggedIn()) {
          window.removeEventListener('focus', handler);
          navigate('/configure');
        }
      };
      window.addEventListener('focus', handler);
    } else {
      navigate('/configure');
    }
  };

  outlet.querySelector('#hero-cta')?.addEventListener('click', handleCta);
  outlet.querySelector('#pricing-cta')?.addEventListener('click', handleCta);
  outlet.querySelector('#hero-learn')?.addEventListener('click', () => {
    outlet.querySelector('.features')?.scrollIntoView({ behavior: 'smooth' });
  });
}
