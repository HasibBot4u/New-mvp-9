export const trackEvent = (name: string, params?: object) => {
  // @ts-expect-error: gtag is globally defined
  if (typeof gtag !== 'undefined') gtag('event', name, params);
};
