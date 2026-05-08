import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ErrorCodes } from "./codes";

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  // Log every error with request context
  request.log.error({
    err: error,
    url: request.url,
    method: request.method,
  });

  // Fastify validation errors (schema mismatch)
  if (error.validation) {
    void reply.status(400).send({
      success: false,
      error: {
        code: ErrorCodes.VALIDATION_ERROR,
        message: "Invalid request data",
        details: error.validation,
      },
    });
    return;
  }

  // JWT errors
  if (
    error.code === "FST_JWT_NO_AUTHORIZATION_IN_HEADER" ||
    error.code === "FST_JWT_AUTHORIZATION_TOKEN_INVALID"
  ) {
    void reply.status(401).send({
      success: false,
      error: {
        code: ErrorCodes.UNAUTHORIZED,
        message: "Authentication required",
      },
    });
    return;
  }

  // Rate limit errors
  if (error.statusCode === 429) {
    void reply.status(429).send({
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Please try again later.",
      },
    });
    return;
  }

  // Known HTTP errors
  if (error.statusCode && error.statusCode < 500) {
    void reply.status(error.statusCode).send({
      success: false,
      error: {
        code: ErrorCodes.INVALID_INPUT,
        message: error.message,
      },
    });
    return;
  }

  // Unknown server errors — never expose internals in production
  void reply.status(500).send({
    success: false,
    error: {
      code: ErrorCodes.INTERNAL_ERROR,
      message: "Something went wrong. Please try again.",
    },
  });
}
