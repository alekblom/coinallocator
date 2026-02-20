import { store } from './state';

type RouteHandler = (outlet: HTMLElement) => (() => void) | void;

interface Route {
  path: string;
  render: RouteHandler;
  requiresWallet?: boolean;
}

const routes: Route[] = [];
let currentCleanup: (() => void) | null = null;
let outlet: HTMLElement | null = null;

export function registerRoute(path: string, render: RouteHandler, requiresWallet = false): void {
  routes.push({ path, render, requiresWallet });
}

export function navigate(path: string): void {
  window.location.hash = path;
}

export function getCurrentPath(): string {
  return window.location.hash.slice(1) || '/';
}

function resolve(): void {
  if (!outlet) return;

  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }

  const hash = getCurrentPath();
  const route = routes.find(r => r.path === hash);

  if (!route) {
    navigate('/');
    return;
  }

  if (route.requiresWallet && !store.getState().wallet.connected) {
    navigate('/');
    return;
  }

  outlet.innerHTML = '';
  const cleanup = route.render(outlet);
  if (cleanup) currentCleanup = cleanup;
}

export function initRouter(el: HTMLElement): void {
  outlet = el;
  window.addEventListener('hashchange', resolve);
  resolve();
}

export function updateActiveNav(): void {
  const path = getCurrentPath();
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('data-route');
    if (href === path) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}
