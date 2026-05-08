import { PrismaClient } from "../src/generated/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcrypt";
import "dotenv/config";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // 1. Create the branch
  const branch = await prisma.branch.upsert({
    where: { id: "branch-bokaro" },
    update: {},
    create: {
      id: "branch-bokaro",
      name: "Future Education - Bokaro",
      city: "Bokaro Steel City",
      address:
        "HE-9, 1st Floor, City Centre, Sec-4, Bokaro Steel City - 827004",
    },
  });

  const adminPasswordHash = await bcrypt.hash("Admin@FutureEd123", 12);

  await prisma.user.upsert({
    where: { email: "admin@futureeducation.in" },
    update: { passwordHash: adminPasswordHash }, // ← update too
    create: {
      name: "Admin",
      email: "admin@futureeducation.in",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
      branchId: branch.id,
    },
  });

  // 3. Seed lead source types
  const sources = [
    "Desk Enquiry",
    "Telephonic Enquiry",
    "Website Enquiry",
    "Meta/Facebook Campaign",
    "WhatsApp Lead",
    "Teacher Reference",
    "JEE(Main) Campaign",
    "NEET Campaign",
    "Ex Student Reference",
    "Others",
  ];

  for (const name of sources) {
    await prisma.leadSourceType.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // 4. Seed document types
  const documentTypes = [
    { name: "Marksheet", isRequired: true },
    { name: "ID Proof", isRequired: true },
    { name: "Photo", isRequired: true },
    { name: "Birth Certificate", isRequired: false },
    { name: "Entrance Exam Scorecard", isRequired: false },
  ];

  for (const doc of documentTypes) {
    await prisma.documentType.upsert({
      where: { name: doc.name },
      update: {},
      create: doc,
    });
  }

  console.log("Seed complete");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
