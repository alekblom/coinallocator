import { store } from './state';

type RouteHandler = (outlet: HTMLElement, params?: Record<string, string>) => (() => void) | void;

interface Route {
  path: string;
  render: RouteHandler;
  requiresAuth?: boolean;
  pattern?: RegExp;
  paramNames?: string[];
}

const routes: Route[] = [];
let currentCleanup: (() => void) | null = null;
let outlet: HTMLElement | null = null;

function compilePath(path: string): { pattern: RegExp; paramNames: string[] } | null {
  const paramNames: string[] = [];
  const parts = path.split('/');
  let hasParams = false;

  const regexParts = parts.map(part => {
    if (part.startsWith(':')) {
      hasParams = true;
      paramNames.push(part.slice(1));
      return '([^/]+)';
    }
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });

  if (!hasParams) return null;
  return { pattern: new RegExp(`^${regexParts.join('/')}$`), paramNames };
}

export function registerRoute(path: string, render: RouteHandler, requiresAuth = false): void {
  const compiled = compilePath(path);
  routes.push({
    path,
    render,
    requiresAuth,
    pattern: compiled?.pattern,
    paramNames: compiled?.paramNames,
  });
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

  // Try exact match first
  let route = routes.find(r => r.path === hash);
  let params: Record<string, string> | undefined;

  // Then try pattern match
  if (!route) {
    for (const r of routes) {
      if (!r.pattern) continue;
      const match = hash.match(r.pattern);
      if (match) {
        route = r;
        params = {};
        r.paramNames!.forEach((name, i) => {
          params![name] = match[i + 1];
        });
        break;
      }
    }
  }

  if (!route) {
    navigate('/');
    return;
  }

  if (route.requiresAuth) {
    const BA = (window as any).BuidlingsAuth;
    if (typeof BA !== 'undefined' && !BA.isLoggedIn()) {
      navigate('/');
      return;
    }
  }

  outlet.innerHTML = '';
  const cleanup = route.render(outlet, params);
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
