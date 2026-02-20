import './styles/variables.css';
import './styles/reset.css';
import './styles/components.css';
import './styles/nav.css';
import './styles/landing.css';
import './styles/configure.css';
import './styles/deploy.css';
import './styles/dashboard.css';
import './styles/wallet.css';

import { initRouter, registerRoute, updateActiveNav } from './router';
import { initWallet } from './wallet/adapter';
import { createNav } from './components/nav';
import { renderLanding } from './views/landing';
import { renderConfigure } from './views/configure';
import { renderDeploy } from './views/deploy';
import { renderDashboard } from './views/dashboard';

function bootstrap(): void {
  const app = document.getElementById('app')!;

  // Navigation
  app.appendChild(createNav());

  // Route outlet
  const outlet = document.createElement('main');
  outlet.id = 'route-outlet';
  app.appendChild(outlet);

  // Initialize wallet adapters
  initWallet();

  // Register routes
  registerRoute('/', renderLanding);
  registerRoute('/configure', renderConfigure, true);
  registerRoute('/deploy', renderDeploy, true);
  registerRoute('/dashboard', renderDashboard, true);

  // Start router
  initRouter(outlet);
  updateActiveNav();
}

document.addEventListener('DOMContentLoaded', bootstrap);
