// Demo accounts for trying the app on a fresh machine: npm run seed:demo
// DEMO ONLY: these passwords are public, so this refuses to run in production.
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to create demo accounts in production.");
  process.exit(1);
}

const prisma = new PrismaClient();

const accounts = [
  { email: "admin@gearhub.com", password: "admin1234", isAdmin: true },
  { email: "customer@gearhub.com", password: "customer1234", isAdmin: false },
];

async function main() {
  for (const { email, password, isAdmin } of accounts) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`${email} already exists, left as it is.`);
      continue;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({ data: { email, passwordHash, isAdmin } });
    console.log(`Created ${isAdmin ? "admin" : "customer"} account: ${email} / ${password}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
