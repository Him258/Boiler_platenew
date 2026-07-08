const bcrypt = require('bcryptjs');
const prisma = require('./src/config/db');

async function seed() {
  try {
    const tenant = await prisma.tenant.create({
      data: {
        organization: 'Admin Tenant',
        domain: 'admin.kiaan.core'
      }
    });

    const passwordHash = await bcrypt.hash('123456', 10);
    const user = await prisma.user.create({
      data: {
        email: 'boilerplate@gmail.com',
        name: 'Admin User',
        passwordHash,
        tenantId: tenant.id,
        role: 'Super Admin'
      }
    });
    console.log('Seeded User:', user);
  } catch (error) {
    console.error('Error seeding:', error);
  } finally {
    await prisma.$disconnect();
  }
}
seed();
