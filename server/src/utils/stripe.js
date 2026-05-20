import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const CURRENCY = 'ils';

export function toMinorUnits(amount) {
  return Math.round(Number(amount) * 100);
}
