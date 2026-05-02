export const trackEvent = (name: string, params?: object) => {
  // @ts-expect-error
  if (typeof gtag !== 'undefined') gtag('event', name, params);
};
