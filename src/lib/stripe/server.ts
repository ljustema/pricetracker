import Stripe from 'stripe';

// Ensure environment variable is defined
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error("Missing env.STRIPE_SECRET_KEY");
}

// Initialize Stripe with the secret key
export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-02-24.acacia', // Use the latest stable API version
  appInfo: {
    name: 'PriceTracker SaaS',
    version: '1.0.0',
  },
});

// Define subscription plan IDs
// These should match the product/price IDs in your Stripe dashboard
export const PLANS = {
  FREE: 'free', // Not a Stripe product, handled in app logic
  BASIC: 'price_basic', // Replace with actual Stripe price ID
  PRO: 'price_pro', // Replace with actual Stripe price ID
} as const;

// Define plan features and limits
export const PLAN_DETAILS = {
  [PLANS.FREE]: {
    name: 'Free',
    description: 'For individuals just getting started',
    price: 0,
    competitors: 1,
    products: 100,
    historyDays: 30,
  },
  [PLANS.BASIC]: {
    name: 'Basic',
    description: 'For small businesses',
    price: 5,
    competitors: 5,
    products: 500,
    historyDays: 90,
  },
  [PLANS.PRO]: {
    name: 'Pro',
    description: 'For growing businesses',
    price: 10,
    competitors: 10,
    products: 1000,
    historyDays: 180,
  },
};

// Helper to create a checkout session
export async function createCheckoutSession({
  priceId,
  userId,
  returnUrl,
}: {
  priceId: string;
  userId: string;
  returnUrl: string;
}) {
  if (!priceId) {
    throw new Error('Price ID is required');
  }

  // Create a checkout session with Stripe
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    billing_address_collection: 'auto',
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    allow_promotion_codes: true,
    success_url: `${returnUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${returnUrl}/canceled`,
    metadata: {
      userId,
    },
  });

  return session;
}

// Helper to create a billing portal session
export async function createBillingPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string;
  returnUrl: string;
}) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session;
}

// Helper to get subscription data
export async function getSubscription(subscriptionId: string) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['customer', 'default_payment_method', 'items.data.price.product'],
  });

  return subscription;
}