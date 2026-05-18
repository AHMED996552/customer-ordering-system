/**
 * src/components/tracking/TrackingTimeline.tsx
 * UC-9 — Full order status timeline
 *
 * Renders the 5-stage vertical timeline for the order tracking UI.
 * Timeline is updated live via SSE events passed down from the parent.
 */
import React from 'react';
import { Order, TimelineStage } from '../../services/api';
import TimelineStageItem from './TimelineStage';

const STATUS_ORDER = [
  'PENDING',
  'ACCEPTED',
  'IN_PREPARATION',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

const CANCELLED_STATUS = 'CANCELLED';

interface Props {
  order: Order;
}

export default function TrackingTimeline({ order }: Props) {
  const currentStatus = order.status;
  const timeline: TimelineStage[] = order.status_timeline ?? [];

  const currentIndex = STATUS_ORDER.indexOf(currentStatus);
  const isCancelled = currentStatus === CANCELLED_STATUS;

  // Progress bar height: how far through the timeline we are
  const progressPercent = currentIndex >= 0 ? ((currentIndex) / (STATUS_ORDER.length - 1)) * 100 : 0;

  return (
    <section
      className="glass-card inner-glow rounded-3xl p-lg h-full max-h-[819px] overflow-y-auto"
      aria-label="Order status timeline"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-xl">
        <h3 className="font-headline-md text-headline-md text-[24px] text-on-surface">
          Order Tracking
        </h3>
        <span className="font-label-caps text-label-caps text-on-surface-variant">
          ID: #{order.order_id}
        </span>
      </div>

      {/* Cancelled banner */}
      {isCancelled && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-md p-sm rounded-xl bg-error-container/30 border border-error/20"
        >
          <p className="font-label-caps text-label-caps text-error text-center">
            CANCELLED — This order has been cancelled
          </p>
        </div>
      )}

      {/* Timeline stages */}
      {timeline.length > 0 ? (
        <div className="relative space-y-12 pl-4">
          {/* Vertical connector line */}
          <div className="absolute left-6 top-2 bottom-2 w-[2px] bg-outline-variant/20" aria-hidden="true">
            {!isCancelled && (
              <div
                className="absolute top-0 left-0 w-full bg-gradient-to-b from-primary via-primary to-transparent transition-all duration-700"
                style={{ height: `${progressPercent}%` }}
              />
            )}
          </div>

          {/* Render each stage */}
          <ol aria-label="Order status stages">
            {timeline.map((stage, index) => {
              const stageIndex = STATUS_ORDER.indexOf(stage.stage);
              const isActive = stage.completed || stage.stage === currentStatus;
              const isCurrent = stage.stage === currentStatus && !stage.completed;

              return (
                <li key={stage.stage}>
                  <TimelineStageItem
                    stage={stage}
                    isActive={isActive}
                    isCurrent={isCurrent}
                  />
                </li>
              );
            })}
          </ol>
        </div>
      ) : (
        // Empty timeline fallback
        <div className="text-center py-lg">
          <p className="text-on-surface-variant font-body-md">
            Status updates unavailable
          </p>
        </div>
      )}
    </section>
  );
}
