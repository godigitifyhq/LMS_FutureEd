import { config } from "../config";

// ── Types ──────────────────────────────────────────────────────────────────

export type ParsedWhatsAppContact = {
  name: string;       // Profile display name (may be empty)
  phone: string;      // Normalized 10-digit Indian number
  waid: string;       // Raw wa_id from Meta (e.g. 919876543210)
  message: string;    // Message text or "[image]" etc.
  msgType: string;    // text | image | audio | video | document | sticker | location | reaction
  timestamp: string;  // Unix timestamp string
};

// ── Phone normalization ────────────────────────────────────────────────────

// Handles all Indian number formats Meta sends:
//   +919876543210  →  9876543210
//   919876543210   →  9876543210
//   +91-987-654-3210 → 9876543210
//   9876543210     →  9876543210
//   09876543210    →  9876543210
// Returns null for non-Indian or invalid numbers.
export function normalizeIndianPhone(raw: string): string | null {
  let cleaned = raw.replace(/[\s\-.()+]/g, "");

  // Strip leading 0
  if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);

  // Strip country code: 91 prefix making it 12 digits
  if (cleaned.startsWith("91") && cleaned.length === 12) {
    cleaned = cleaned.slice(2);
  }

  // Validate: 10 digits, starts with 6-9
  if (/^[6-9]\d{9}$/.test(cleaned)) return cleaned;

  return null;
}

// ── Webhook parsing ────────────────────────────────────────────────────────

// Meta's WhatsApp webhook structure is deeply nested.
// Returns null for status updates (delivery/read receipts) and malformed payloads.
export function parseWhatsAppWebhook(body: unknown): ParsedWhatsAppContact | null {
  try {
    const b = body as any;
    const value = b?.entry?.[0]?.changes?.[0]?.value;

    if (!value) return null;

    // Delivery/read receipts have statuses but no messages — ignore
    if (value.statuses && !value.messages) return null;

    const contacts = value.contacts as any[] | undefined;
    const messages = value.messages as any[] | undefined;

    if (!contacts?.length || !messages?.length) return null;

    const contact = contacts[0];
    const msg = messages[0];

    if (!contact || !msg) return null;

    const waid: string = contact.wa_id ?? msg.from ?? "";
    const name: string = contact.profile?.name ?? "";
    const msgType: string = msg.type ?? "text";
    const timestamp: string = msg.timestamp ?? "";

    // Normalize phone from wa_id (Meta sends with country code)
    const phone = normalizeIndianPhone(waid);
    if (!phone) {
      console.warn("[meta-whatsapp] Non-Indian or invalid phone skipped", {
        waid,
      });
      return null;
    }

    // Extract message content by type
    // EDGE: reaction messages are not leads — they react to an existing message
    if (msgType === "reaction") return null;

    const messageContentMap: Record<string, string> = {
      text: msg.text?.body ?? "",
      image: "[image]",
      audio: "[audio]",
      video: "[video]",
      document: "[document]",
      sticker: "[sticker]",
      location: "[location]",
    };

    // EDGE: unknown future types — save as [message] and create lead anyway
    const message = messageContentMap[msgType] ?? "[message]";

    return { name, phone, waid, message, msgType, timestamp };
  } catch (err) {
    console.warn("[meta-whatsapp] parseWhatsAppWebhook threw", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ── Outbound echo detection ────────────────────────────────────────────────

// When we send a reply, Meta echoes it back to our webhook.
// Detect it by comparing `from` field to our phone number ID.
// Without this check we'd create a lead for our own messages — infinite loop.
export function isOutboundMessage(body: unknown): boolean {
  try {
    const b = body as any;
    const msg = b?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return false;
    const from: string = msg.from ?? "";
    const ourId = config.meta.whatsappPhoneNumberId;
    return !!ourId && from === ourId;
  } catch {
    return false;
  }
}

// ── Auto-reply ─────────────────────────────────────────────────────────────

// Bilingual Hindi+English — warm, builds trust with North Indian students.
// Recommended option (under 150 chars, ~110 chars):
const AUTO_REPLY_MESSAGE =
  "Namaste! 🙏 Aapka message mil gaya. Jald hi hamare counsellor aapko contact karenge. — Future Education Bokaro";

export async function sendWhatsAppReply(
  to: string,
  message: string = AUTO_REPLY_MESSAGE,
): Promise<boolean> {
  if (!config.meta.whatsappPhoneNumberId) {
    console.warn(
      "[meta-whatsapp] META_WHATSAPP_PHONE_NUMBER_ID not set — reply skipped",
    );
    return false;
  }
  if (!config.meta.pageAccessToken) {
    console.warn(
      "[meta-whatsapp] META_PAGE_ACCESS_TOKEN not set — reply skipped",
    );
    return false;
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${config.meta.whatsappPhoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.meta.pageAccessToken}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: message },
        }),
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[meta-whatsapp] sendWhatsAppReply failed", {
        to,
        status: res.status,
        body,
      });
      return false;
    }

    console.log("[meta-whatsapp] Auto-reply sent", { to, success: true });
    return true;
  } catch (err) {
    console.error("[meta-whatsapp] sendWhatsAppReply threw", {
      to,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
