export type Lang = 'en' | 'ja';

/**
 * Default language when detection fails or is unavailable. This is a
 * Japan-based business, so Japanese is the sensible default rather than
 * English — English is used only when explicitly detected or chosen.
 */
export const DEFAULT_LANG: Lang = 'ja';

export function normalizeLang(input?: string | null): Lang {
  if (!input) return DEFAULT_LANG;
  return input.toLowerCase().startsWith('en') ? 'en' : 'ja';
}

const dict = {
  en: {
    // Header / steps
    appTitle: 'Appraisal Register',
    stepPhoto: 'Photo',
    stepDetails: 'Details',
    stepConfirmed: 'Confirmed',
    opening: 'Opening register…',
    couldNotOpen: 'Could not open',

    // Photo step
    newItem: 'New item',
    photoPrompt: 'Photograph the piece to begin the appraisal ticket.',
    takePhoto: 'Take photo',
    choosePhotos: 'Choose photos',
    skipPhoto: 'Skip photo for now',
    uploading: 'Uploading…',
    uploadingPhoto: 'Uploading photo…',
    maxPhotosAlert: 'Only {remaining} more photo{plural} can be added (max {max}).',

    // Fields
    fieldCategory: 'Category',
    fieldBrand: 'Brand',
    fieldItemName: 'Item name',
    fieldPrice: 'Price (¥)',
    fieldCondition: 'Condition grade',
    fieldStore: 'Store',
    fieldNotes: 'Notes (optional)',
    selectBrand: 'Select brand',
    selectStore: 'Select store',
    itemNamePlaceholder: 'e.g. Submariner Date 41mm',

    // Validation
    errorSelectCategory: 'Select a category',
    errorSelectBrand: 'Select a brand',
    errorEnterItemName: 'Enter the item name',
    errorEnterPrice: 'Enter a price',
    errorPricePositive: 'Price must be greater than 0',
    errorSelectCondition: 'Select a condition grade',
    errorSelectStore: 'Select a store',

    // Submit / ticket
    reviewTicket: 'Review ticket',
    registering: 'Registering…',
    registerFailed: 'Could not register the item. Check your connection and try again.',
    registeredInStock: 'Registered · In stock',
    ticketBadge: 'REGISTERED',
    photosCount: '{count} photos',
    ticketPrice: 'Price',
    ticketGrade: 'Grade',
    ticketStore: 'Store',
    sentToChat: 'Sent to the chat. Return to LINE to keep working.',
    done: 'Done',
    registeredChatMessage: 'Registered {name} ({brand}) — ¥{price}',

    // Bot menu
    menuPrompt: 'What would you like to do?',
    menuNewItem: '📷 New Item',
    menuInventory: '📦 Inventory',
    menuInventoryDisplay: 'Inventory',
    myStore: '🏠 My Store',
    whichStore: 'Which store?',
    categoryAt: 'Category at {store}?',
    categoryAll: 'All',
    transferPrompt: 'Transfer "{name}" to which store?',
    viewPhotos: 'View photos',

    // Bot replies
    photoReceived: 'Photo received. Send more angles if you like, or tap below to add the brand, price and condition:\n{url}',
    noItemsInStock: 'No items in stock at {store}{category}.',
    inCategory: ' in {category}',
    noPhotosForItem: 'No photos for that item.',
    markedSold: 'Marked "{name}" as sold.',
    itemNotFound: 'Could not find that item.',
    transferredTo: 'Transferred "{name}" to {store}.',
    yourUserId: 'Your LINE user ID:\n{id}',

    // Language switch
    languageSetEnglish: 'Language set to English.',
    languageSetJapanese: '言語を日本語に設定しました。',

    // Sales report
    reportSummary: '{days}-DAY SUMMARY',
    reportAllStores: 'All stores',
    reportNewItems: 'New items',
    reportSold: 'Sold',
    reportRevenue: 'Revenue',
  },
  ja: {
    appTitle: '査定台帳',
    stepPhoto: '写真',
    stepDetails: '詳細',
    stepConfirmed: '登録完了',
    opening: '開いています…',
    couldNotOpen: '開けませんでした',

    newItem: '新規登録',
    photoPrompt: '商品を撮影して査定を始めましょう。',
    takePhoto: '写真を撮る',
    choosePhotos: '写真を選ぶ',
    skipPhoto: '写真をスキップ',
    uploading: 'アップロード中…',
    uploadingPhoto: '写真をアップロード中…',
    maxPhotosAlert: 'あと{remaining}枚まで追加できます（最大{max}枚）。',

    fieldCategory: 'カテゴリー',
    fieldBrand: 'ブランド',
    fieldItemName: '商品名',
    fieldPrice: '価格（¥）',
    fieldCondition: 'コンディション',
    fieldStore: '店舗',
    fieldNotes: '備考（任意）',
    selectBrand: 'ブランドを選択',
    selectStore: '店舗を選択',
    itemNamePlaceholder: '例：サブマリーナ デイト 41mm',

    errorSelectCategory: 'カテゴリーを選択してください',
    errorSelectBrand: 'ブランドを選択してください',
    errorEnterItemName: '商品名を入力してください',
    errorEnterPrice: '価格を入力してください',
    errorPricePositive: '価格は0より大きい値にしてください',
    errorSelectCondition: 'コンディションを選択してください',
    errorSelectStore: '店舗を選択してください',

    reviewTicket: '登録内容を確認',
    registering: '登録中…',
    registerFailed: '登録できませんでした。通信環境を確認してもう一度お試しください。',
    registeredInStock: '登録済み・在庫あり',
    ticketBadge: '登録完了',
    photosCount: '写真{count}枚',
    ticketPrice: '価格',
    ticketGrade: 'コンディション',
    ticketStore: '店舗',
    sentToChat: 'トークに送信しました。LINEに戻って作業を続けられます。',
    done: '完了',
    registeredChatMessage: '{name}（{brand}）を登録しました — ¥{price}',

    menuPrompt: '何をしますか？',
    menuNewItem: '📷 新規登録',
    menuInventory: '📦 在庫確認',
    menuInventoryDisplay: '在庫確認',
    myStore: '🏠 自分の店舗',
    whichStore: 'どの店舗ですか？',
    categoryAt: '{store}のカテゴリーは？',
    categoryAll: 'すべて',
    transferPrompt: '「{name}」をどの店舗に移動しますか？',
    viewPhotos: '写真を見る',

    photoReceived: '写真を受け取りました。他の角度の写真も送れます。準備ができたらタップしてブランド・価格・コンディションを入力してください：\n{url}',
    noItemsInStock: '{store}に在庫がありません{category}。',
    inCategory: '（{category}）',
    noPhotosForItem: 'この商品には写真がありません。',
    markedSold: '「{name}」を売約済みにしました。',
    itemNotFound: '該当する商品が見つかりませんでした。',
    transferredTo: '「{name}」を{store}に移動しました。',
    yourUserId: 'あなたのLINEユーザーID：\n{id}',

    languageSetEnglish: 'Language set to English.',
    languageSetJapanese: '言語を日本語に設定しました。',

    reportSummary: '{days}日間のサマリー',
    reportAllStores: '全店舗',
    reportNewItems: '新規登録',
    reportSold: '売約',
    reportRevenue: '売上',
  },
} as const;

