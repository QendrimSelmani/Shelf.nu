import {
  json,
  unstable_parseMultipartFormData,
  unstable_createMemoryUploadHandler,
} from "@remix-run/node";
import type {
  ActionFunctionArgs,
  MetaFunction,
  LoaderFunctionArgs,
} from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useAtomValue } from "jotai";
import { parseFormAny } from "react-zorm";
import invariant from "tiny-invariant";
import { dynamicTitleAtom } from "~/atoms/dynamic-title-atom";
import Header from "~/components/layout/header";
import type { HeaderData } from "~/components/layout/header/types";
import { LocationForm, NewLocationFormSchema } from "~/components/location";
import { getLocation, updateLocation } from "~/modules/location";
import { getRequiredParam } from "~/utils";
import { appendToMetaTitle } from "~/utils/append-to-meta-title";
import { sendNotification } from "~/utils/emitter/send-notification.server";
import { ShelfStackError } from "~/utils/error";
import { PermissionAction, PermissionEntity } from "~/utils/permissions";
import { requirePermision } from "~/utils/roles.server";
import { MAX_SIZE } from "./locations.new";

export async function loader({ context, request, params }: LoaderFunctionArgs) {
  const authSession = context.getSession();
  const { organizationId } = await requirePermision({
    userId: authSession.userId,
    request,
    entity: PermissionEntity.location,
    action: PermissionAction.update,
  });

  const id = getRequiredParam(params, "locationId");

  const { location } = await getLocation({ organizationId, id });
  if (!location) {
    throw new ShelfStackError({ message: "Location Not Found", status: 404 });
  }

  const header: HeaderData = {
    title: `Edit | ${location.name}`,
  };

  return json({
    location,
    header,
  });
}

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data ? appendToMetaTitle(data.header.title) : "" },
];

export const handle = {
  breadcrumb: () => <span>Edit</span>,
};

export async function action({ context, request, params }: ActionFunctionArgs) {
  const authSession = context.getSession();
  const { organizationId } = await requirePermision({
    userId: authSession.userId,
    request,
    entity: PermissionEntity.location,
    action: PermissionAction.update,
  });
  const clonedRequest = request.clone();

  const id = getRequiredParam(params, "locationId");
  const formData = await request.formData();
  const result = await NewLocationFormSchema.safeParseAsync(
    parseFormAny(formData)
  );

  if (!result.success) {
    return json(
      {
        errors: result.error,
        success: false,
      },
      {
        status: 400,
      }
    );
  }

  const { name, description, address } = result.data;

  const formDataFile = await unstable_parseMultipartFormData(
    clonedRequest,
    unstable_createMemoryUploadHandler({ maxPartSize: MAX_SIZE })
  );

  const file = formDataFile.get("image") as File | null;
  invariant(file instanceof File, "file not the right type");

  const rsp = await updateLocation({
    id,
    userId: authSession.userId,
    name,
    description,
    address,
    image: file || null,
    organizationId,
  });
  // Handle unique constraint error for name
  if (rsp.error) {
    return json(
      {
        errors: {
          name: rsp.error,
        },
      },
      {
        status: 400,
      }
    );
  }

  sendNotification({
    title: "Location updated",
    message: "Your location  has been updated successfully",
    icon: { name: "success", variant: "success" },
    senderId: authSession.userId,
  });

  return json({ success: true });
}

export default function LocationEditPage() {
  const name = useAtomValue(dynamicTitleAtom);
  const hasName = name !== "";
  const { location } = useLoaderData<typeof loader>();

  return (
    <>
      <Header title={hasName ? name : location.name} />
      <div className=" items-top flex justify-between">
        <LocationForm
          name={location.name}
          description={location.description}
          address={location.address}
        />
      </div>
    </>
  );
}
