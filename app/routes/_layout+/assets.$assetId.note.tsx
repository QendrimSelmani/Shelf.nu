import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { parseFormAny } from "react-zorm";
import { NewNoteSchema } from "~/components/assets/notes/new";
import { createNote, deleteNote } from "~/modules/asset";
import { assertIsDelete, assertIsPost, isDelete, isPost } from "~/utils";
import { sendNotification } from "~/utils/emitter/send-notification.server";
import { PermissionAction, PermissionEntity } from "~/utils/permissions";
import { requirePermision } from "~/utils/roles.server";

export const loader = async ({ params }: LoaderFunctionArgs) =>
  /** makes sure that if the user navigates to that url, it redirects back to asset */
  redirect(`/assets/${params.assetId}`);

export const action = async ({
  context,
  request,
  params,
}: ActionFunctionArgs) => {
  const authSession = await context.getSession();
  const { userId } = authSession;

  await requirePermision({
    userId,
    request,
    entity: PermissionEntity.asset,
    action: PermissionAction.update,
  });
  const formData = await request.formData();

  /* Create note */
  if (isPost(request)) {
    assertIsPost(request);
    const result = await NewNoteSchema.safeParseAsync(parseFormAny(formData));

    if (!result.success) {
      return json(
        {
          errors: result.error,
        },
        {
          status: 400,
        }
      );
    }

    if (!params.assetId)
      return json({ errors: "assetId is required" }, { status: 400 });

    sendNotification({
      title: "Note created",
      message: "Your note has been created successfully",
      icon: { name: "success", variant: "success" },
      senderId: authSession.userId,
    });
    const note = await createNote({
      ...result.data,
      assetId: params.assetId,
      userId: authSession.userId,
    });

    return json({ note });
  }

  /* Delete note */
  if (isDelete(request)) {
    assertIsDelete(request);
    const noteId = formData.get("noteId") as string | null;
    if (!noteId) return json({ errors: "noteId is required" }, { status: 400 });

    sendNotification({
      title: "Note deleted",
      message: "Your note has been deleted successfully",
      icon: { name: "trash", variant: "error" },
      senderId: authSession.userId,
    });

    const deleted = await deleteNote({
      id: noteId,
      userId: authSession.userId,
    });
    return json({ deleted });
  }
};
