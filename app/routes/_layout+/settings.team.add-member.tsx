import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import Input from "~/components/forms/input";
import { UserIcon } from "~/components/icons";
import { Button } from "~/components/shared/button";
import { db } from "~/database";
import styles from "~/styles/layout/custom-modal.css";
import { isFormProcessing } from "~/utils";
import { sendNotification } from "~/utils/emitter/send-notification.server";
import { handleUniqueConstraintError } from "~/utils/error";
import { PermissionAction, PermissionEntity } from "~/utils/permissions";
import { requirePermision } from "~/utils/roles.server";

export const loader = async ({ context, request }: LoaderFunctionArgs) => {
  const authSession = await context.getSession();

  await requirePermision({
    userId: authSession.userId,
    request,
    entity: PermissionEntity.teamMember,
    action: PermissionAction.create,
  });

  return json({
    showModal: true,
  });
};

export const action = async ({ context, request }: ActionFunctionArgs) => {
  const authSession = await context.getSession();
  const { userId } = authSession;

  const { organizationId } = await requirePermision({
    userId,
    request,
    entity: PermissionEntity.teamMember,
    action: PermissionAction.create,
  });
  const formData = await request.formData();

  try {
    const name = formData.get("name") as string;
    const teamMember = await db.teamMember.create({
      data: {
        name: name.trim(),
        organizationId,
      },
    });

    if (!teamMember)
      return json({
        error: {
          general: "Something went wrong. Please try again.",
        },
      });

    sendNotification({
      title: "Successfully added a new team member",
      message: "You are now able to give this team member custody over assets.",
      icon: { name: "success", variant: "success" },
      senderId: userId,
    });

    return redirect(`/settings/team`);
  } catch (cause) {
    const rsp = handleUniqueConstraintError(cause, "Team Member");

    return json(
      { error: { name: rsp.error.message } },
      {
        status: 400,
      }
    );
  }
};

export function links() {
  return [{ rel: "stylesheet", href: styles }];
}

export default function AddMember() {
  const actionData = useActionData<{
    error?: { [key: string]: string };
  }>();
  const navigation = useNavigation();
  const disabled = isFormProcessing(navigation.state);
  return (
    <>
      <div className="modal-content-wrapper">
        <div className="mb-4 inline-flex size-8 items-center justify-center  rounded-full bg-primary-100 p-2 text-primary-600">
          <UserIcon color="#ef6820" />
        </div>
        <div className="mb-5">
          <h4>Add team member</h4>
          <p>
            Team members are added to your environment but do not have an
            account to log in with.
          </p>
        </div>
        <Form method="post">
          <Input
            name="name"
            type="text"
            label="Name"
            className="mb-8"
            placeholder="Enter team member’s name"
            error={actionData?.error?.name}
            required
            autoFocus
          />
          <Button
            variant="primary"
            width="full"
            type="submit"
            disabled={disabled}
          >
            Add team member
          </Button>
        </Form>
        {actionData?.error?.general && (
          <div className="text-sm text-error-500">
            {actionData.error.general}
          </div>
        )}
      </div>
    </>
  );
}
