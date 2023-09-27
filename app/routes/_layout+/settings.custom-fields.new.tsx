import type { LoaderArgs, V2_MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useAtomValue } from "jotai";
import { parseFormAny } from "react-zorm";
import { titleAtom } from "~/atoms/custom-fields.new";

import {
  CustomFieldForm,
  NewCustomFieldFormSchema,
} from "~/components/custom-fields/form";
import Header from "~/components/layout/header";

import { requireAuthSession, commitAuthSession } from "~/modules/auth";
import { createCustomField } from "~/modules/custom-field";
import { assertUserCanCreateMoreCustomFields } from "~/modules/tier";

import { assertIsPost } from "~/utils";

import { appendToMetaTitle } from "~/utils/append-to-meta-title";
import { sendNotification } from "~/utils/emitter/send-notification.server";

const title = "New Custom Field";

export async function loader({ request }: LoaderArgs) {
  const { userId } = await requireAuthSession(request);

  await assertUserCanCreateMoreCustomFields({ userId });

  const header = {
    title,
  };

  return json({
    header,
  });
}

export const meta: V2_MetaFunction<typeof loader> = ({ data }) => [
  { title: data ? appendToMetaTitle(data?.header?.title) : "" },
];

export const handle = {
  breadcrumb: () => <span>{title}</span>,
};

export async function action({ request }: LoaderArgs) {
  const authSession = await requireAuthSession(request);
  assertIsPost(request);
  await assertUserCanCreateMoreCustomFields({ userId: authSession.userId });

  const formData = await request.formData();
  const result = await NewCustomFieldFormSchema.safeParseAsync(
    parseFormAny(formData)
  );

  if (!result.success) {
    return json(
      {
        errors: result.error,
      },
      {
        status: 400,
        headers: {
          "Set-Cookie": await commitAuthSession(request, { authSession }),
        },
      }
    );
  }

  const { name, helpText, required, type, active, organizationId,options } =
    result.data;

  await createCustomField({
    name,
    helpText,
    required,
    type,
    active,
    organizationId,
    userId: authSession.userId,
    options
  });

  sendNotification({
    title: "Custom Field created",
    message: "Your Custom Field has been created successfully",
    icon: { name: "success", variant: "success" },
    senderId: authSession.userId,
  });

  return redirect(`/settings/custom-fields`, {
    headers: {
      "Set-Cookie": await commitAuthSession(request, { authSession }),
    },
  });
}

export default function NewCustomFieldPage() {
  const title = useAtomValue(titleAtom);

  return (
    <>
      <Header title={title} />
      <div>
        <CustomFieldForm />
      </div>
    </>
  );
}
