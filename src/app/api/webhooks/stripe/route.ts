import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

// Ensure environment variable is defined
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// This is your Stripe webhook handler for handling subscription events
export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature || !stripeWebhookSecret) {
    return new NextResponse('Webhook signature or secret missing', { status: 400 });
  }

  let event;

  try {
    // Verify the webhook signature
    event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return new NextResponse('Webhook signature verification failed', { status: 400 });
  }

  // Initialize Supabase admin client for database operations
  const supabase = createSupabaseAdminClient();

  // Handle the event based on its type
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        
        // Extract the customer and subscription IDs
        const { customer, subscription, metadata } = session;
        const { userId } = metadata || {};

        if (!userId) {
          console.error('No userId found in session metadata');
          return new NextResponse('No userId found in session metadata', { status: 400 });
        }

        // Update the user's subscription information in Supabase
        const { error } = await supabase
          .from('user_subscriptions')
          .upsert({
            user_id: userId,
            stripe_customer_id: customer as string,
            stripe_subscription_id: subscription as string,
            status: 'active',
            updated_at: new Date().toISOString(),
          });

        if (error) {
          console.error('Error updating subscription in database:', error);
          return new NextResponse('Error updating subscription in database', { status: 500 });
        }

        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        
        // Get the customer ID and status
        const { customer, status, items } = subscription;
        
        // Get the price ID from the subscription items
        const priceId = items.data[0]?.price.id;

        // Find the user with this Stripe customer ID
        const { data: users, error: findError } = await supabase
          .from('user_subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customer)
          .single();

        if (findError || !users) {
          console.error('Error finding user with customer ID:', findError);
          return new NextResponse('Error finding user with customer ID', { status: 500 });
        }

        // Update the subscription status and price ID
        const { error: updateError } = await supabase
          .from('user_subscriptions')
          .update({
            status,
            price_id: priceId,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customer);

        if (updateError) {
          console.error('Error updating subscription status:', updateError);
          return new NextResponse('Error updating subscription status', { status: 500 });
        }

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        
        // Get the customer ID
        const { customer } = subscription;

        // Update the subscription status to canceled
        const { error } = await supabase
          .from('user_subscriptions')
          .update({
            status: 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customer);

        if (error) {
          console.error('Error updating subscription to canceled:', error);
          return new NextResponse('Error updating subscription to canceled', { status: 500 });
        }

        break;
      }

      // Add more event types as needed

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    return new NextResponse(JSON.stringify({ received: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new NextResponse('Webhook handler failed', { status: 500 });
  }
}