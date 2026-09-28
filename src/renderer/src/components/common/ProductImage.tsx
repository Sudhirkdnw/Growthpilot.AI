import React, { useState } from 'react';
import {
  Package,
  Wheat,
  Droplets,
  Cookie,
  Coffee,
  Sparkles,
  Zap,
  Utensils,
  BookOpen,
  ShoppingBag,
} from 'lucide-react';

export interface ProductImageProps {
  src?: string | null;
  name: string;
  category?: string | null;
  className?: string;
  imageClassName?: string;
  iconClassName?: string;
  fallbackTextClassName?: string;
  showFallbackBadge?: boolean;
}

export const ProductImage: React.FC<ProductImageProps> = ({
  src,
  name,
  category,
  className = 'w-10 h-10 rounded-lg',
  imageClassName = 'w-full h-full object-contain p-1',
  iconClassName = 'w-5 h-5',
  fallbackTextClassName,
  showFallbackBadge = false,
}) => {
  const [hasError, setHasError] = useState(false);

  const cleanSrc = src && typeof src === 'string' && src.trim() !== '' ? src.trim() : null;

  if (cleanSrc && !hasError) {
    return (
      <div className={`relative overflow-hidden bg-surface-muted border border-border/80 flex items-center justify-center shrink-0 ${className}`}>
        <img
          src={cleanSrc}
          alt={name}
          loading="lazy"
          onError={() => setHasError(true)}
          className={imageClassName}
        />
      </div>
    );
  }

  // Determine category visual styling and icon
  const lowerName = (name || '').toLowerCase();
  const lowerCat = (category || '').toLowerCase();

  let Icon = Package;
  let bgGradient = 'from-amber-500/20 to-orange-500/20 text-amber-500 border-amber-500/30';

  if (
    lowerCat.includes('rice') ||
    lowerCat.includes('grain') ||
    lowerCat.includes('pulse') ||
    lowerCat.includes('dal') ||
    lowerCat.includes('atta') ||
    lowerCat.includes('flour') ||
    lowerName.includes('rice') ||
    lowerName.includes('dal') ||
    lowerName.includes('atta')
  ) {
    Icon = Wheat;
    bgGradient = 'from-amber-500/20 to-yellow-600/20 text-amber-500 border-amber-500/30';
  } else if (
    lowerCat.includes('oil') ||
    lowerCat.includes('ghee') ||
    lowerName.includes('oil') ||
    lowerName.includes('ghee')
  ) {
    Icon = Droplets;
    bgGradient = 'from-yellow-500/20 to-amber-600/20 text-yellow-500 border-yellow-500/30';
  } else if (
    lowerCat.includes('biscuit') ||
    lowerCat.includes('snack') ||
    lowerCat.includes('confectionery') ||
    lowerName.includes('biscuit') ||
    lowerName.includes('chips') ||
    lowerName.includes('chocolate')
  ) {
    Icon = Cookie;
    bgGradient = 'from-orange-500/20 to-amber-500/20 text-orange-500 border-orange-500/30';
  } else if (
    lowerCat.includes('beverage') ||
    lowerCat.includes('tea') ||
    lowerCat.includes('coffee') ||
    lowerCat.includes('dairy') ||
    lowerName.includes('tea') ||
    lowerName.includes('coffee') ||
    lowerName.includes('drink') ||
    lowerName.includes('milk')
  ) {
    Icon = Coffee;
    bgGradient = 'from-emerald-500/20 to-teal-500/20 text-emerald-500 border-emerald-500/30';
  } else if (
    lowerCat.includes('stationery') ||
    lowerCat.includes('school') ||
    lowerName.includes('pen') ||
    lowerName.includes('pencil') ||
    lowerName.includes('notebook') ||
    lowerName.includes('paper')
  ) {
    Icon = BookOpen;
    bgGradient = 'from-blue-500/20 to-indigo-500/20 text-blue-500 border-blue-500/30';
  } else if (
    lowerCat.includes('electrical') ||
    lowerName.includes('battery') ||
    lowerName.includes('cable') ||
    lowerName.includes('bulb') ||
    lowerName.includes('usb')
  ) {
    Icon = Zap;
    bgGradient = 'from-yellow-400/20 to-orange-400/20 text-yellow-400 border-yellow-400/30';
  } else if (
    lowerCat.includes('toy') ||
    lowerName.includes('toy') ||
    lowerName.includes('car') ||
    lowerName.includes('doll') ||
    lowerName.includes('ball')
  ) {
    Icon = Sparkles;
    bgGradient = 'from-purple-500/20 to-pink-500/20 text-purple-400 border-purple-500/30';
  } else if (
    lowerCat.includes('kitchen') ||
    lowerName.includes('spoon') ||
    lowerName.includes('knife') ||
    lowerName.includes('plate') ||
    lowerName.includes('bottle')
  ) {
    Icon = Utensils;
    bgGradient = 'from-cyan-500/20 to-blue-500/20 text-cyan-400 border-cyan-500/30';
  } else if (
    lowerCat.includes('personal') ||
    lowerCat.includes('oral') ||
    lowerCat.includes('hair') ||
    lowerCat.includes('cleaning') ||
    lowerCat.includes('household') ||
    lowerName.includes('soap') ||
    lowerName.includes('paste') ||
    lowerName.includes('cleaner')
  ) {
    Icon = ShoppingBag;
    bgGradient = 'from-rose-500/20 to-pink-500/20 text-rose-400 border-rose-500/30';
  }

  const initial = (name || '?').charAt(0).toUpperCase();

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br ${bgGradient} border flex items-center justify-center shrink-0 shadow-sm ${className}`}
      title={name}
    >
      <Icon className={`${iconClassName} opacity-85 transition-transform group-hover:scale-110`} />
      {showFallbackBadge && (
        <span className={`absolute bottom-0.5 right-0.5 text-[9px] font-bold font-mono opacity-80 ${fallbackTextClassName}`}>
          {initial}
        </span>
      )}
    </div>
  );
};
