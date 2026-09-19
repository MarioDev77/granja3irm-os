'use client';

import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'react-hot-toast';

export default function Providers({ children, session }) {
  return (
    <SessionProvider session={session}>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            fontSize: '14px',
            borderRadius: '6px',
          },
          success: { style: { background: '#425629', color: '#fff' } },
          error: { style: { background: '#7a4128', color: '#fff' } },
        }}
      />
    </SessionProvider>
  );
}
