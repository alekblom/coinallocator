import type { AppState } from './types';

type SliceKey = keyof AppState;
type Listener = (state: AppState) => void;

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function createInitialState(): AppState {
  return {
    wallet: {
      connected: false,
      publicKey: null,
      walletName: null,
      balance: null,
    },
    split: {
      name: '',
      recipients: [
        { id: generateId(), address: '', percentage: 50 },
        { id: generateId(), address: '', percentage: 50 },
      ],
    },
    deploy: {
      step: 'preview',
      paymentComplete: false,
      txSignature: null,
      splitAddress: null,
      error: null,
    },
    dashboard: {
      splits: [],
      loading: false,
    },
  };
}

class Store {
  private state: AppState = createInitialState();
  private listeners: Map<string, Set<Listener>> = new Map();

  getState(): Readonly<AppState> {
    return this.state;
  }

  update<K extends SliceKey>(slice: K, partial: Partial<AppState[K]>): void {
    (this.state[slice] as any) = { ...(this.state[slice] as any), ...partial };
    this.notify(slice);
    this.notify('*');
  }

  set<K extends SliceKey>(slice: K, value: AppState[K]): void {
    this.state[slice] = value;
    this.notify(slice);
    this.notify('*');
  }

  subscribe(key: SliceKey | '*', fn: Listener): () => void {
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key)!.add(fn);
    return () => this.listeners.get(key)!.delete(fn);
  }

  private notify(key: string): void {
    this.listeners.get(key)?.forEach(fn => fn(this.state));
  }

  resetDeploy(): void {
    this.state.deploy = {
      step: 'preview',
      paymentComplete: false,
      txSignature: null,
      splitAddress: null,
      error: null,
    };
    this.notify('deploy');
    this.notify('*');
  }
}

export const store = new Store();
export { generateId };
