/* eslint-disable no-console */
import type { User } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import { ShelfStackError } from "~/utils/error";

const prisma = new PrismaClient();

async function seed() {
  try {
    const user = (await prisma.user.findFirst({
      where: {
        email: process.env.ADMIN_EMAIL,
      },
    })) as User;

    const times = 100;
    const assets = [];
    for (let i = 0; i < times; i++) {
      assets.push({
        title: `Asset ${i}`,
        description: `Asset ${i} description`,
        userId: user.id,
      });
    }

    assets.map(async (asset) => {
      await prisma.asset.create({
        data: asset,
      });
    });
  } catch (cause) {
    throw new ShelfStackError({ message: "Seed failed 🥲", cause });
  }
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
