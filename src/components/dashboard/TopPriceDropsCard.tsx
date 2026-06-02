"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PriceChangeDisplay from "@/components/dashboard/PriceChangeDisplay";

export interface TopPriceDrop {
  id: string;
  product_id: string;
  old_competitor_price?: number;
  new_competitor_price?: number;
  old_our_retail_price?: number;
  new_our_retail_price?: number;
  competitor_id?: string;
  integration_id?: string;
  changed_at: string;
  price_change_percentage: number;
  products: {
    name: string;
    sku: string;
    image_url?: string;
  };
  competitors?: { name: string };
  integrations?: { name: string };
}

interface TopPriceDropsCardProps {
  drops: TopPriceDrop[];
}

function PriceDropRow({ priceChange }: { priceChange: TopPriceDrop }) {
  return (
    <div className="flex items-center">
      <div className="flex-shrink-0">
        {priceChange.products.image_url ? (
          <Image
            src={priceChange.products.image_url}
            alt={priceChange.products.name}
            width={48}
            height={48}
            className="rounded-md"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gray-100">
            <svg
              className="h-6 w-6 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
      </div>
      <div className="ml-4 flex-1 min-w-0">
        <Link href={`/app-routes/products/${priceChange.product_id}`}>
          <h3 className="text-base font-medium text-gray-900 hover:text-indigo-600 truncate">
            {priceChange.products.name}
          </h3>
        </Link>
        <p className="text-sm text-gray-500 truncate">
          {priceChange.competitors?.name || priceChange.integrations?.name || "Unknown"} • SKU: {priceChange.products.sku}
        </p>
      </div>
      <PriceChangeDisplay
        oldPrice={
          priceChange.competitor_id
            ? (priceChange.old_competitor_price || 0)
            : (priceChange.old_our_retail_price || 0)
        }
        newPrice={
          priceChange.competitor_id
            ? (priceChange.new_competitor_price || 0)
            : (priceChange.new_our_retail_price || 0)
        }
        currencyCode={"SEK"}
        percentage={priceChange.price_change_percentage}
      />
    </div>
  );
}

export default function TopPriceDropsCard({ drops }: TopPriceDropsCardProps) {
  const [open, setOpen] = useState(false);
  const top5 = drops.slice(0, 5);

  if (drops.length === 0) {
    return (
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <p className="text-center text-gray-500">No price drops detected in the last 7 days.</p>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full text-left rounded-lg bg-white p-6 shadow-sm transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        aria-label={`Visa topp ${Math.min(drops.length, 100)} prisfall`}
      >
        <div className="divide-y">
          {top5.map((priceChange) => (
            <div key={priceChange.id} className="py-4 first:pt-0 last:pb-0">
              <PriceDropRow priceChange={priceChange} />
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-end text-sm font-medium text-indigo-600">
          Visa topp {Math.min(drops.length, 100)}
          <ChevronRight className="ml-1 h-4 w-4" />
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Top Price Drops (Last 7 Days) — Topp {Math.min(drops.length, 100)}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto pr-2 -mr-2 divide-y">
            {drops.slice(0, 100).map((priceChange, idx) => (
              <div key={priceChange.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start gap-3">
                  <span className="mt-3 w-6 shrink-0 text-right text-xs font-medium text-gray-400 tabular-nums">
                    {idx + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <PriceDropRow priceChange={priceChange} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
