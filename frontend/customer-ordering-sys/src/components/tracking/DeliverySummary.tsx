/**
 * src/components/tracking/DeliverySummary.tsx
 * UC-9 — Delivery info panel (ETA + address)
 */
import React from 'react';
import { Order } from '../../services/api';

interface Props {
  order: Order;
}

export default function DeliverySummary({ order }: Props) {
  const { delivery_address, restaurant_name } = order;

  return (
    <section
      className="glass-card inner-glow rounded-3xl p-lg animate-in slide-in-from-left duration-700"
      aria-label="Delivery summary"
    >
      <div className="flex justify-between items-start mb-md">
        <div>
          <p className="font-label-caps text-label-caps text-primary mb-xs">
            RESTAURANT
          </p>
          <h2 className="font-headline-md text-headline-md text-on-surface">
            {restaurant_name}
          </h2>
        </div>
        <div className="p-base bg-primary-container rounded-xl" aria-hidden="true">
          <span
            className="material-symbols-outlined text-primary"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            restaurant
          </span>
        </div>
      </div>

      <div className="h-px bg-outline-variant/20 w-full mb-md" />

      <div className="space-y-sm">
        {/* Delivery address */}
        <div className="flex items-start gap-sm">
          <span
            className="material-symbols-outlined text-on-surface-variant text-[20px] mt-0.5"
            aria-hidden="true"
          >
            location_on
          </span>
          <div>
            <p className="text-on-surface-variant font-body-md text-[14px]">
              Delivering to
            </p>
            <p className="text-on-surface font-body-md font-medium">
              {delivery_address.street}
            </p>
            <p className="text-on-surface font-body-md font-medium">
              {delivery_address.city}
            </p>
            {delivery_address.notes && (
              <p className="text-on-surface-variant font-body-md text-[14px]">
                {delivery_address.notes}
              </p>
            )}
          </div>
        </div>

        {/* Order ID */}
        <div className="flex items-start gap-sm">
          <span
            className="material-symbols-outlined text-on-surface-variant text-[20px] mt-0.5"
            aria-hidden="true"
          >
            receipt_long
          </span>
          <div>
            <p className="text-on-surface-variant font-body-md text-[14px]">
              Order ID
            </p>
            <p
              className="text-on-surface font-label-caps text-label-caps"
              data-testid="order-id"
            >
              {order.order_id}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
