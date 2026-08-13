import { useEffect, useState } from 'react';

// Export a singleton bus for sending messages
export const a11yAnnounce = (message: string) => {
  const event = new CustomEvent('a11y-announce', { detail: message });
  window.dispatchEvent(event);
};

export function LiveRegion() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleAnnounce = (e: Event) => {
      const customEvent = e as CustomEvent;
      setMessage(customEvent.detail);
      
      // Clear the message after a short delay so the same message can be announced again if needed
      setTimeout(() => setMessage(''), 3000); 
    };

    window.addEventListener('a11y-announce', handleAnnounce);
    return () => window.removeEventListener('a11y-announce', handleAnnounce);
  }, []);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}
