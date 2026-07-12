'use client';

import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { inventoryItemSchema, InventoryItemInput, CONDITIONS, STORES, CATEGORIES, MAX_PHOTOS } from '@/lib/schema';
import { useLiff, sendConfirmationToChat, closeLiffWindow, getLiffQueryParam } from '@/lib/liff-client';
import { t, storeLabel, categoryLabel, type Lang, type DictKey } from '@/lib/i18n';

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
      alert(t(liff.lang, 'maxPhotosAlert', { remaining, plural: remaining === 1 ? '' : 's', max: MAX_PHOTOS }));
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
    } catch (err) {
      console.error(err);
      alert(t(liff.lang, 'registerFailed'));
      setSubmitting(false);
      return;
    }

    // The item is already safely registered at this point — sending a
    // confirmation message back into the chat is a nice-to-have, not a
    // condition of success. liff.sendMessages() can throw for reasons
    // unrelated to registration (missing chat_message.write scope, or not
    // being opened in a chat-bound context), so its failure is logged
    // only, not shown as an error to the person who just registered.
    try {
      await sendConfirmationToChat(
        t(liff.lang, 'registeredChatMessage', { name: data.productName, brand: data.brand, price: data.price.toLocaleString() })
      );
    } catch (err) {
      console.error('sendConfirmationToChat failed (non-fatal):', err);
    }

    setSubmitting(false);
  }

  if (liff.error) {
    return <ErrorScreen message={liff.error} lang={liff.lang} />;
  }

  if (!liff.ready) {
    return <LoadingScreen lang={liff.lang} />;
  }

  const lang = liff.lang;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-10 pt-8">
      <Header staffName={liff.displayName} step={step} lang={lang} />

      {step === 'photo' && (
        <section className="mt-8 flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <div className="rounded-tag border border-dashed border-hairline p-10">
            <p className="font-display text-xl italic text-brassLight">{t(lang, 'newItem')}</p>
            <p className="mt-2 text-sm text-muted">{t(lang, 'photoPrompt')}</p>
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
            {t(lang, 'takePhoto')}
          </button>
          <button
            onClick={() => libraryInputRef.current?.click()}
            className="w-full rounded-tag border border-brass py-3 font-body text-sm font-medium text-brassLight transition hover:bg-brass/10"
          >
            {t(lang, 'choosePhotos')}
          </button>
          <button onClick={() => setStep('details')} className="text-xs text-muted underline underline-offset-4">
            {t(lang, 'skipPhoto')}
          </button>
        </section>
      )}

      {step === 'details' && (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 flex flex-1 flex-col gap-5">
          {(photoPreviewUrls.length > 0 || photoUploading) && (
            <PhotoStrip
              urls={photoPreviewUrls}
              uploading={photoUploading}
              uploadingLabel={t(lang, 'uploading')}
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

          <Field label={t(lang, 'fieldCategory')} error={errors.category?.message && t(lang, errors.category.message as DictKey)}>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((c) => (
                <label key={c} className="cursor-pointer">
                  <input type="radio" value={c} {...register('category')} className="peer sr-only" />
                  <div className="rounded-tag border border-hairline py-2.5 text-center text-sm text-muted peer-checked:border-brass peer-checked:bg-brass/10 peer-checked:text-brassLight">
                    {categoryLabel(lang, c)}
                  </div>
                </label>
              ))}
            </div>
          </Field>

          <Field label={t(lang, 'fieldBrand')} error={errors.brand?.message && t(lang, errors.brand.message as DictKey)}>
            <select {...register('brand')} className={inputCls}>
              <option value="">{t(lang, 'selectBrand')}</option>
              {BRANDS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t(lang, 'fieldItemName')} error={errors.productName?.message && t(lang, errors.productName.message as DictKey)}>
            <input {...register('productName')} placeholder={t(lang, 'itemNamePlaceholder')} className={inputCls} />
          </Field>

          <Field label={t(lang, 'fieldPrice')} error={errors.price?.message && t(lang, errors.price.message as DictKey)}>
            <input
              type="number"
              inputMode="numeric"
              {...register('price', { valueAsNumber: true })}
              placeholder="1200000"
              className={inputCls}
            />
          </Field>

          <Field label={t(lang, 'fieldCondition')} error={errors.condition?.message && t(lang, errors.condition.message as DictKey)}>
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

          <Field label={t(lang, 'fieldStore')} error={errors.store?.message && t(lang, errors.store.message as DictKey)}>
            <select {...register('store')} className={inputCls}>
              <option value="">{t(lang, 'selectStore')}</option>
              {STORES.map((s) => (
                <option key={s} value={s}>
                  {storeLabel(lang, s)}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t(lang, 'fieldNotes')}>
            <textarea {...register('notes')} rows={2} className={inputCls} />
          </Field>

          <button
            type="submit"
            disabled={submitting || photoUploading}
            className="mt-2 w-full rounded-tag bg-brass py-3 text-sm font-medium text-ink transition hover:bg-brassLight disabled:opacity-50"
          >
            {photoUploading ? t(lang, 'uploadingPhoto') : submitting ? t(lang, 'registering') : t(lang, 'reviewTicket')}
          </button>
        </form>
      )}

      {step === 'ticket' && submitted && (
        <Ticket item={submitted} photoUrl={photoPreviewUrls[0] ?? null} onDone={closeLiffWindow} lang={lang} />
      )}
    </main>
  );
}

const inputCls =
  'w-full rounded-tag border border-hairline bg-surface px-3 py-2.5 text-sm text-ivory placeholder:text-muted/60 focus:border-brass';

function PhotoStrip({
  urls,
  uploading,
  uploadingLabel,
  canAddMore,
  onAddMore,
}: {
  urls: string[];
  uploading: boolean;
  uploadingLabel: string;
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
          {uploadingLabel}
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

function Header({ staffName, step, lang }: { staffName: string | null; step: Step; lang: Lang }) {
  const stepLabel = { photo: t(lang, 'stepPhoto'), details: t(lang, 'stepDetails'), ticket: t(lang, 'stepConfirmed') }[step];
  return (
    <header className="flex items-center justify-between border-b border-hairline pb-4">
      <div>
        <p className="font-display text-lg italic text-ivory">{t(lang, 'appTitle')}</p>
        {staffName && <p className="text-xs text-muted">{staffName}</p>}
      </div>
      <span className="rounded-tag border border-hairline px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-brass">
        {stepLabel}
      </span>
    </header>
  );
}

function Ticket({
  item,
  photoUrl,
  onDone,
  lang,
}: {
  item: InventoryItemInput;
  photoUrl: string | null;
  onDone: () => void;
  lang: Lang;
}) {
  return (
    <section className="mt-8 flex flex-1 flex-col items-center gap-6">
      <div className="relative w-full rounded-tag border border-hairline bg-surface p-6">
        <div className="absolute -left-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-ink" />
        <div className="absolute -right-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-ink" />
        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={item.productName} className="mb-4 h-32 w-full rounded-tag object-cover" />
        )}
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brass">{t(lang, 'registeredInStock')}</p>
        <p className="mt-3 font-display text-2xl italic text-ivory">{item.productName}</p>
        <p className="text-sm text-muted">
          {categoryLabel(lang, item.category)} · {item.brand}
        </p>
        <div className="my-4 border-t border-dashed border-hairline" />
        <dl className="space-y-2 text-sm">
          <Row label={t(lang, 'ticketPrice')} value={`¥${item.price.toLocaleString()}`} />
          <Row label={t(lang, 'ticketGrade')} value={item.condition} />
          <Row label={t(lang, 'ticketStore')} value={storeLabel(lang, item.store)} />
        </dl>
      </div>
      <p className="text-center text-xs text-muted">{t(lang, 'sentToChat')}</p>
      <button onClick={onDone} className="w-full rounded-tag border border-brass py-3 text-sm text-brassLight">
        {t(lang, 'done')}
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

function LoadingScreen({ lang }: { lang: Lang }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink">
      <p className="font-display italic text-muted">{t(lang, 'opening')}</p>
    </main>
  );
}

function ErrorScreen({ message, lang }: { message: string; lang: Lang }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-ink px-6 text-center">
      <p className="font-display italic text-brassLight">{t(lang, 'couldNotOpen')}</p>
      <p className="text-sm text-muted">{message}</p>
    </main>
  );
}
