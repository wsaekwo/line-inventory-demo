'use client';

import { useEffect, useState } from 'react';
import liff from '@line/liff';

interface LiffState {
  ready: boolean;
  error: string | null;
  userId: string | null;
  displayName: string | null;
}

/**
 * Initializes LIFF and returns the logged-in LINE user's profile.
 * NEXT_PUBLIC_LIFF_ID comes from LINE Developers Console > LIFF tab
 * after adding a LIFF app to your Messaging API channel.
 */
export function useLiff(): LiffState {
  const [state, setState] = useState<LiffState>({
    ready: false,
    error: null,
    userId: null,
    displayName: null,
  });

  useEffect(() => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId) {
      setState((s) => ({ ...s, error: 'NEXT_PUBLIC_LIFF_ID is not set' }));
      return;
    }

    liff
      .init({ liffId })
      .then(async () => {
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }
        const profile = await liff.getProfile();
        setState({
          ready: true,
          error: null,
          userId: profile.userId,
          displayName: profile.displayName,
        });
      })
      .catch((err) => {
        setState((s) => ({ ...s, error: err?.message ?? 'LIFF init failed' }));
      });
  }, []);

  return state;
}

export function closeLiffWindow() {
  if (liff.isInClient()) liff.closeWindow();
}

export async function sendConfirmationToChat(text: string) {
  if (liff.isInClient()) {
    await liff.sendMessages([{ type: 'text', text }]);
  }
}
