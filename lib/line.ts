import { Client, middleware, WebhookEvent, ClientConfig, MiddlewareConfig } from '@line/bot-sdk';

/**
 * Server-side LINE Messaging API client.
 * Requires LINE_CHANNEL_ACCESS_TOKEN and LINE_CHANNEL_SECRET in env.
 * Get both from the LINE Developers Console > your Messaging API channel.
 */
const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '';
const channelSecret = process.env.LINE_CHANNEL_SECRET ?? '';

export const lineConfig: ClientConfig = {
  channelAccessToken,
  channelSecret,
};

export const middlewareConfig: MiddlewareConfig = {
  channelSecret,
};

export const lineClient = new Client(lineConfig);
export const lineMiddleware = middleware(middlewareConfig);

/** Reply to a specific webhook event (uses the short-lived replyToken, free, no push quota used). */
export async function replyText(replyToken: string, text: string) {
  return lineClient.replyMessage(replyToken, { type: 'text', text });
}

/** Push a message to a specific user/group outside of a reply flow (counts against monthly push quota). */
export async function pushText(to: string, text: string) {
  return lineClient.pushMessage(to, { type: 'text', text });
}

/** Push a flex message (used for the appraisal-ticket style confirmation / report cards). */
export async function pushFlex(to: string, altText: string, contents: object) {
  return lineClient.pushMessage(to, { type: 'flex', altText, contents } as any);
}

/**
 * Download binary content (photos) a user sent to the bot.
 * LINE only hosts uploaded media for a limited time — pull it immediately
 * and re-host it (S3/GCS/R2/etc.) rather than storing the messageId long-term.
 */
export async function downloadContent(messageId: string): Promise<Buffer> {
  const stream = await lineClient.getMessageContent(messageId);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

export type { WebhookEvent };
