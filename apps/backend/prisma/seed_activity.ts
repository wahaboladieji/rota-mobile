import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const EVENT_TYPES = [
  'SHIFT_CREATED',
  'SHIFT_PUBLISHED',
  'SHIFT_UPDATED',
  'SHIFT_CANCELLED',
  'SWAP_REQUESTED',
  'SWAP_ACCEPTED',
  'SWAP_APPROVED',
  'MEMBER_INVITED',
  'MEMBER_JOINED',
];

export async function seedActivityEvents(targetCount = 10000) {
  console.log(`[seed-activity] Starting seeding of ${targetCount}+ activity events...`);

  // 1. Ensure or find a benchmark user & team
  let benchmarkUser = await prisma.user.findFirst({
    where: { email: 'benchmark-activity@rota.dev' },
  });

  if (!benchmarkUser) {
    benchmarkUser = await prisma.user.create({
      data: {
        email: 'benchmark-activity@rota.dev',
        passwordHash: '$2b$10$ep1QG5u3/02p4mE3Wp82ueeI3E8B5M2sYJmP6KzT9iYV5R8.8gDqG', // Dummy hash
      },
    });
  }

  let benchmarkTeam = await prisma.team.findFirst({
    where: { name: '10K Activity Benchmark Team' },
  });

  if (!benchmarkTeam) {
    benchmarkTeam = await prisma.team.create({
      data: {
        name: '10K Activity Benchmark Team',
        ownerId: benchmarkUser.id,
      },
    });

    await prisma.membership.create({
      data: {
        teamId: benchmarkTeam.id,
        userId: benchmarkUser.id,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
  }

  // Also ensure a secondary team for team isolation verification
  let secondaryTeam = await prisma.team.findFirst({
    where: { name: 'Secondary Isolation Team' },
  });

  if (!secondaryTeam) {
    secondaryTeam = await prisma.team.create({
      data: {
        name: 'Secondary Isolation Team',
        ownerId: benchmarkUser.id,
      },
    });
  }

  // Count existing events
  const existingCount = await prisma.activityEvent.count({
    where: { teamId: benchmarkTeam.id },
  });

  if (existingCount >= targetCount) {
    console.log(`[seed-activity] Team already has ${existingCount} events. Skipping insert.`);
    return { teamId: benchmarkTeam.id, secondaryTeamId: secondaryTeam.id, count: existingCount };
  }

  const toCreate = targetCount - existingCount;
  console.log(`[seed-activity] Generating ${toCreate} records with tied timestamps and realistic distribution...`);

  const batchSize = 1000;
  let created = 0;
  const baseTime = Date.now() - 180 * 24 * 60 * 60 * 1000; // 180 days ago

  while (created < toCreate) {
    const currentBatch = Math.min(batchSize, toCreate - created);
    const records: any[] = [];

    for (let i = 0; i < currentBatch; i++) {
      const globalIndex = created + i;

      // Create intentional clusters of identical timestamps (every 20th group shares identical millisecond)
      const tiedCluster = Math.floor(globalIndex / 10);
      const isTied = globalIndex % 10 < 3; // 3 items in every 10 share the exact same timestamp
      const timestampMs = isTied
        ? baseTime + tiedCluster * 100000
        : baseTime + globalIndex * 15000 + (globalIndex % 7) * 1000;

      const eventType = EVENT_TYPES[globalIndex % EVENT_TYPES.length];

      records.push({
        id: crypto.randomUUID(),
        teamId: benchmarkTeam.id,
        actorId: benchmarkUser.id,
        type: eventType,
        targetId: crypto.randomUUID(),
        payload: {
          shiftTitle: `Shift #${globalIndex}`,
          details: `Automated benchmark activity log entry #${globalIndex}`,
          seq: globalIndex,
        },
        createdAt: new Date(timestampMs),
      });
    }

    await prisma.activityEvent.createMany({
      data: records,
    });

    created += currentBatch;
    process.stdout.write(`[seed-activity] Seeded ${created}/${toCreate} events...\r`);
  }

  console.log(`\n[seed-activity] Successfully seeded ${created} records for primary benchmark team.`);

  // Seed 500 events for secondary team for isolation testing if not present
  const secondaryCount = await prisma.activityEvent.count({
    where: { teamId: secondaryTeam.id },
  });

  if (secondaryCount < 500) {
    const secondaryRecords: any[] = [];
    for (let i = 0; i < 500; i++) {
      secondaryRecords.push({
        id: crypto.randomUUID(),
        teamId: secondaryTeam.id,
        actorId: benchmarkUser.id,
        type: EVENT_TYPES[i % EVENT_TYPES.length],
        targetId: crypto.randomUUID(),
        payload: { secondary: true, index: i },
        createdAt: new Date(baseTime + i * 20000),
      });
    }
    await prisma.activityEvent.createMany({ data: secondaryRecords });
    console.log(`[seed-activity] Seeded 500 isolation events for secondary team.`);
  }

  const finalTotal = await prisma.activityEvent.count({
    where: { teamId: benchmarkTeam.id },
  });

  console.log(`[seed-activity] ✓ Complete. Total events for ${benchmarkTeam.name}: ${finalTotal}`);
  return { teamId: benchmarkTeam.id, secondaryTeamId: secondaryTeam.id, count: finalTotal };
}

if (require.main === module) {
  seedActivityEvents(10000)
    .catch((e) => {
      console.error('[seed-activity] Error seeding:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
