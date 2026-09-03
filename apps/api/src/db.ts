import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

/** Loads the seeded demo user and entitlement, failing clearly when setup is incomplete. */
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
