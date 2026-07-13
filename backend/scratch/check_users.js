const prisma = require('../src/config/db');

async function check() {
  console.log('--- Control Plane Users ---');
  const cpUsers = await prisma.user.findMany();
  console.log(cpUsers);

  console.log('--- Projects ---');
  const projects = await prisma.project.findMany();
  console.log(projects);
}

check();
