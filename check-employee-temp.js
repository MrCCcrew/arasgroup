const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkEmployee() {
  const employees = await prisma.employee.findMany({
    where: { civilId: '285011209979' },
    select: {
      id: true,
      companyId: true,
      nameAr: true,
      civilId: true,
      isDeleted: true,
      deletedAt: true,
      employmentStatus: true,
      company: { select: { nameAr: true } }
    }
  });

  console.log('=== نتيجة البحث ===');
  if (employees.length === 0) {
    console.log('لا يوجد موظف بهذا الرقم المدني');
  } else {
    employees.forEach((emp, i) => {
      console.log(`\nموظف ${i + 1}:`);
      console.log(`  الاسم: ${emp.nameAr}`);
      console.log(`  الشركة: ${emp.company.nameAr}`);
      console.log(`  الحالة: ${emp.employmentStatus}`);
      console.log(`  محذوف؟ ${emp.isDeleted ? 'نعم' : 'لا'}`);
      console.log(`  تاريخ الحذف: ${emp.deletedAt || 'لا يوجد'}`);
    });
  }

  await prisma.$disconnect();
}

checkEmployee().catch(console.error);
