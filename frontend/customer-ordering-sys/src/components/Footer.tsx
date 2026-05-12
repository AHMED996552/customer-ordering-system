import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="max-w-container-max mx-auto px-lg py-xl border-t border-on-surface-variant/10 text-center">
      <div className="flex flex-col items-center gap-md">
        <span className="font-display-xl text-headline-md tracking-tighter text-on-surface-variant/40">
          LuxeEats
        </span>
        <div className="flex gap-lg font-label-caps text-xs text-on-surface-variant/60">
          <a className="hover:text-primary transition-colors" href="/">
            Privacy Policy
          </a>
          <a className="hover:text-primary transition-colors" href="/">
            Terms of Service
          </a>
          <a className="hover:text-primary transition-colors" href="/">
            Refund Policy
          </a>
        </div>
        <p className="font-body-md text-xs text-on-surface-variant/40 mt-sm">
          © 2024 LuxeEats International Group. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
