import crypto from "crypto";
import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { Role } from "@lms/types";
import { config } from "../../config";
import {
  fetchLeadFromMeta,
  mapMetaFieldsToLead,
  normalizeIndianPhone as normalizeLeadFormPhone,
  fetchAllLeadsFromForm,
} from "../../services/metaLeadForm";
import {
  parseWhatsAppWebhook,
  normalizeIndianPhone as normalizeWhatsAppPhone,
  isOutboundMessage,
  sendWhatsAppReply,
} from "../../services/metaWhatsapp";
import {
  createLeadFromMeta,
  findCourseByName,
  findMetaSourceId,
  findWhatsAppSourceId,
  findDefaultBranch,
} from "../../services/metaLeadCreate";

// ── Type augmentation for raw body ────────────────────────────────────────
declare module "fastify" {
  interface FastifyRequest {
    rawBody?: string;
  }
}

// ── Signature verification ────────────────────────────────────────────────

function verifyMetaSignature(
  rawBody: string,
  signature: string | undefined,
): boolean {
  if (!config.meta.appSecret) return false;
  if (!signature) return false;

  try {
    const expected =
      "sha256=" +
      crypto
        .createHmac("sha256", config.meta.appSecret)
        .update(rawBody)
        .digest("hex");

    // Constant-time comparison prevents timing attacks
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

// ── Lead Form handler ─────────────────────────────────────────────────────

async function handleLeadForm(
  fastify: FastifyInstance,
  value: {
    leadgen_id?: string;
    page_id?: string;
    form_id?: string;
    ad_id?: string;
    ad_name?: string;
  },
): Promise<void> {
  const leadgenId = value.leadgen_id;
  const formId = value.form_id;

  if (!leadgenId) {
    console.warn("[meta-lead-form] Missing leadgen_id in webhook payload");
    return;
  }

  fastify.log.info({ leadgenId, formId, adId: value.ad_id }, "[meta-lead-form] Processing");

  // ── Step 1: Form ID whitelist check ──
  if (config.meta.allowedFormIds.length > 0 && formId) {
    if (!config.meta.allowedFormIds.includes(formId)) {
      console.log("[meta-lead-form] Form ID not in whitelist — skipped", {
        formId,
      });
      return;
    }
  }

  // ── Step 2: Idempotency — check if leadgen_id already processed ──
  // metaLeadgenId has a unique index so a duplicate would throw on creation.
  // We also check explicitly to log cleanly.
  const existing = await fastify.prisma.lead.findFirst({
    where: { metaLeadgenId: leadgenId } as any,
    select: { id: true },
  });
  if (existing) {
    console.log("[meta-lead-form] Already processed — skipped (idempotent)", {
      leadgenId,
      existingLeadId: existing.id,
    });
    return;
  }

  // ── Step 3: Fetch full lead from Meta Graph API ──
  const metaLead = await fetchLeadFromMeta(leadgenId);
  if (!metaLead) {
    console.warn("[meta-lead-form] Could not fetch lead from Graph API", {
      leadgenId,
    });
    return;
  }

  // ── Step 4: Map fields ──
  const mapped = mapMetaFieldsToLead(metaLead.field_data ?? []);

  // ── Step 5: Validate required fields ──
  if (!mapped.studentName) {
    console.log("[meta-lead-form] Missing studentName — skipped", { leadgenId });
    return;
  }
  if (!mapped.phone) {
    console.log("[meta-lead-form] Missing phone field — skipped", { leadgenId });
    return;
  }

  // ── Step 6: Validate and normalize phone ──
  const normalizedPhone = normalizeLeadFormPhone(mapped.phone);
  if (!normalizedPhone) {
    console.log("[meta-lead-form] Invalid Indian phone — skipped", {
      leadgenId,
      rawPhone: mapped.phone,
    });
    return;
  }

  // ── Step 7: Resolve course + source ──
  const courseId = mapped.course
    ? await findCourseByName(fastify, mapped.course)
    : null;
  const sourceId = await findMetaSourceId(fastify);

  // ── Step 8: Create lead via shared service ──
  await createLeadFromMeta(fastify, {
    studentName: mapped.studentName,
    phone: normalizedPhone,
    email: mapped.email || undefined,
    fatherName: mapped.fatherName || undefined,
    city: mapped.city || undefined,
    state: mapped.state || undefined,
    qualification: mapped.qualification || undefined,
    courseId,
    sourceId,
    isFromWhatsApp: false,
    metaLeadgenId: leadgenId,
    metaAdName: value.ad_name ?? metaLead.ad_name ?? undefined,
    remarks: `Meta Lead Form${metaLead.form_name ? ` — ${metaLead.form_name}` : ""}`,
  });
}

// ── WhatsApp handler ──────────────────────────────────────────────────────

async function handleWhatsAppMessage(
  fastify: FastifyInstance,
  body: unknown,
): Promise<void> {
  // ── Step 1: Guard — PHONE_NUMBER_ID must be configured ──
  if (!config.meta.whatsappPhoneNumberId) {
    console.warn(
      "[meta-whatsapp] META_WHATSAPP_PHONE_NUMBER_ID not configured — handler skipped",
    );
    return;
  }

  // ── Step 2: Parse webhook ──
  const parsed = parseWhatsAppWebhook(body);
  if (!parsed) {
    // Delivery receipt, read receipt, malformed — ignore silently
    return;
  }

  const { name, phone, waid, message, msgType, timestamp } = parsed;

  // ── Step 3: Skip outbound echo (our own reply echoed back) ──
  if (isOutboundMessage(body)) {
    console.log("[meta-whatsapp] Outbound echo — ignored", { waid });
    return;
  }

  fastify.log.info({ waid, msgType, hasName: !!name }, "[meta-whatsapp] Processing");

  // ── Step 4: Normalize phone ──
  const normalizedPhone = normalizeWhatsAppPhone(waid);
  if (!normalizedPhone) {
    console.log("[meta-whatsapp] Invalid phone from wa_id — skipped", { waid });
    return;
  }

  // ── Step 5: Idempotency — check by waContactId (same contact, no duplicate lead) ──
  const existingByWaId = await fastify.prisma.lead.findFirst({
    where: { waContactId: waid } as any,
    select: {
      id: true,
      assignedToId: true,
      assignedTo: { select: { id: true, email: true, name: true } },
    },
  });

  if (existingByWaId) {
    // EDGE: same student messages again → add to interactionLog, no new lead
    const branchId = await findDefaultBranch(fastify);
    const systemUser = branchId
      ? await fastify.prisma.user.findFirst({
          where: { branchId, role: { in: ["ADMIN", "SUB_ADMIN"] }, isActive: true },
          select: { id: true },
          orderBy: { createdAt: "asc" },
        })
      : null;

    if (systemUser) {
      try {
        await fastify.prisma.interactionLog.create({
          data: {
            leadId: existingByWaId.id,
            userId: systemUser.id,
            type: "NOTE",
            note: `New WhatsApp message received: ${message}`,
          },
        });
      } catch (err) {
        console.error("[meta-whatsapp] Failed to log follow-up message", {
          error: err instanceof Error ? err.message : String(err),
          existingLeadId: existingByWaId.id,
        });
      }
    }

    console.log("[meta-whatsapp] Existing WA contact — message logged, no new lead", {
      waid,
      existingLeadId: existingByWaId.id,
    });
    return;
  }

  // ── Step 6: Find source + course ──
  const sourceId = await findWhatsAppSourceId(fastify);
  // EDGE: try to detect course from message text (soft match)
  const courseId = message && !message.startsWith("[")
    ? await findCourseByName(fastify, message)
    : null;

  // ── Step 7: Create lead ──
  // EDGE: no profile name → use phone as studentName fallback
  const studentName = name || normalizedPhone;

  const result = await createLeadFromMeta(fastify, {
    studentName,
    phone: normalizedPhone,
    sourceId,
    courseId,
    isFromWhatsApp: true,
    waContactId: waid,
    waFirstMessage: message,
    waMessageType: msgType,
    remarks: `WhatsApp: ${message}`,
  });

  // ── Step 8: Send auto-reply (fire-and-forget, never blocks lead creation) ──
  if (result && "created" in result && result.created) {
    if (config.meta.whatsappAutoReply) {
      // Intentionally NOT awaited — failure must not block the flow
      void sendWhatsAppReply(waid).catch((err) => {
        console.error("[meta-whatsapp] Auto-reply failed (non-fatal)", {
          error: err instanceof Error ? err.message : String(err),
          to: waid,
        });
      });
    }
  }
}

// ── Route plugin ──────────────────────────────────────────────────────────
// NOT wrapped with fp() — keeps the scoped content-type parser contained here

export async function metaRoutes(fastify: FastifyInstance): Promise<void> {
  // ── Scoped raw-body capture ──
  // Must override the global JSON parser within this scope so we can
  // access the original bytes for HMAC signature verification.
  // This does NOT affect any other route in the application.
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    function (req, body, done) {
      // EDGE: empty body (e.g. Meta verification GET)
      if (!body || (body as Buffer).length === 0) {
        done(null, {});
        return;
      }
      const raw = (body as Buffer).toString("utf-8");
      req.rawBody = raw;
      try {
        done(null, JSON.parse(raw));
      } catch (err: any) {
        err.statusCode = 400;
        done(err, undefined);
      }
    },
  );

  const adminGuard = [authenticate, authorize([Role.ADMIN, Role.SUB_ADMIN])];

  // ════════════════════════════════════════════════════════════════
  // GET /meta/webhook — Meta webhook verification
  // Meta sends: hub.mode=subscribe, hub.verify_token, hub.challenge
  // Must respond with hub.challenge as plain text within 5 seconds.
  // ════════════════════════════════════════════════════════════════
  fastify.get("/webhook", async (request, reply) => {
    const query = request.query as Record<string, string>;
    const mode = query["hub.mode"];
    const token = query["hub.verify_token"];
    const challenge = query["hub.challenge"];

    if (!config.meta.webhookVerifyToken) {
      fastify.log.warn(
        "[meta-webhook] META_WEBHOOK_VERIFY_TOKEN not set — verification will fail",
      );
    }

    if (
      mode === "subscribe" &&
      token === config.meta.webhookVerifyToken &&
      challenge
    ) {
      fastify.log.info("[meta-webhook] Verified successfully");
      return reply.status(200).send(challenge);
    }

    fastify.log.warn("[meta-webhook] Verification failed", {
      mode,
      tokenMatch: token === config.meta.webhookVerifyToken,
    });
    return reply.status(403).send({ error: "Forbidden" });
  });

  // ════════════════════════════════════════════════════════════════
  // POST /meta/webhook — Incoming events (lead forms + WhatsApp messages)
  //
  // CRITICAL TIMING RULE: Meta retries if no 200 within 5 seconds.
  // We respond 200 IMMEDIATELY and process asynchronously.
  // ════════════════════════════════════════════════════════════════
  fastify.post("/webhook", async (request, reply) => {
    // ── Signature verification ──
    const signature = request.headers["x-hub-signature-256"] as
      | string
      | undefined;

    // In production META_APP_SECRET is required — no graceful degradation.
    // In development we allow unsigned webhooks to simplify local testing.
    if (config.meta.appSecret) {
      const rawBody = request.rawBody ?? "";
      if (!verifyMetaSignature(rawBody, signature)) {
        fastify.log.warn("[meta-webhook] Invalid signature — rejected");
        return reply.status(403).send({ error: "Invalid signature" });
      }
    } else if (config.isProd) {
      fastify.log.error("[meta-webhook] META_APP_SECRET is not set in production — rejecting all webhooks");
      return reply.status(503).send({ error: "Webhook not configured" });
    }

    // ── Respond 200 IMMEDIATELY — Meta will retry if we don't ──
    void reply.status(200).send({ ok: true });

    // ── Async processing — runs after 200 is sent ──
    // Void async IIFE — exceptions are caught inside and logged.
    void (async () => {
      const body = request.body as any;

      // EDGE: empty or malformed body
      if (!body || typeof body !== "object") return;

      const object: string = body.object ?? "";
      const entries: any[] = body.entry ?? [];

      // EDGE: empty entries array
      if (!entries.length) return;

      fastify.log.info(
        { object, entryCount: entries.length },
        "[meta-webhook] Received",
      );

      for (const entry of entries) {
        const changes: any[] = entry.changes ?? [];

        // EDGE: empty changes array
        if (!changes.length) continue;

        for (const change of changes) {
          // ── Lead Form webhook ──
          if (object === "page" && change.field === "leadgen") {
            try {
              await handleLeadForm(fastify, change.value ?? {});
            } catch (err) {
              // EDGE: one handler must never crash another
              fastify.log.error(
                {
                  error: err instanceof Error ? err.message : String(err),
                  stack: err instanceof Error ? err.stack : undefined,
                  leadgenId: change.value?.leadgen_id,
                },
                "[meta-lead-form] Unhandled error",
              );
            }
          }

          // ── WhatsApp webhook ──
          else if (object === "whatsapp_business_account") {
            try {
              await handleWhatsAppMessage(fastify, body);
            } catch (err) {
              fastify.log.error(
                {
                  error: err instanceof Error ? err.message : String(err),
                  stack: err instanceof Error ? err.stack : undefined,
                },
                "[meta-whatsapp] Unhandled error",
              );
            }
            // WhatsApp sends all entries under a single object —
            // process once per POST, not once per change
            return;
          }

          // ── Unknown object type — log and continue ──
          else {
            fastify.log.info(
              { object, field: change.field },
              "[meta-webhook] Unknown object type — ignored",
            );
          }
        }
      }
    })();
  });

  // ════════════════════════════════════════════════════════════════
  // GET /meta/status — Integration health check (auth required)
  // ════════════════════════════════════════════════════════════════
  fastify.get("/status", { preHandler: authenticate }, async (_request, reply) => {
    return reply.send({
      success: true,
      data: {
        leadForms: {
          configured: !!config.meta.pageAccessToken,
          pageConnected: !!config.meta.pageId,
        },
        whatsapp: {
          configured: !!config.meta.whatsappPhoneNumberId,
          wabaConnected: !!config.meta.whatsappBusinessAccountId,
          autoReplyEnabled: config.meta.whatsappAutoReply,
        },
        webhook: {
          verifyTokenSet: !!config.meta.webhookVerifyToken,
          appSecretSet: !!config.meta.appSecret,
        },
      },
    });
  });

  // ════════════════════════════════════════════════════════════════
  // GET /meta/stats — Lead statistics by source (auth required)
  // ════════════════════════════════════════════════════════════════
  fastify.get(
    "/stats",
    { preHandler: authenticate },
    async (_request, reply) => {
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [todayForm, todayWa, weekForm, weekWa, monthForm, monthWa, recent] =
        await Promise.all([
          // Today: lead form
          fastify.prisma.lead.count({
            where: {
              isFromWhatsApp: false,
              metaLeadgenId: { not: null },
              createdAt: { gte: todayStart },
            } as any,
          }),
          // Today: whatsapp
          fastify.prisma.lead.count({
            where: { isFromWhatsApp: true, createdAt: { gte: todayStart } } as any,
          }),
          // This week: lead form
          fastify.prisma.lead.count({
            where: {
              isFromWhatsApp: false,
              metaLeadgenId: { not: null },
              createdAt: { gte: weekStart },
            } as any,
          }),
          // This week: whatsapp
          fastify.prisma.lead.count({
            where: { isFromWhatsApp: true, createdAt: { gte: weekStart } } as any,
          }),
          // This month: lead form
          fastify.prisma.lead.count({
            where: {
              isFromWhatsApp: false,
              metaLeadgenId: { not: null },
              createdAt: { gte: monthStart },
            } as any,
          }),
          // This month: whatsapp
          fastify.prisma.lead.count({
            where: { isFromWhatsApp: true, createdAt: { gte: monthStart } } as any,
          }),
          // Last 10 Meta/WA leads
          fastify.prisma.lead.findMany({
            where: {
              OR: [
                { isFromWhatsApp: true },
                { metaLeadgenId: { not: null } },
              ],
            } as any,
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              id: true,
              studentName: true,
              phone: true,
              status: true,
              createdAt: true,
              isFromWhatsApp: true,
              metaAdName: true,
              assignedTo: { select: { id: true, name: true } },
            } as any,
          }),
        ]);

      return reply.send({
        success: true,
        data: {
          today: {
            leadForm: todayForm,
            whatsapp: todayWa,
            total: todayForm + todayWa,
          },
          thisWeek: {
            leadForm: weekForm,
            whatsapp: weekWa,
            total: weekForm + weekWa,
          },
          thisMonth: {
            leadForm: monthForm,
            whatsapp: monthWa,
            total: monthForm + monthWa,
          },
          recentLeads: recent,
        },
      });
    },
  );

  // ════════════════════════════════════════════════════════════════
  // POST /meta/sync-form — Manual sync of a Meta Lead Form
  // Useful when webhook was down or for initial import of existing leads.
  // Admin/Sub-Admin only.
  // ════════════════════════════════════════════════════════════════
  fastify.post(
    "/sync-form",
    { preHandler: adminGuard },
    async (request, reply) => {
      const body = request.body as { formId?: string; since?: string };
      const { formId, since } = body;

      if (!formId) {
        return reply
          .status(400)
          .send({ success: false, error: { code: "BAD_REQUEST", message: "formId required" } });
      }

      const leads = await fetchAllLeadsFromForm(formId, since);

      const stats = { total: leads.length, created: 0, duplicates: 0, skipped: 0 };

      for (const item of leads) {
        if (!item.id) { stats.skipped++; continue; }

        // Idempotency
        const exists = await fastify.prisma.lead.findFirst({
          where: { metaLeadgenId: item.id } as any,
          select: { id: true },
        });
        if (exists) { stats.duplicates++; continue; }

        const mapped = mapMetaFieldsToLead(item.field_data ?? []);
        if (!mapped.studentName || !mapped.phone) { stats.skipped++; continue; }

        const normalizedPhone = normalizeLeadFormPhone(mapped.phone);
        if (!normalizedPhone) { stats.skipped++; continue; }

        const courseId = mapped.course ? await findCourseByName(fastify, mapped.course) : null;
        const sourceId = await findMetaSourceId(fastify);

        const result = await createLeadFromMeta(fastify, {
          studentName: mapped.studentName,
          phone: normalizedPhone,
          email: mapped.email || undefined,
          fatherName: mapped.fatherName || undefined,
          city: mapped.city || undefined,
          state: mapped.state || undefined,
          courseId,
          sourceId,
          isFromWhatsApp: false,
          metaLeadgenId: item.id,
          metaAdName: item.ad_name,
        });

        if ("created" in result && result.created) stats.created++;
        else if ("duplicate" in result && result.duplicate) stats.duplicates++;
        else stats.skipped++;
      }

      return reply.send({ success: true, data: stats });
    },
  );

  // ════════════════════════════════════════════════════════════════
  // POST /meta/test-whatsapp-lead — Simulate a WhatsApp lead (auth required)
  // Bypasses webhook and runs through the exact same handler logic.
  // ════════════════════════════════════════════════════════════════
  fastify.post(
    "/test-whatsapp-lead",
    { preHandler: authenticate },
    async (request, reply) => {
      const body = request.body as {
        studentName?: string;
        phone?: string;
        message?: string;
        courseName?: string;
      };

      const phone = body.phone ?? "9999999999";
      const studentName = body.studentName || phone;
      const message = body.message ?? "Test WhatsApp lead";
      const msgType = "text";
      // Use a synthetic waid for testing (91 + phone)
      const waid = `91${phone}`;

      // Idempotency check
      const existingByWaId = await fastify.prisma.lead.findFirst({
        where: { waContactId: waid } as any,
        select: { id: true },
      });
      if (existingByWaId) {
        return reply.send({
          success: true,
          data: { duplicate: true, existingLeadId: existingByWaId.id },
        });
      }

      const normalizedPhone = normalizeWhatsAppPhone(waid);
      if (!normalizedPhone) {
        return reply.status(400).send({
          success: false,
          error: { code: "BAD_REQUEST", message: "Invalid phone number" },
        });
      }

      const sourceId = await findWhatsAppSourceId(fastify);
      const courseId = body.courseName
        ? await findCourseByName(fastify, body.courseName)
        : null;

      const result = await createLeadFromMeta(fastify, {
        studentName,
        phone: normalizedPhone,
        sourceId,
        courseId,
        isFromWhatsApp: true,
        waContactId: waid,
        waFirstMessage: message,
        waMessageType: msgType,
        remarks: `[TEST] WhatsApp: ${message}`,
      });

      if ("created" in result && result.created) {
        return reply.send({
          success: true,
          data: {
            created: true,
            leadId: result.leadId,
            assignedTo: result.assignedToId,
          },
        });
      }
      if ("duplicate" in result && result.duplicate) {
        return reply.send({
          success: true,
          data: { duplicate: true, existingLeadId: result.existingLeadId },
        });
      }
      return reply.send({
        success: true,
        data: { skipped: true, reason: (result as any).reason },
      });
    },
  );
}
