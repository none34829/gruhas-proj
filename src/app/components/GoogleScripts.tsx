'use client';

import Script from 'next/script';

export default function GoogleScripts() {
  return (
    <Script
      src="https://accounts.google.com/gsi/client"
      strategy="beforeInteractive"
      onError={(e) => {
        console.error('Error loading Google Identity Services:', e);
      }}
    />
  );
}
