import { OrganizationRoles, OrganizationType } from "@prisma/client";
import type { Organization, User } from "@prisma/client";

import { db } from "~/database";
import { ShelfStackError } from "~/utils/error";
import { defaultUserCategories } from "../category/default-categories";

export const getOrganization = async ({
  id,
  userId,
}: {
  id: Organization["id"];
  userId: User["id"];
}) =>
  db.organization.findUnique({
    where: {
      id,
      owner: {
        is: {
          id: userId,
        },
      },
    },
  });

export const getOrganizationByUserId = async ({
  userId,
  orgType,
}: {
  userId: User["id"];
  orgType: OrganizationType;
}) => {
  try {
    return await db.organization.findFirstOrThrow({
      where: {
        owner: {
          is: {
            id: userId,
          },
        },
        type: orgType,
      },
      select: {
        id: true,
        name: true,
        type: true,
        currency: true,
      },
    });
  } catch (cause) {
    throw new ShelfStackError({
      message: "Organization not found",
      cause,
      metadata: {
        userId,
      },
    });
  }
};

export type UserOrganization = Awaited<
  ReturnType<typeof getOrganizationByUserId>
>;

export const getUserOrganizationsWithDetailedData = async ({
  userId,
}: {
  userId: User["id"];
}) =>
  await db.organization.findMany({
    where: {
      owner: {
        is: {
          id: userId,
        },
      },
    },
    include: {
      _count: {
        select: {
          assets: true,
          members: true,
        },
      },
    },
  });

export async function createOrganization({
  name,
  userId,
  image,
  currency,
}: Pick<Organization, "name" | "currency"> & {
  userId: User["id"];
  image: File | null;
}) {
  const data = {
    name,
    currency,
    type: OrganizationType.TEAM,
    categories: {
      create: defaultUserCategories.map((c) => ({ ...c, userId })),
    },
    userOrganizations: {
      create: {
        userId,
        roles: [OrganizationRoles.OWNER],
      },
    },
    owner: {
      connect: {
        id: userId,
      },
    },
  };

  const org = await db.organization.create({ data });
  if (image?.size && image?.size > 0) {
    await db.image.create({
      data: {
        blob: Buffer.from(await image.arrayBuffer()),
        contentType: image.type,
        ownerOrg: {
          connect: {
            id: org.id,
          },
        },
        organization: {
          connect: {
            id: org.id,
          },
        },
        user: {
          connect: {
            id: userId,
          },
        },
      },
    });
  }
  return org;
}
export async function updateOrganization({
  id,
  name,
  image,
  userId,
  currency,
}: Pick<Organization, "name" | "id" | "currency"> & {
  userId: User["id"];
  image: File | null;
}) {
  const data = {
    name,
    currency,
  };

  if (image?.size && image?.size > 0) {
    const imageData = {
      blob: Buffer.from(await image.arrayBuffer()),
      contentType: image.type,
      ownerOrg: {
        connect: {
          id: id,
        },
      },
      user: {
        connect: {
          id: userId,
        },
      },
    };

    Object.assign(data, {
      image: {
        upsert: {
          create: imageData,
          update: imageData,
        },
      },
    });
  }

  return await db.organization.update({
    where: { id },
    data: data,
  });
}

export const getUserOrganizations = async ({ userId }: { userId: string }) => {
  const userOrganizations = await db.userOrganization.findMany({
    where: { userId },
    select: {
      roles: true,
      organization: {
        select: {
          id: true,
          type: true,
          name: true,
          imageId: true,
          userId: true,
          updatedAt: true,
          currency: true,
        },
      },
    },
  });

  return userOrganizations;
};

export const getOrganizationAdminsEmails = async ({
  organizationId,
}: {
  organizationId: string;
}) => {
  const admins = await db.userOrganization.findMany({
    where: {
      organizationId,
      roles: {
        hasSome: [OrganizationRoles.OWNER, OrganizationRoles.ADMIN],
      },
    },
    select: {
      user: {
        select: {
          email: true,
        },
      },
    },
  });

  return admins.map((a) => a.user.email);
};
