const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const project = await prisma.project.findUnique({
    where: { id: '6cecb9c8-62ce-4ed0-b8bb-f6178b7344d9' }
  });
  console.log('Project tenantId:', project ? project.tenantId : 'not found');
}

run().catch(console.error).finally(() => prisma.$disconnect());
