import { useState } from "react";
import type { InviteStatuses, User } from "@prisma/client";
import { useFetcher } from "@remix-run/react";
import {
  RefreshIcon,
  RemoveUserIcon,
  UserXIcon,
  VerticalDotsIcon,
} from "~/components/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "~/components/shared/dropdown";

import { isFormProcessing } from "~/utils";
import { Button } from "../shared";
import { Spinner } from "../shared/spinner";

export function TeamUsersActionsDropdown({
  userId,
  inviteStatus,
  name,
  email,
}: {
  userId: User["id"] | null;
  inviteStatus: InviteStatuses;
  name?: string;
  email: string;
}) {
  const fetcher = useFetcher();
  const disabled = isFormProcessing(fetcher.state);
  const [open, setOpen] = useState(false);

  return (
    <>
      <DropdownMenu
        modal={false}
        onOpenChange={(open) => setOpen(open)}
        open={open}
      >
        <DropdownMenuTrigger className="size-6 pr-2 outline-none focus-visible:border-0">
          <i className="inline-block px-3 py-0 text-gray-400 ">
            {disabled ? <Spinner className="size-4" /> : <VerticalDotsIcon />}
          </i>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="order w-[180px] rounded-md bg-white p-[6px] text-right"
          asChild
        >
          <fetcher.Form
            method="post"
            onSubmit={() => {
              setOpen(false);
            }}
          >
            {/* Only show resend button if the invite is not accepted */}
            {inviteStatus !== "ACCEPTED" ? (
              <>
                <input type="hidden" name="name" value={name} />
                <input type="hidden" name="email" value={email} />
                <Button
                  type="submit"
                  variant="link"
                  className="justify-start px-4 py-3  text-gray-700 hover:bg-slate-100 hover:text-gray-700 focus:bg-slate-100"
                  width="full"
                  name="intent"
                  value="resend"
                  disabled={disabled}
                >
                  <span className="flex items-center gap-2">
                    <RefreshIcon /> Resend invite
                  </span>
                </Button>
                <Button
                  type="submit"
                  variant="link"
                  className="justify-start px-4 py-3  text-gray-700 hover:bg-slate-100 hover:text-gray-700 focus:bg-slate-100"
                  width="full"
                  name="intent"
                  value="cancelInvite"
                  disabled={disabled}
                >
                  <span className="flex items-center gap-2">
                    <UserXIcon /> Cancel invite
                  </span>
                </Button>
              </>
            ) : null}
            {inviteStatus === "ACCEPTED" ? (
              <>
                {userId ? (
                  <input type="hidden" name="userId" value={userId} />
                ) : null}
                <Button
                  type="submit"
                  variant="link"
                  className="justify-start px-4 py-3  text-gray-700 hover:bg-slate-100 hover:text-gray-700 focus:bg-slate-100"
                  width="full"
                  name="intent"
                  value="revokeAccess"
                  disabled={disabled}
                >
                  <span className="flex items-center gap-2">
                    <RemoveUserIcon /> Revoke access
                  </span>
                </Button>
              </>
            ) : null}
          </fetcher.Form>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
