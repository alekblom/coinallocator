import { store } from '../state';

export async function initiatePayment(): Promise<boolean> {
  store.update('deploy', { step: 'payment' });

  // STUB: In production, this would create a Stripe Checkout Session
  // via a backend API at buidlings.com and redirect the user.
  // Statement descriptor: BUIDLINGS* COINALLOCATOR
  return new Promise(resolve => {
    setTimeout(() => {
      store.update('deploy', { paymentComplete: true });
      resolve(true);
    }, 2000);
  });
}
