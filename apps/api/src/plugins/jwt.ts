import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import { config } from "../config";
import type { Role } from "@lms/types";

// Extend JWT payload type
declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string; // user id
      email: string;
      role: Role;
      branchId: string;
      jti: string;
    };
    user: {
      id: string;
      email: string;
      role: Role;
      branchId: string;
      jti: string;
    };
  }
}

export const jwtPlugin = fp(async (fastify) => {
  await fastify.register(fastifyJwt, {
    secret: config.jwtSecret,
    sign: {
      expiresIn: config.jwtAccessExpiresIn,
    },
  });
});
