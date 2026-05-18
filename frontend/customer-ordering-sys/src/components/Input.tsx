import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  icon?: string | React.ElementType;
  errors?: string[];
  suffix?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  id,
  label,
  icon: Icon,
  errors = [],
  suffix,
  className = '',
  ...props
}) => {
  const hasErrors = errors.length > 0;
  
  return (
    <div className="space-y-xs w-full">
      <label
        htmlFor={id}
        className="font-label-caps text-label-caps text-on-surface-variant ml-1 block"
      >
        {label}
      </label>
      <div className="relative group">
        {Icon && (
          typeof Icon === 'string' ? (
            <span
              className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors select-none"
              style={{ fontVariationSettings: "'FILL' 0" }}
            >
              {Icon}
            </span>
          ) : (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors pointer-events-none">
              <Icon size={20} />
            </div>
          )
        )}
        <input
          id={id}
          style={{
            color:"#e4e2eb",
          }}
          className={`w-full bg-surface-container-lowest/50 border ${
            hasErrors ? 'border-error/50 focus:ring-error/20 focus:border-error' : 'border-outline-variant/30 focus:ring-primary/20 focus:border-primary'
          } rounded-xl py-4 ${Icon ? 'pl-12' : 'pl-4'} ${suffix ? 'pr-12' : 'pr-4'} text-black placeholder:text-on-surface-variant/40 focus:ring-2 transition-all outline-none`}
          {...props}
        />
        {suffix && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center">
            {suffix}
          </div>
        )}
      </div>
      {hasErrors && (
        <div className="text-error text-xs ml-1 space-y-xs mt-1">
          {errors.map((error, idx) => (
            <p key={idx} className="transition-all animate-fade-in">
              {error}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};
