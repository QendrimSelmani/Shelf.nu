import {
  type CustomField,
  type Organization,
  type Prisma,
  type User,
} from "@prisma/client";
import { badRequest } from "remix-utils";
import { db } from "~/database";
import { getDefinitionFromCsvHeader } from "~/utils/custom-fields";
import type { CustomFieldDraftPayload } from "./types";
import type { CreateAssetFromContentImportPayload } from "../asset";

export async function createCustomField({
  name,
  helpText,
  type,
  required,
  organizationId,
  active,
  userId,
  options = []
}: CustomFieldDraftPayload) {
  return db.customField.create({
    data: {
      name,
      helpText,
      type,
      required,
      active,
      options,
      organization: {
        connect: {
          id: organizationId,
        },
      },
      createdBy: {
        connect: {
          id: userId,
        },
      },
    },
  });
}

export async function getFilteredAndPaginatedCustomFields({
  organizationId,
  page = 1,
  perPage = 8,
  search,
}: {
  organizationId: Organization["id"];

  /** Page number. Starts at 1 */
  page?: number;

  /** Items to be loaded per page */
  perPage?: number;

  search?: string | null;
}) {
  const skip = page > 1 ? (page - 1) * perPage : 0;
  const take = perPage >= 1 ? perPage : 8; // min 1 and max 25 per page

  /** Default value of where. Takes the items belonging to current user */
  let where: Prisma.CustomFieldWhereInput = { organizationId };

  /** If the search string exists, add it to the where object */
  if (search) {
    where.name = {
      contains: search,
      mode: "insensitive",
    };
  }

  const [customFields, totalCustomFields] = await db.$transaction([
    /** Get the items */
    db.customField.findMany({
      skip,
      take,
      where,
      orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
    }),

    /** Count them */
    db.customField.count({ where }),
  ]);

  return { customFields, totalCustomFields };
}

export async function getCustomField({
  organizationId,
  id,
}: Pick<CustomField, "id"> & {
  organizationId: Organization["id"];
}) {
  const [customField] = await db.$transaction([
    /** Get the item */
    db.customField.findFirst({
      where: { id, organizationId },
    }),
  ]);

  return { customField };
}

export async function updateCustomField(payload: {
  id: CustomField["id"];
  name?: CustomField["name"];
  helpText?: CustomField["helpText"];
  type?: CustomField["type"];
  required?: CustomField["required"];
  active?: CustomField["active"];
  options?: CustomField["options"]
}) {
  const { id, name, helpText, required, active, options } = payload;
  //dont ever update type
  //updating type would require changing all custom field values to that type
  //which might fail when changing to incompatible type hence need a careful definition
  const data = {
    name,
    helpText,
    required,
    active,
    options
  };

  return await db.customField.update({
    where: { id },
    data: data,
  });
}

export async function upsertCustomField(definitions: CustomFieldDraftPayload[]): Promise<Record<string, CustomField>> {
  const customFields: Record<string, CustomField> = {};

  for (const def of definitions) {
    let existingCustomField = await db.customField.findFirst({
      where: {
        name: def.name,
        organizationId: def.organizationId,
      },
    });

    if (!existingCustomField) {
      const newCustomField = await createCustomField(def);
      customFields[def.name] = newCustomField
    } else {
      if (existingCustomField.type !== def.type) {
        throw badRequest(`custom field with name ${def.name} already exist with diffrent type ${existingCustomField.type}`)
      }
      if (existingCustomField.type === "OPTION") {
        const newOptions = def.options?.filter(op => !existingCustomField?.options?.includes(op))
        if (newOptions?.length) {
          //create non exisitng options
          const options = (existingCustomField?.options || []).concat(Array.from(new Set(newOptions)))
          existingCustomField = await updateCustomField({ id: existingCustomField.id, options });
        }
      }
      customFields[def.name] = existingCustomField
    }
  }

  return customFields;
}
//returns {name:customField}
export async function createCustomFieldsIfNotExists({
  data,
  userId,
  organizationId,
}: {
  data: CreateAssetFromContentImportPayload[];
  userId: User["id"];
  organizationId: Organization["id"];
}): Promise<Record<string, CustomField>> {

  //{CF header:[all options in csv combined]}
  const optionMap: Record<string, string[]> = {}
  //{CF header: definition to create}
  const fieldToDefDraftMap: Record<string, CustomFieldDraftPayload> = {}
  for (let item of data) {
    Object.keys(item).map((k) => {
      if (k.startsWith("cf:")) {
        const def = getDefinitionFromCsvHeader(k)
        if (!fieldToDefDraftMap[k]) {
          fieldToDefDraftMap[k] = { ...def, userId, organizationId }
        }
        if (def.type === "OPTION") {
          optionMap[k] = (optionMap[k] || []).concat([item[k]])
        }
      }
    })
  }

  for (const [customFieldDefStr, def] of Object.entries(fieldToDefDraftMap)) {
    if (def.type === "OPTION" && optionMap[customFieldDefStr]?.length) {
      def.options = optionMap[customFieldDefStr]
    }
  }

  return upsertCustomField(Object.values(fieldToDefDraftMap));
}

export async function getActiveCustomFields({ userId }: { userId: string }) {
  return await db.customField.findMany({
    where: {
      userId,
      active: true,
    },
  });
}
