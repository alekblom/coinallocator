import { store } from '../state';

declare const BuidlingsAuth: any;

export async function initiatePayment(): Promise<boolean> {
  store.update('deploy', { step: 'payment' });

  // Skip credit gate for self-hosted / open-source deployments
  if (typeof BuidlingsAuth === 'undefined') {
    store.update('deploy', { paymentComplete: true });
    return true;
  }

  if (!BuidlingsAuth.isLoggedIn()) {
    throw new Error('Please sign in with your Buidlings account first.');
  }

  const result = await BuidlingsAuth.deduct('coinallocator_deploy');

  if (!result.success) {
    const balance = result.balance_cents?.total ?? 0;
    throw new Error(
      `Insufficient credits. You need $5.00, you have ${BuidlingsAuth.formatUSD(balance)}. ` +
      `Buy credits at ${result.buy_credits_url || 'https://alexiuz.com/credits'}`
    );
  }

  store.update('deploy', { paymentComplete: true });
  return true;
}
