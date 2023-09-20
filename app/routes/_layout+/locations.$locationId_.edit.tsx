import {
  json,
  unstable_parseMultipartFormData,
  unstable_createMemoryUploadHandler,
} from "@remix-run/node";
import type { ActionArgs, V2_MetaFunction, LoaderArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useAtomValue } from "jotai";
import { parseFormAny } from "react-zorm";
import invariant from "tiny-invariant";
import { titleAtom } from "~/atoms/locations.new";
import Header from "~/components/layout/header";
import type { HeaderData } from "~/components/layout/header/types";
import { LocationForm, NewLocationFormSchema } from "~/components/location";
import { commitAuthSession, requireAuthSession } from "~/modules/auth";
import { getLocation, updateLocation } from "~/modules/location";
import { assertIsPost, getRequiredParam } from "~/utils";
import { appendToMetaTitle } from "~/utils/append-to-meta-title";
import { sendNotification } from "~/utils/emitter/send-notification.server";
import { ShelfStackError } from "~/utils/error";
import { MAX_SIZE } from "./locations.new";

export async function loader({ request, params }: LoaderArgs) {
  const { userId } = await requireAuthSession(request);

  const id = getRequiredParam(params, "locationId");

  const { location } = await getLocation({ userId, id });
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

export const meta: V2_MetaFunction<typeof loader> = ({ data }) => [
  { title: data ? appendToMetaTitle(data.header.title) : "" },
];

export const handle = {
  breadcrumb: () => "Edit",
};

export async function action({ request, params }: ActionArgs) {
  assertIsPost(request);
  const authSession = await requireAuthSession(request);
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
        headers: {
          "Set-Cookie": await commitAuthSession(request, { authSession }),
        },
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

  await updateLocation({
    id,
    userId: authSession.userId,
    name,
    description,
    address,
    image: file || null,
  });

  sendNotification({
    title: "Location updated",
    message: "Your location  has been updated successfully",
    icon: { name: "success", variant: "success" },
    senderId: authSession.userId,
  });

  return json(
    { success: true },
    {
      headers: {
        "Set-Cookie": await commitAuthSession(request, { authSession }),
      },
    }
  );
}

export default function AssetEditPage() {
  const name = useAtomValue(titleAtom);
  const { location } = useLoaderData<typeof loader>();

  return (
    <>
      <Header title={location.name} />
      <div className=" items-top flex justify-between">
        <LocationForm
          name={location.name || name}
          description={location.description}
          address={location.address}
        />
      </div>
    </>
  );
}