export type DictKey = keyof typeof dict.en;

export function t(lang: Lang, key: DictKey, vars?: Record<string, string | number>): string {
  let str: string = dict[lang][key] ?? dict.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.split(`{${k}}`).join(String(v));
    }
  }
  return str;
}

/**
 * Display-only translations for stored data values (store names, category
 * names). The underlying value saved to PocketBase and used in postback
 * data / filters stays the canonical English string from lib/schema.ts —
 * only what's shown to the person changes with locale.
 */
export const STORE_LABELS: Record<Lang, Record<string, string>> = {
  en: {
    'Store A — Ginza': 'Store A — Ginza',
    'Store B — Omotesando': 'Store B — Omotesando',
    'Store C — Shinjuku': 'Store C — Shinjuku',
  },
  ja: {
    'Store A — Ginza': 'A店 — 銀座',
    'Store B — Omotesando': 'B店 — 表参道',
    'Store C — Shinjuku': 'C店 — 新宿',
  },
};

export const CATEGORY_LABELS: Record<Lang, Record<string, string>> = {
  en: { Bags: 'Bags', Watches: 'Watches', Jewelry: 'Jewelry', Accessories: 'Accessories' },
  ja: { Bags: 'バッグ', Watches: '時計', Jewelry: 'ジュエリー', Accessories: 'アクセサリー' },
};

export function storeLabel(lang: Lang, store: string): string {
  return STORE_LABELS[lang][store] ?? store;
}

export function categoryLabel(lang: Lang, category: string): string {
  return CATEGORY_LABELS[lang][category] ?? category;
}
