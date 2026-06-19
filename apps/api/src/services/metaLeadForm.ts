import { config } from "../config";

// ── Types ──────────────────────────────────────────────────────────────────

export type MetaFieldData = {
  name: string;
  values: string[];
};

export type MetaLead = {
  id: string;
  created_time: string;
  ad_id?: string;
  ad_name?: string;
  form_id?: string;
  form_name?: string;
  field_data: MetaFieldData[];
};

export type MappedLeadFormData = {
  studentName: string;
  phone: string;
  email: string;
  fatherName: string;
  city: string;
  state: string;
  course: string;
  qualification: string;
};

// ── Graph API ──────────────────────────────────────────────────────────────

export async function fetchLeadFromMeta(
  leadgenId: string,
): Promise<MetaLead | null> {
  if (!config.meta.pageAccessToken) {
    console.warn(
      "[meta-lead-form] META_PAGE_ACCESS_TOKEN not set — cannot fetch lead",
      { leadgenId },
    );
    return null;
  }

  const url = new URL(
    `https://graph.facebook.com/v19.0/${leadgenId}`,
  );
  url.searchParams.set(
    "fields",
    "field_data,created_time,ad_id,ad_name,form_id,form_name",
  );
  url.searchParams.set("access_token", config.meta.pageAccessToken);

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[meta-lead-form] Graph API error", {
        leadgenId,
        status: res.status,
        body,
      });
      return null;
    }

    return (await res.json()) as MetaLead;
  } catch (err) {
    console.error("[meta-lead-form] Graph API fetch failed", {
      leadgenId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ── Field mapping ──────────────────────────────────────────────────────────

// Normalize Indian mobile number — strips country code, validates 10 digits
export function normalizeIndianPhone(raw: string): string | null {
  // Remove spaces, dashes, dots, parentheses
  let cleaned = raw.replace(/[\s\-.()+]/g, "");

  // Strip leading 0
  if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);

  // Strip country code: +91 or 91 prefix
  if (cleaned.startsWith("91") && cleaned.length === 12) {
    cleaned = cleaned.slice(2);
  }

  // Must be exactly 10 digits and start with 6-9
  if (/^[6-9]\d{9}$/.test(cleaned)) return cleaned;

  return null;
}

export function mapMetaFieldsToLead(
  fieldData: MetaFieldData[],
): MappedLeadFormData {
  // Build a lookup map: lowercase field name → first value
  const map = new Map<string, string>();
  for (const field of fieldData) {
    const val = (field.values[0] ?? "").trim();
    if (val) map.set(field.name.toLowerCase(), val);
  }

  const get = (...keys: string[]): string => {
    for (const k of keys) {
      const v = map.get(k);
      if (v) return v;
    }
    return "";
  };

  // Student name — combine first+last if full_name not present
  let studentName = get("full_name", "name", "student_name");
  if (!studentName) {
    const first = get("first_name");
    const last = get("last_name");
    studentName = [first, last].filter(Boolean).join(" ");
  }

  const phone = get(
    "phone_number",
    "mobile",
    "phone",
    "mobile_number",
    "contact_number",
  );

  return {
    studentName,
    phone,
    email: get("email", "email_address", "email_id"),
    fatherName: get("father_name", "fathers_name", "father", "guardian_name"),
    city: get("city", "location", "current_city"),
    state: get("state", "state_name"),
    course: get(
      "course",
      "interested_course",
      "program",
      "course_interest",
      "programme",
    ),
    qualification: get("qualification", "education", "highest_qualification"),
  };
}

// ── Fetch all leads from a form (for manual sync) ─────────────────────────

export type FormLeadListItem = {
  id: string;
  created_time: string;
  ad_id?: string;
  ad_name?: string;
  field_data: MetaFieldData[];
};

export async function fetchAllLeadsFromForm(
  formId: string,
  since?: string,
): Promise<FormLeadListItem[]> {
  if (!config.meta.pageAccessToken) {
    console.warn(
      "[meta-lead-form] META_PAGE_ACCESS_TOKEN not set — cannot fetch form leads",
      { formId },
    );
    return [];
  }

  const url = new URL(
    `https://graph.facebook.com/v19.0/${formId}/leads`,
  );
  url.searchParams.set(
    "fields",
    "field_data,created_time,ad_id,ad_name",
  );
  url.searchParams.set("access_token", config.meta.pageAccessToken);
  if (since) url.searchParams.set("since", since);

  const results: FormLeadListItem[] = [];

  try {
    let nextUrl: string | null = url.toString();

    while (nextUrl) {
      const res = await fetch(nextUrl, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error("[meta-lead-form] Form leads fetch error", {
          formId,
          status: res.status,
          body,
        });
        break;
      }

      const json = (await res.json()) as {
        data: FormLeadListItem[];
        paging?: { next?: string };
      };

      results.push(...(json.data ?? []));
      nextUrl = json.paging?.next ?? null;
    }
  } catch (err) {
    console.error("[meta-lead-form] fetchAllLeadsFromForm failed", {
      formId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return results;
}

// ── Auto page subscription ─────────────────────────────────────────────────
// Subscribes the Facebook Page to this app for `leadgen` webhook events.
// Must be called on startup so leads fire automatically without manual setup.
export async function subscribePageToApp(): Promise<void> {
  const { pageId, pageAccessToken, appId } = config.meta;

  if (!pageId || !pageAccessToken || !appId) {
    console.log(
      "[meta-lead-form] Page subscription skipped — META_PAGE_ID, META_PAGE_ACCESS_TOKEN or META_APP_ID not set",
    );
    return;
  }

  try {
    const url = new URL(
      `https://graph.facebook.com/v19.0/${pageId}/subscribed_apps`,
    );
    url.searchParams.set("subscribed_fields", "leadgen");
    url.searchParams.set("access_token", pageAccessToken);

    const res = await fetch(url.toString(), {
      method: "POST",
      signal: AbortSignal.timeout(10000),
    });

    const json = (await res.json()) as { success?: boolean; error?: { message: string } };

    if (json.success) {
      console.log("[meta-lead-form] Page subscribed to app for leadgen events ✓", { pageId });
    } else {
      console.error("[meta-lead-form] Page subscription failed", {
        pageId,
        error: json.error?.message ?? JSON.stringify(json),
      });
    }
  } catch (err) {
    console.error("[meta-lead-form] subscribePageToApp failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
