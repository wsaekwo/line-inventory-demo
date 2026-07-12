'use client';

import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { inventoryItemSchema, InventoryItemInput, CONDITIONS, STORES, CATEGORIES, MAX_PHOTOS } from '@/lib/schema';
import { useLiff, sendConfirmationToChat, closeLiffWindow, getLiffQueryParam } from '@/lib/liff-client';

const BRANDS = ['Rolex', 'Chanel', 'Hermès', 'Cartier', 'Louis Vuitton', 'Patek Philippe', 'Van Cleef & Arpels', 'Other'];

type Step = 'photo' | 'details' | 'ticket';

export default function RegisterPage() {
  const liff = useLiff();
  const [step, setStep] = useState<Step>('photo');
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [pendingPhotoId, setPendingPhotoId] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [submitted, setSubmitted] = useState<InventoryItemInput | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<InventoryItemInput>({
    resolver: zodResolver(inventoryItemSchema),
    defaultValues: { lineUserId: '', category: undefined, condition: undefined, store: undefined },
  });

  // Keep lineUserId in the form in sync with the resolved LIFF profile.
  if (liff.userId && watch('lineUserId') !== liff.userId) {
    setValue('lineUserId', liff.userId);
  }

  // Pre-fill (not lock) the store field for known staff, so registering
  // at your usual location doesn't require picking it every single time.
  useEffect(() => {
    if (!liff.userId) return;
    fetch(`/api/staff?lineUserId=${encodeURIComponent(liff.userId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.store) setValue('store', data.store);
      })
      .catch(() => {
        /* no staff record yet — form just falls back to asking */
      });
  }, [liff.userId, setValue]);

  // Photos sent directly in chat arrive here as a pendingPhotoId query
  // param (the webhook already uploaded them, possibly several) — pick
  // them up and skip straight to details, rather than asking to
  // photograph the item again.
  useEffect(() => {
    const id = getLiffQueryParam('pendingPhotoId');
    if (!id) return;
    setPendingPhotoId(id);
    setStep('details');
    fetch(`/api/pending-photo/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.urls)) setPhotoPreviewUrls(data.urls);
      })
      .catch(() => {
        /* preview just won't show — pendingPhotoId is still attached on submit */
      });
  }, []);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // allow choosing the same file(s) again later
    if (files.length === 0) return;

    const remaining = MAX_PHOTOS - photoPreviewUrls.length;
    const toUpload = files.slice(0, remaining);
    if (files.length > remaining) {
      alert(`Only ${remaining} more photo${remaining === 1 ? '' : 's'} can be added (max ${MAX_PHOTOS}).`);
    }
    if (toUpload.length === 0) return;

    setStep('details');
    setPhotoUploading(true);

    // Instant local previews for everything selected, while the upload
    // happens in the background.
    setPhotoPreviewUrls((prev) => [...prev, ...toUpload.map((f) => URL.createObjectURL(f))]);

    const formData = new FormData();
    toUpload.forEach((file) => formData.append('photo', file));
    formData.append('lineUserId', liff.userId ?? '');
    if (pendingPhotoId) formData.append('pendingPhotoId', pendingPhotoId);

    try {
      const res = await fetch('/api/pending-photo', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.id) setPendingPhotoId(data.id);
    } catch (err) {
      console.error('Photo upload failed:', err);
    } finally {
      setPhotoUploading(false);
    }
  }

  async function onSubmit(data: InventoryItemInput) {
    setSubmitting(true);
    try {
      const payload = { ...data, pendingPhotoId: pendingPhotoId ?? undefined };
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Registration failed');
      setSubmitted(data);
      setStep('ticket');
      await sendConfirmationToChat(`Registered ${data.productName} (${data.brand}) — ¥${data.price.toLocaleString()}`);
    } catch (err) {
      console.error(err);
      alert('Could not register the item. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (liff.error) {
    return <ErrorScreen message={liff.error} />;
  }

  if (!liff.ready) {
    return <LoadingScreen />;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-10 pt-8">
      <Header staffName={liff.displayName} step={step} />

      {step === 'photo' && (
        <section className="mt-8 flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <div className="rounded-tag border border-dashed border-hairline p-10">
            <p className="font-display text-xl italic text-brassLight">New item</p>
            <p className="mt-2 text-sm text-muted">Photograph the piece to begin the appraisal ticket.</p>
          </div>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFiles}
            className="hidden"
          />
          <input
            ref={libraryInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFiles}
            className="hidden"
          />
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="w-full rounded-tag bg-brass py-3 font-body text-sm font-medium text-ink transition hover:bg-brassLight"
          >
            Take photo
          </button>
          <button
            onClick={() => libraryInputRef.current?.click()}
            className="w-full rounded-tag border border-brass py-3 font-body text-sm font-medium text-brassLight transition hover:bg-brass/10"
          >
            Choose photos
          </button>
          <button onClick={() => setStep('details')} className="text-xs text-muted underline underline-offset-4">
            Skip photo for now
          </button>
        </section>
      )}

      {step === 'details' && (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 flex flex-1 flex-col gap-5">
          {(photoPreviewUrls.length > 0 || photoUploading) && (
            <PhotoStrip
              urls={photoPreviewUrls}
              uploading={photoUploading}
              canAddMore={photoPreviewUrls.length < MAX_PHOTOS}
              onAddMore={() => libraryInputRef.current?.click()}
            />
          )}
          <input
            ref={libraryInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFiles}
            className="hidden"
          />

          <Field label="Category" error={errors.category?.message}>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((c) => (
                <label key={c} className="cursor-pointer">
                  <input type="radio" value={c} {...register('category')} className="peer sr-only" />
                  <div className="rounded-tag border border-hairline py-2.5 text-center text-sm text-muted peer-checked:border-brass peer-checked:bg-brass/10 peer-checked:text-brassLight">
                    {c}
                  </div>
                </label>
              ))}
            </div>
          </Field>

          <Field label="Brand" error={errors.brand?.message}>
            <select {...register('brand')} className={inputCls}>
              <option value="">Select brand</option>
              {BRANDS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Item name" error={errors.productName?.message}>
            <input {...register('productName')} placeholder="e.g. Submariner Date 41mm" className={inputCls} />
          </Field>

          <Field label="Price (¥)" error={errors.price?.message}>
            <input
              type="number"
              inputMode="numeric"
              {...register('price', { valueAsNumber: true })}
              placeholder="1200000"
              className={inputCls}
            />
          </Field>

          <Field label="Condition grade" error={errors.condition?.message}>
            <div className="grid grid-cols-4 gap-2">
              {CONDITIONS.map((c) => (
                <label key={c} className="cursor-pointer">
                  <input type="radio" value={c} {...register('condition')} className="peer sr-only" />
                  <div className="rounded-tag border border-hairline py-2 text-center text-sm text-muted peer-checked:border-brass peer-checked:bg-brass/10 peer-checked:text-brassLight">
                    {c}
                  </div>
                </label>
              ))}
            </div>
          </Field>

          <Field label="Store" error={errors.store?.message}>
            <select {...register('store')} className={inputCls}>
              <option value="">Select store</option>
              {STORES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Notes (optional)" error={errors.notes?.message}>
            <textarea {...register('notes')} rows={2} className={inputCls} />
          </Field>

          <button
            type="submit"
            disabled={submitting || photoUploading}
            className="mt-2 w-full rounded-tag bg-brass py-3 text-sm font-medium text-ink transition hover:bg-brassLight disabled:opacity-50"
          >
            {photoUploading ? 'Uploading photo…' : submitting ? 'Registering…' : 'Review ticket'}
          </button>
        </form>
      )}

      {step === 'ticket' && submitted && (
        <Ticket item={submitted} photoUrl={photoPreviewUrls[0] ?? null} onDone={closeLiffWindow} />
      )}
    </main>
  );
}

const inputCls =
  'w-full rounded-tag border border-hairline bg-surface px-3 py-2.5 text-sm text-ivory placeholder:text-muted/60 focus:border-brass';

function PhotoStrip({
  urls,
  uploading,
  canAddMore,
  onAddMore,
}: {
  urls: string[];
  uploading: boolean;
  canAddMore: boolean;
  onAddMore: () => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {urls.map((url, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={url + i}
          src={url}
          alt={`Item photo ${i + 1}`}
          className="h-20 w-20 flex-none rounded-tag object-cover"
        />
      ))}
      {uploading && (
        <div className="flex h-20 w-20 flex-none items-center justify-center rounded-tag border border-hairline text-[10px] uppercase tracking-wide text-brassLight">
          Uploading…
        </div>
      )}
      {canAddMore && !uploading && (
        <button
          type="button"
          onClick={onAddMore}
          className="flex h-20 w-20 flex-none items-center justify-center rounded-tag border border-dashed border-hairline text-2xl text-muted"
        >
          +
        </button>
      )}
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-burgundy">{error}</span>}
    </label>
  );
}

function Header({ staffName, step }: { staffName: string | null; step: Step }) {
  const stepLabel = { photo: 'Photo', details: 'Details', ticket: 'Confirmed' }[step];
  return (
    <header className="flex items-center justify-between border-b border-hairline pb-4">
      <div>
        <p className="font-display text-lg italic text-ivory">Appraisal Register</p>
        {staffName && <p className="text-xs text-muted">{staffName}</p>}
      </div>
      <span className="rounded-tag border border-hairline px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-brass">
        {stepLabel}
      </span>
    </header>
  );
}

function Ticket({ item, photoUrl, onDone }: { item: InventoryItemInput; photoUrl: string | null; onDone: () => void }) {
  return (
    <section className="mt-8 flex flex-1 flex-col items-center gap-6">
      <div className="relative w-full rounded-tag border border-hairline bg-surface p-6">
        <div className="absolute -left-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-ink" />
        <div className="absolute -right-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-ink" />
        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={item.productName} className="mb-4 h-32 w-full rounded-tag object-cover" />
        )}
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brass">Registered · In stock</p>
        <p className="mt-3 font-display text-2xl italic text-ivory">{item.productName}</p>
        <p className="text-sm text-muted">{item.category} · {item.brand}</p>
        <div className="my-4 border-t border-dashed border-hairline" />
        <dl className="space-y-2 text-sm">
          <Row label="Price" value={`¥${item.price.toLocaleString()}`} />
          <Row label="Grade" value={item.condition} />
          <Row label="Store" value={item.store} />
        </dl>
      </div>
      <p className="text-center text-xs text-muted">Sent to the chat. Return to LINE to keep working.</p>
      <button onClick={onDone} className="w-full rounded-tag border border-brass py-3 text-sm text-brassLight">
        Done
      </button>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="text-ivory">{value}</dd>
    </div>
  );
}

function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink">
      <p className="font-display italic text-muted">Opening register…</p>
    </main>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-ink px-6 text-center">
      <p className="font-display italic text-brassLight">Could not open</p>
      <p className="text-sm text-muted">{message}</p>
    </main>
  );
}
