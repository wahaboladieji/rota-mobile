import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[seed] Seeding exact PRD reference plans...');

  const plans = [
    {
      code: 'STARTER',
      basePriceCents: 2000,
      includedSeats: 5,
      extraSeatCents: null,
    },
    {
      code: 'TEAM',
      basePriceCents: 5000,
      includedSeats: 15,
      extraSeatCents: 300,
    },
    {
      code: 'BUSINESS',
      basePriceCents: 12000,
      includedSeats: 40,
      extraSeatCents: 200,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: {
        basePriceCents: plan.basePriceCents,
        includedSeats: plan.includedSeats,
        extraSeatCents: plan.extraSeatCents,
      },
      create: plan,
    });
  }

  console.log('[seed] ✓ Successfully seeded Starter, Team, and Business plans.');
}

main()
  .catch((e) => {
    console.error('[seed] Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
