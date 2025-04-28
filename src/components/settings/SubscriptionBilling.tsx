"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { AlertCircle, CheckCircle, CreditCard, Calendar, ArrowRight } from "lucide-react";

interface SubscriptionBillingProps {
  userId?: string;
}

interface Subscription {
  id: string;
  status: string;
  price_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  created_at: string;
  updated_at: string;
}

export default function SubscriptionBilling({ userId }: SubscriptionBillingProps) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Placeholder data for UI demonstration
  const plans = [
    {
      name: "Free",
      price: "0",
      features: ["5 competitors", "Basic analytics", "Manual scraping"],
      current: subscription?.price_id === "free" || !subscription,
    },
    {
      name: "Pro",
      price: "29",
      features: ["20 competitors", "Advanced analytics", "Automated scraping", "Email alerts"],
      current: subscription?.price_id === "pro",
    },
    {
      name: "Enterprise",
      price: "99",
      features: ["Unlimited competitors", "Full analytics suite", "Priority support", "API access", "Custom integrations"],
      current: subscription?.price_id === "enterprise",
    },
  ];

  // Placeholder billing history
  const billingHistory = [
    {
      id: "inv_123456",
      date: "2023-05-01",
      amount: "29.00",
      status: "paid",
    },
    {
      id: "inv_123455",
      date: "2023-04-01",
      amount: "29.00",
      status: "paid",
    },
  ];

  // Fetch subscription data
  useEffect(() => {
    const fetchSubscription = async () => {
      if (!userId) return;

      try {
        setIsLoading(true);
        // This would be replaced with an actual API call in production
        // const response = await fetch("/api/settings/subscription");

        // For now, just simulate a response
        setTimeout(() => {
          setSubscription({
            id: "sub_123456",
            status: "active",
            price_id: "free",
            stripe_customer_id: "cus_123456",
            stripe_subscription_id: "sub_123456",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          setIsLoading(false);
        }, 1000);
      } catch (error) {
        console.error("Error fetching subscription:", error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to fetch subscription data",
          variant: "destructive",
        });
        setIsLoading(false);
      }
    };

    fetchSubscription();
  }, [userId, toast]);

  const handleUpgrade = (planName: string) => {
    toast({
      title: "Coming Soon",
      description: `Upgrade to ${planName} will be available soon.`,
    });
  };

  const handleManagePaymentMethods = () => {
    toast({
      title: "Coming Soon",
      description: "Payment method management will be available soon.",
    });
  };

  const handleCancelSubscription = () => {
    toast({
      title: "Coming Soon",
      description: "Subscription cancellation will be available soon.",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>
            Your current subscription plan and status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">
                {plans.find(p => p.current)?.name || "Free"} Plan
              </h3>
              <p className="text-sm text-gray-500">
                {subscription?.status === "active" ? (
                  <span className="flex items-center text-green-600">
                    <CheckCircle className="mr-1 h-4 w-4" />
                    Active
                  </span>
                ) : (
                  <span className="flex items-center text-yellow-600">
                    <AlertCircle className="mr-1 h-4 w-4" />
                    Inactive
                  </span>
                )}
              </p>
            </div>
            <Badge variant="outline" className="text-lg">
              ${plans.find(p => p.current)?.price || "0"}/month
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
          <CardDescription>
            Compare plans and upgrade your subscription
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-lg border p-4 ${
                  plan.current
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-gray-200"
                }`}
              >
                <h3 className="text-lg font-medium">{plan.name}</h3>
                <p className="mb-4 text-2xl font-bold">${plan.price}/month</p>
                <ul className="mb-4 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center text-sm">
                      <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {plan.current ? (
                  <Badge className="w-full justify-center py-1">Current Plan</Badge>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleUpgrade(plan.name)}
                  >
                    Upgrade
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
          <CardDescription>
            View your past invoices and payment history
          </CardDescription>
        </CardHeader>
        <CardContent>
          {billingHistory.length > 0 ? (
            <div className="space-y-4">
              {billingHistory.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex items-center">
                    <Calendar className="mr-3 h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium">Invoice #{invoice.id}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(invoice.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <p className="mr-4 font-medium">${invoice.amount}</p>
                    <Badge
                      variant={invoice.status === "paid" ? "default" : "destructive"}
                    >
                      {invoice.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500">No billing history available</p>
          )}
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button variant="outline" disabled>
            View All Invoices
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment Methods</CardTitle>
          <CardDescription>
            Manage your payment methods and billing information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-gray-200 p-4">
            <div className="flex items-center">
              <CreditCard className="mr-3 h-5 w-5 text-gray-400" />
              <div>
                <p className="font-medium">No payment methods</p>
                <p className="text-sm text-gray-500">
                  Add a payment method to upgrade your plan
                </p>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button variant="outline" onClick={handleManagePaymentMethods}>
            Manage Payment Methods
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cancel Subscription</CardTitle>
          <CardDescription>
            Cancel your current subscription plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">
            Your subscription will remain active until the end of your current billing period.
            After that, your account will be downgraded to the Free plan.
          </p>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button variant="destructive" onClick={handleCancelSubscription}>
            Cancel Subscription
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
