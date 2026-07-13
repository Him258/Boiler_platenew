const bcrypt = require('bcryptjs');
const prisma = require('./src/config/db');

async function seed() {
  try {
    const passwordHash = await bcrypt.hash('123456', 10);

    // 1. Seed Tenant & User for boilerplate@gmail.com
    let adminTenant = await prisma.tenant.findFirst({
      where: { domain: 'admin.kiaan.core' }
    });
    if (!adminTenant) {
      adminTenant = await prisma.tenant.create({
        data: {
          organization: 'Admin Tenant',
          domain: 'admin.kiaan.core'
        }
      });
    }

    const existingAdmin = await prisma.user.findFirst({
      where: { email: 'boilerplate@gmail.com' }
    });
    if (!existingAdmin) {
      await prisma.user.create({
        data: {
          email: 'boilerplate@gmail.com',
          name: 'Admin User',
          passwordHash,
          tenantId: adminTenant.id,
          role: 'Super Admin'
        }
      });
    }

    // 2. Seed Tenant & User for admin@school.com
    let schoolTenant = await prisma.tenant.findFirst({
      where: { domain: 'school.kiaan.core' }
    });
    if (!schoolTenant) {
      schoolTenant = await prisma.tenant.create({
        data: {
          organization: 'School Tenant',
          domain: 'school.kiaan.core'
        }
      });
    }

    const existingSchool = await prisma.user.findFirst({
      where: { email: 'admin@school.com' }
    });
    if (!existingSchool) {
      await prisma.user.create({
        data: {
          email: 'admin@school.com',
          name: 'School Admin',
          passwordHash,
          tenantId: schoolTenant.id,
          role: 'Super Admin'
        }
      });
    }

    console.log('Successfully seeded database with default admin users!');
  } catch (error) {
    console.error('Error seeding:', error);
  } finally {
    await prisma.$disconnect();
  }
}
seed();
