const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.licenseHealthLicense.count({ where: { licenseId: "cmqzmphed000fl134vxob0va9" } });
    console.log(JSON.stringify({ ok: true }));
  } catch (error) {
    console.log(JSON.stringify({
      ok: false,
      code: error.code ?? null,
      meta: error.meta ?? null,
      message: String(error.message).replace(/\n/g, " ").slice(0, 500),
    }));
  } finally {
    await prisma.$disconnect();
  }
}

main();
