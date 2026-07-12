'use client';

import { useEffect, useState } from 'react';
import liff from '@line/liff';
import { normalizeLang, type Lang } from './i18n';

interface LiffState {
  ready: boolean;
  error: string | null;
  userId: string | null;
  displayName: string | null;
  lang: Lang;
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
    lang: normalizeLang(undefined),
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
          lang: normalizeLang(liff.getLanguage()),
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

/**
 * Reads a query param that may have been appended to the LIFF URL (e.g.
 * ?pendingPhotoId=abc from the webhook's chat reply). Normally this shows
 * up directly in window.location.search, but LINE's OAuth redirect flow
 * sometimes wraps the original path+query inside a `liff.state` param
 * instead — this checks both so the param is found either way.
 */
export function getLiffQueryParam(name: string): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (params.has(name)) return params.get(name);

  const state = params.get('liff.state');
  if (state) {
    const decoded = decodeURIComponent(state);
    const qIndex = decoded.indexOf('?');
    if (qIndex !== -1) {
      return new URLSearchParams(decoded.slice(qIndex + 1)).get(name);
    }
  }
  return null;
}
