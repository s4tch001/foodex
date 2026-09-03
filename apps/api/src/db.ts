import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

// The configured demo email must match the user created by the Prisma seed script.
export async function getDemoUser(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { subscription: true },
  });

  if (!user) {
    throw new Error('Demo user is missing. Run the database seed before starting the API.');
  }

  return user;
}
