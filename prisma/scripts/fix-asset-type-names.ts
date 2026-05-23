/**
 * Run once to fix asset type names:
 * - Set nameEn = current nameAr (the English value)
 * - Set nameAr = proper Arabic translation
 *
 * Usage: npx ts-node --project tsconfig.json prisma/scripts/fix-asset-type-names.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TRANSLATIONS: Record<string, string> = {
  "Chemical sprayer":    "رشاش الكيماويات",
  "Cleaning tools":      "أدوات النظافة",
  "Generator":           "مولد كهربائي",
  "Hose":                "خرطوم مياه",
  "Mobile phone":        "هاتف محمول",
  "POS/KNET device":     "جهاز نقطة البيع",
  "SIM card":            "شريحة اتصال",
  "Uniform":             "زي موحد",
  "Vacuum":              "مكنسة كهربائية",
  "Washing machine":     "غسالة",
  "Water tank equipment":"معدات خزان المياه",
  "Fuel card":           "بطاقة وقود",
  "Delivery bag":        "حقيبة توصيل",
  "Helmet":              "خوذة",
  "Car key":             "مفتاح سيارة",
  "Vehicle documents":   "وثائق المركبة",
};

async function main() {
  const records = await prisma.assetItemType.findMany({
    where: { nameAr: { in: Object.keys(TRANSLATIONS) } },
    select: { id: true, nameAr: true, companyId: true },
  });

  console.log(`Found ${records.length} records to update`);

  for (const rec of records) {
    const arabic = TRANSLATIONS[rec.nameAr];
    if (!arabic) continue;

    // Check if a record with the Arabic name already exists for this company
    const conflict = await prisma.assetItemType.findFirst({
      where: { companyId: rec.companyId, nameAr: arabic, id: { not: rec.id } },
      select: { id: true },
    });

    if (conflict) {
      console.log(`⚠ Skipping "${rec.nameAr}" → "${arabic}" (conflict in company ${rec.companyId})`);
      continue;
    }

    await prisma.assetItemType.update({
      where: { id: rec.id },
      data: { nameEn: rec.nameAr, nameAr: arabic },
    });
    console.log(`✓ Updated: "${rec.nameAr}" → "${arabic}"`);
  }

  console.log("Done.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
