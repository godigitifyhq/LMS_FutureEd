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

  const subAdminPasswordHash = await bcrypt.hash("SubAdmin@FutureEd123", 12);

  await prisma.user.upsert({
    where: { email: "subadmin@futureeducation.in" },
    update: { passwordHash: subAdminPasswordHash },
    create: {
      name: "Sub Admin",
      email: "subadmin@futureeducation.in",
      passwordHash: subAdminPasswordHash,
      role: "SUB_ADMIN",
      branchId: branch.id,
    },
  });

  const employees = [
    { name: "Employee",   email: "employee@futureeducation.in",  password: "Emp1@FutureEd123" },
    { name: "Employee 2", email: "employee2@futureeducation.in", password: "Emp2@FutureEd123" },
    { name: "Employee 3", email: "employee3@futureeducation.in", password: "Emp3@FutureEd123" },
    { name: "Employee 4", email: "employee4@futureeducation.in", password: "Emp4@FutureEd123" },
    { name: "Employee 5", email: "employee5@futureeducation.in", password: "Emp5@FutureEd123" },
  ];

  for (const emp of employees) {
    const hash = await bcrypt.hash(emp.password, 12);
    await prisma.user.upsert({
      where: { email: emp.email },
      update: { passwordHash: hash },
      create: {
        name: emp.name,
        email: emp.email,
        passwordHash: hash,
        role: "EMPLOYEE",
        branchId: branch.id,
      },
    });
  }

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
