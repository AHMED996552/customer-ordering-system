import React from 'react';

export const CartHeader: React.FC = () => {
  return (
    <section className="relative w-full h-[270px] overflow-hidden rounded-[8px]">
      <img
        src="assets/resturant.jpg"
        alt="Luxury Feast"
        className="absolute inset-0 w-full h-full object-cover rounded-[8px]"
      />
      <div className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div
        className="absolute bottom-0 left-0 w-full h-[90px]"
        style={{
          background:
            "radial-gradient(circle at center, rgba(16,40,90,0.55) 0%, rgba(0,0,0,0) 75%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to right, transparent 0px, rgba(255,180,120,0.4) 35px, transparent 70px)",
        }}
      />
      <div className="absolute bottom-8 left-8 z-10">
        <p className="text-[11px] tracking-[3px] uppercase text-[#bfc9d9] font-semibold mb-2">
          Refined Selection
        </p>

        <h1 className="text-white text-5xl font-bold leading-none">
          Review Your Feast
        </h1>
      </div>
    </section>
  );
};
