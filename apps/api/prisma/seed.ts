import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

config({ path: '../../.env' });

const prisma = new PrismaClient();

async function main() {
  // Keep the seeded database identity aligned with the environment-configured demo login.
  const email = process.env.DEMO_EMAIL;
  if (!email) throw new Error('DEMO_EMAIL must be configured before seeding the demo account.');
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });

  await prisma.subscription.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
