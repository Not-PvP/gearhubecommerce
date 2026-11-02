const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const catalog = require(path.join(__dirname, "seed-data", "products.json"));

async function main() {
  for (const item of catalog) {
    const data = {
      name: item.name,
      category: item.category,
      description: item.description,
      price: item.price,
      imageUrl: item.image,
      stockQuantity: item.stock,
    };

    await prisma.product.upsert({
      where: { id: Number(item.id) },
      update: data,
      create: { id: Number(item.id), ...data },
    });
  }

  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('products', 'id'), (SELECT COALESCE(MAX(id), 1) FROM products))`,
  );

  console.log(`Seeded ${catalog.length} products.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
