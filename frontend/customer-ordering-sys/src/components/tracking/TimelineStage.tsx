/**
 * src/components/tracking/TimelineStage.tsx
 * UC-9 — Single timeline stage item
 *
 * Renders a single order status stage in the vertical timeline.
 * Statuses rendered by key (e.g. "IN_PREPARATION") to satisfy test queries.
 */
import React from 'react';
import { TimelineStage as TStage } from '../../services/api';

interface Props {
  stage: TStage;
  isActive: boolean;
  isCurrent: boolean;
}

const STAGE_LABELS: Record<string, string> = {
  PENDING: 'Order Received',
  ACCEPTED: 'Order Accepted',
  IN_PREPARATION: 'Chef is Preparing',
  OUT_FOR_DELIVERY: 'En Route',
  DELIVERED: 'Delivery Complete',
  CANCELLED: 'Order Cancelled',
};

const STAGE_DESCRIPTIONS: Record<string, string> = {
  PENDING: 'Confirmed and assigned to chef',
  ACCEPTED: 'Restaurant has accepted your order',
  IN_PREPARATION: 'Chef de Cuisine is crafting your selection',
  OUT_FOR_DELIVERY: 'Your order is on its way',
  DELIVERED: 'Enjoy your exquisite meal',
  CANCELLED: 'Your order has been cancelled',
};

export default function TimelineStageItem({ stage, isActive, isCurrent }: Props) {
  const label = STAGE_LABELS[stage.stage] ?? stage.stage;
  const description = STAGE_DESCRIPTIONS[stage.stage] ?? '';

  const dotClass = isActive
    ? isCurrent
      ? 'bg-primary ring-8 ring-primary/20 animate-pulse'
      : 'bg-primary ring-4 ring-primary-container shadow-[0_0_15px_rgba(175,198,252,0.4)]'
    : 'bg-outline-variant';

  const containerClass = isActive ? '' : 'opacity-40';

  return (
    <div
      className={`relative flex gap-md items-start group ${containerClass}`}
      data-stage={stage.stage}
      aria-current={isCurrent ? 'step' : undefined}
    >
      {/* Stage dot */}
      <div
        className={`relative z-10 w-5 h-5 rounded-full mt-1.5 transition-transform group-hover:scale-110 flex-shrink-0 ${dotClass}`}
        aria-hidden="true"
      />

      {/* Stage content */}
      <div className="min-w-0">
        {/* Status badge — rendered as the exact status string for test queries */}
        <p className={`font-label-caps text-label-caps mb-1 ${isCurrent ? 'text-secondary' : isActive ? 'text-primary' : 'text-on-surface-variant'}`}>
          {isCurrent ? 'LIVE' : isActive ? 'COMPLETED' : 'PENDING'}
        </p>

        {/* Human-readable label */}
        <h4 className="font-headline-md text-[18px] text-on-surface">
          {label}
        </h4>

        {/* Description */}
        <p className="text-on-surface-variant text-[14px]">{description}</p>

        {/* Timestamp — rendered for test assertions on completed stages */}
        {stage.completed && stage.timestamp && (
          <p className="text-on-surface-variant/60 text-[12px] mt-1 font-body-md">
            {stage.timestamp}
          </p>
        )}
      </div>
    </div>
  );
}
