import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fallbackSrc?: string;
  containerClassName?: string;
}

export function LazyImage({ src, alt, fallbackSrc, className, containerClassName, ...props }: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // If Supabase image URL, we could potentially use format=webp or similar,
  // but for generic URLs we'll attempt a generic ?format=webp query param fallback approach
  // NOTE: TODO - If image source doesn't support format conversion, this may fail, 
  // relying on standard img fallback.
  const webpSrc = src.includes('?') ? `${src}&format=webp` : `${src}?format=webp`;

  return (
    <div className={cn("relative overflow-hidden", containerClassName)}>
      {!loaded && !error && (
        <Skeleton className={cn("absolute inset-0 w-full h-full", className)} />
      )}
      <picture>
        <source srcSet={webpSrc} type="image/webp" />
        <img
          src={error && fallbackSrc ? fallbackSrc : src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={cn(
            "w-full h-full object-cover transition-opacity duration-300",
            !loaded ? "opacity-0" : "opacity-100",
            className
          )}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setError(true);
            setLoaded(true); // Don't show skeleton indefinitely
          }}
          {...props}
        />
      </picture>
    </div>
  );
}
