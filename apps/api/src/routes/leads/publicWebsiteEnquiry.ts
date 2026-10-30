import crypto from "crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "../../config";
import { validateBody } from "../../middleware/validate";
import { normalizeIndianPhone } from "../../services/metaLeadForm";
import {
  type CreateMetaLeadInput,
  createLeadFromMeta,
  findCourseByName,
  findWebsiteSourceId,
} from "../../services/metaLeadCreate";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => v || undefined);

const WebsiteEnquirySchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(100),
  phone: z.string().trim().min(10, "Enter a valid mobile number").max(20),
  email: z
    .union([z.string().trim().email("Enter a valid email").max(150), z.literal("")])
    .optional()
    .transform((v) => v || undefined),
  course: optionalText(120),
  city: optionalText(100),
  state: optionalText(100),
  message: optionalText(1000),
  pageUrl: optionalText(500),
  utmSource: optionalText(100),
  utmMedium: optionalText(100),
  utmCampaign: optionalText(100),
  // Honeypot — hidden on the website form; bots fill it, humans don't
  website: z.string().optional(),
});

function hasValidKey(header: string | string[] | undefined): boolean {
  if (!config.websiteLeadKey) return true;
  const provided = Array.isArray(header) ? header[0] : header;
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(config.websiteLeadKey);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function publicWebsiteEnquiryRoute(
  fastify: FastifyInstance,
): Promise<void> {
  // POST /leads/public/website-enquiry
  // Called by the enquiry form on futureeducationonline.com. Creates a NEW lead,
  // auto-assigned to the employee with the fewest active leads.
  fastify.post(
    "/public/website-enquiry",
    {
      config: {
        rateLimit: { max: config.isDev ? 100 : 10, timeWindow: "1 minute" },
      },
    },
    async (request, reply) => {
      if (!hasValidKey(request.headers["x-api-key"])) {
        return reply.status(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Invalid API key" },
        });
      }

      const validation = validateBody(WebsiteEnquirySchema, request.body);
      if (!validation.success) {
        return reply.status(400).send({ success: false, ...validation.error });
      }
      const body = validation.data;

      // Bot submission — pretend success so it doesn't retry
      if (body.website) {
        return reply.status(201).send({
          success: true,
          data: { message: "Enquiry received" },
        });
      }

      const phone = normalizeIndianPhone(body.phone);
      if (!phone) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "INVALID_PHONE",
            message: "Enter a valid 10-digit Indian mobile number",
          },
        });
      }

      const [sourceId, courseId] = await Promise.all([
        findWebsiteSourceId(fastify),
        body.course ? findCourseByName(fastify, body.course) : null,
      ]);

      const utm = [body.utmSource, body.utmMedium, body.utmCampaign]
        .filter(Boolean)
        .join(" / ");

      const input = {
        studentName: body.name,
        phone,
        email: body.email,
        city: body.city,
        state: body.state,
        courseId,
        sourceId,
        sourceOther: sourceId ? undefined : "Website Enquiry",
        remarks: body.message,
        isFromWebsite: true,
        websiteCourse: body.course,
        websitePageUrl: body.pageUrl,
        websiteUtm: utm || undefined,
      };
      // exactOptionalPropertyTypes: drop absent fields rather than pass undefined
      const result = await createLeadFromMeta(
        fastify,
        Object.fromEntries(
          Object.entries(input).filter(([, v]) => v !== undefined),
        ) as CreateMetaLeadInput,
      );

      if ("skipped" in result) {
        return reply.status(500).send({
          success: false,
          error: {
            code: "CONFIG_ERROR",
            message: "Enquiry intake is not configured yet",
          },
        });
      }

      // Same response for new and repeat enquiries — don't reveal existing leads
      return reply.status("created" in result ? 201 : 200).send({
        success: true,
        data: { message: "Enquiry received" },
      });
    },
  );
}
