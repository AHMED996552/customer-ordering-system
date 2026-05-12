import React, { useMemo } from 'react';
import { CardType } from '../utils/checkout.utils';


interface DigitalCardProps {
  cardholder: string;
  cardNumber: string;
  expiry: string;
  cardType: CardType;
}

const DigitalCard: React.FC<DigitalCardProps> = ({
  cardholder,
  cardNumber,
  expiry,
  cardType,
}) => {
  const displayCardNumber = useMemo(() => {
    const raw = cardNumber.replace(/\D/g, '');
    if (!raw) return '••••  ••••  ••••  ••••';
    // Match the HTML style: 4532  ••••  ••••  8821
    const prefix = raw.slice(0, 4);
    const suffix = raw.length > 12 ? raw.slice(-4) : '••••';
    return `${prefix}  ••••  ••••  ${suffix}`;
  }, [cardNumber]);

  return (
    <div className="relative w-full aspect-[1.58/1] max-w-lg mx-auto lg:mx-0 group perspective-1000">
      <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl transition-transform duration-500 transform-gpu group-hover:rotate-y-12">
        <img
          alt="Premium Credit Card"
          className="w-full h-full object-cover"
          src="/assets/creditCard.png"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-surface-dim/80 via-transparent to-surface-bright/20"></div>
        <div className="absolute inset-0 p-lg flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span
              className="material-symbols-outlined text-on-surface/80 text-4xl"
              style={{ fontVariationSettings: '"FILL" 1' }}
            >
                      <img
          alt="Subtract icon"
          className="w-full h-full object-cover"
          src="/assets/Subtract.svg"
        />
            </span>
            <div className="w-16 h-10 bg-on-surface/10 backdrop-blur-md rounded-lg border border-on-surface/20 flex items-center justify-center">
              <div className="w-10 h-6 bg-secondary/40 rounded-sm"></div>
            </div>
          </div>
          <div className="space-y-md">
            <div className="font-label-caps text-xl metallic-text tracking-[0.2em]">
              {displayCardNumber}
            </div>
            <div className="flex justify-between items-end">
              <div className="space-y-xs">
                <p className="font-label-caps text-[10px] text-on-surface/60">CARD HOLDER</p>
                <p className="font-label-caps text-lg metallic-text uppercase truncate max-w-[200px]">
                  {cardholder || 'Julian Thorne'}
                </p>
              </div>
              <div className="space-y-xs" style={{ marginRight: '120px' }}>
                <p className="font-label-caps text-[10px] text-on-surface/60">EXPIRES</p>
                <p className="font-label-caps text-lg metallic-text">{expiry || 'MM/YY'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -inset-4 bg-primary/10 blur-[100px] -z-10 rounded-full"></div>
    </div>
  );
};


export default DigitalCard;
