import { OrganizationRoles } from "@prisma/client";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Form,
  useActionData,
  useNavigation,
  useSearchParams,
} from "@remix-run/react";
import { parseFormAny, useZorm } from "react-zorm";
import z from "zod";
import {
  Select,
  SelectGroup,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectValue,
  SelectTrigger,
} from "~/components/forms";
import Input from "~/components/forms/input";
import { UserIcon } from "~/components/icons";
import { Button } from "~/components/shared";
import { Image } from "~/components/shared/image";
import { db } from "~/database";
import { useCurrentOrganization } from "~/hooks/use-current-organization-id";
import { createInvite } from "~/modules/invite";
import { assertUserCanInviteUsersToWorkspace } from "~/modules/tier";
import styles from "~/styles/layout/custom-modal.css";
import { isFormProcessing, tw, validEmail } from "~/utils";
import { sendNotification } from "~/utils/emitter/send-notification.server";
import { PermissionAction, PermissionEntity } from "~/utils/permissions";
import { requirePermision } from "~/utils/roles.server";
import type { UserFriendlyRoles } from "./settings.team";

const InviteUserFormSchema = z.object({
  email: z
    .string()
    .transform((email) => email.toLowerCase())
    .refine(validEmail, () => ({
      message: "Please enter a valid email",
    })),
  teamMemberId: z.string().optional(),
  role: z.nativeEnum(OrganizationRoles),
});

export const loader = async ({ context, request }: LoaderFunctionArgs) => {
  const authSession = context.getSession();
  const { userId } = authSession;

  const { organizationId } = await requirePermision({
    userId,
    request,
    entity: PermissionEntity.teamMember,
    action: PermissionAction.create,
  });
  await assertUserCanInviteUsersToWorkspace({ organizationId });
  return json({
    showModal: true,
  });
};

export const action = async ({ context, request }: ActionFunctionArgs) => {
  const authSession = context.getSession();
  const { userId } = authSession;

  const { organizationId } = await requirePermision({
    userId,
    request,
    entity: PermissionEntity.teamMember,
    action: PermissionAction.create,
  });

  const formData = await request.formData();
  const result = await InviteUserFormSchema.safeParseAsync(
    parseFormAny(formData)
  );

  if (!result.success) {
    return json(
      {
        errors: { ...result.error, invite: null },
      },
      { status: 400 }
    );
  }

  const { email, teamMemberId, role } = result.data;

  let teamMemberName = email.split("@")[0];
  if (teamMemberId) {
    const teamMember = await db.teamMember.findUnique({
      where: { deletedAt: null, id: teamMemberId },
    });
    if (teamMember) {
      teamMemberName = teamMember.name;
    }
  }

  const invite = await createInvite({
    organizationId,
    inviteeEmail: email,
    inviterId: userId,
    roles: [role],
    teamMemberName,
    teamMemberId,
    userId,
  });

  if (invite) {
    sendNotification({
      title: "Successfully invited user",
      message:
        "They will receive an email in which they can complete their registration.",
      icon: { name: "success", variant: "success" },
      senderId: userId,
    });
    return redirect("/settings/team", {});
  }
  return null;
};

export function links() {
  return [{ rel: "stylesheet", href: styles }];
}

const organizationRolesMap: Record<string, UserFriendlyRoles> = {
  [OrganizationRoles.ADMIN]: "Administrator",
  [OrganizationRoles.SELF_SERVICE]: "Self service",
};

export default function InviteUser() {
  const organization = useCurrentOrganization();
  const zo = useZorm("NewQuestionWizardScreen", InviteUserFormSchema);
  const navigation = useNavigation();
  const disabled = isFormProcessing(navigation.state);
  const [searchParams] = useSearchParams();
  const teamMemberId = searchParams.get("teamMemberId");

  const actionData = useActionData<typeof action>();
  return organization ? (
    <>
      <div className="modal-content-wrapper">
        <div className="mb-4 inline-flex size-8 items-center justify-center  rounded-full bg-primary-100 p-2 text-primary-600">
          <UserIcon color="#ef6820" />
        </div>
        <div className="mb-5">
          <h4>Invite team members</h4>
          <p>
            Invite a user to this workspace. Make sure to give them the proper
            role.
          </p>
        </div>
        <Form method="post" className="flex flex-col gap-3" ref={zo.ref}>
          {teamMemberId ? (
            <input type="hidden" name="teamMemberId" value={teamMemberId} />
          ) : null}
          <SelectGroup>
            <SelectLabel className="pl-0">Workspace</SelectLabel>
            <Select name="organizationId" defaultValue={organization.id}>
              <div className="flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-transparent px-3.5 py-3 text-[16px] text-gray-500 placeholder:text-gray-500 focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-25 focus:ring-offset-2  disabled:opacity-50">
                <SelectValue />
              </div>
              <SelectContent
                position="popper"
                className="w-full min-w-[300px]"
                align="start"
              >
                <div className=" max-h-[320px] overflow-auto">
                  <SelectItem
                    value={organization.id}
                    key={organization.id}
                    className="p-2"
                  >
                    <div className="flex items-center gap-2">
                      <Image
                        imageId={organization.imageId}
                        alt="img"
                        className={tw("size-6 rounded-[2px] object-cover")}
                      />

                      <div className=" ml-[1px] text-sm text-gray-900">
                        {organization.name}
                      </div>
                    </div>
                  </SelectItem>
                </div>
              </SelectContent>
            </Select>
          </SelectGroup>

          <SelectGroup>
            <SelectLabel className="pl-0">Role</SelectLabel>
            <Select name="role" defaultValue={OrganizationRoles.ADMIN}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                position="popper"
                className="w-full min-w-[300px]"
                align="start"
              >
                <div className=" max-h-[320px] overflow-auto">
                  {Object.entries(organizationRolesMap).map(([k, v]) => (
                    <SelectItem value={k} key={k} className="p-2">
                      <div className="flex items-center gap-2">
                        <div className=" ml-[1px] block text-sm lowercase text-gray-900 first-letter:uppercase">
                          {v}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </div>
              </SelectContent>
            </Select>
          </SelectGroup>

          <div className="pt-1.5">
            <Input
              name={zo.fields.email()}
              type="email"
              autoComplete="email"
              disabled={disabled}
              error={zo.errors.email()?.message}
              icon="mail"
              label={"Email address"}
              placeholder="rick@rolled.com"
              required
            />
          </div>
          <div className="mt-7 flex gap-1">
            <Button
              variant="secondary"
              to=".."
              size="sm"
              width="full"
              disabled={disabled}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" width="full" disabled={disabled}>
              Send Invite
            </Button>
          </div>
        </Form>
        {actionData?.errors?.invite && (
          <div className="text-sm text-error-500">
            {actionData.errors?.invite}
          </div>
        )}
      </div>
    </>
  ) : null;
}
