"use client";

import { loadStripe, Stripe } from "@stripe/stripe-js";

// Ensure environment variable is defined
const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

if (!stripePublishableKey) {
  throw new Error("Missing env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
}

// Initialize Stripe with the publishable key
let stripePromise: Promise<Stripe | null>;

// Export a function to get the Stripe promise (singleton pattern)
export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(stripePublishableKey);
  }
  return stripePromise;
};