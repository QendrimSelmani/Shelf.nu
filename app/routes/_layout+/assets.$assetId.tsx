import type { Location } from "@prisma/client";
import type {
  ActionArgs,
  LinksFunction,
  LoaderArgs,
  SerializeFrom,
  V2_MetaFunction,
} from "@remix-run/node";
import { redirect, json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import mapCss from "maplibre-gl/dist/maplibre-gl.css";
import ActionsDopdown from "~/components/assets/actions-dropdown";
import { AssetImage } from "~/components/assets/asset-image";
import { Notes } from "~/components/assets/notes";
import { ErrorBoundryComponent } from "~/components/errors";
import ContextualModal from "~/components/layout/contextual-modal";
import ContextualSidebar from "~/components/layout/contextual-sidebar";

import Header from "~/components/layout/header";
import type { HeaderData } from "~/components/layout/header/types";
import { ScanDetails } from "~/components/location";

import { Badge } from "~/components/shared";
import { Button } from "~/components/shared/button";
import { Card } from "~/components/shared/card";
import { Tag } from "~/components/shared/tag";
import TextualDivider from "~/components/shared/textual-divider";
import ProfilePicture from "~/components/user/profile-picture";
import { usePosition, useUserData } from "~/hooks";
import { deleteAsset, getAsset } from "~/modules/asset";
import { requireAuthSession, commitAuthSession } from "~/modules/auth";
import { getScanByQrId } from "~/modules/scan";
import { parseScanData } from "~/modules/scan/utils.server";
import assetCss from "~/styles/asset.css";
import {
  assertIsDelete,
  getRequiredParam,
  tw,
  userFriendlyAssetStatus,
} from "~/utils";
import { appendToMetaTitle } from "~/utils/append-to-meta-title";
import { getDateTimeFormat } from "~/utils/client-hints";
import { sendNotification } from "~/utils/emitter/send-notification.server";
import { parseMarkdownToReact } from "~/utils/md.server";
import { deleteAssets } from "~/utils/storage.server";

export async function loader({ request, params }: LoaderArgs) {
  const { userId } = await requireAuthSession(request);
  const id = getRequiredParam(params, "assetId");

  const asset = await getAsset({ userId, id });
  if (!asset) {
    throw new Response("Not Found", { status: 404 });
  }
  /** We get the first QR code(for now we can only have 1)
   * And using the ID of tha qr code, we find the latest scan
   */
  const lastScan = asset.qrCodes[0]?.id
    ? parseScanData({
        scan: (await getScanByQrId({ qrId: asset.qrCodes[0].id })) || null,
        userId,
        request,
      })
    : null;

  const notes = asset.notes.map((note) => ({
    ...note,
    dateDisplay: getDateTimeFormat(request).format(note.createdAt),
    content: parseMarkdownToReact(note.content),
  }));

  let custody = null;
  if (asset.custody) {
    const date = new Date(asset.custody.createdAt);
    const dateDisplay = getDateTimeFormat(request).format(date);

    custody = {
      ...asset.custody,
      dateDisplay,
    };
  }

  const header: HeaderData = {
    title: asset.title,
  };

  return json({
    asset: {
      ...asset,
      custody,
      notes,
    },
    lastScan,
    header,
  });
}
export async function action({ request, params }: ActionArgs) {
  assertIsDelete(request);
  const id = getRequiredParam(params, "assetId");
  const authSession = await requireAuthSession(request);
  const formData = await request.formData();
  const mainImageUrl = formData.get("mainImage") as string;

  await deleteAsset({ userId: authSession.userId, id });
  await deleteAssets({
    url: mainImageUrl,
    bucketName: "assets",
  });

  sendNotification({
    title: "Asset deleted",
    message: "Your asset has been deleted successfully",
    icon: { name: "trash", variant: "error" },
    senderId: authSession.userId,
  });

  return redirect(`/assets`, {
    headers: {
      "Set-Cookie": await commitAuthSession(request, { authSession }),
    },
  });
}

export const meta: V2_MetaFunction<typeof loader> = ({ data }) => [
  { title: appendToMetaTitle(data?.header?.title) },
];

export const handle = {
  breadcrumb: () => "single",
};

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: assetCss },
  { rel: "stylesheet", href: mapCss },
];

export default function AssetDetailsPage() {
  const { asset } = useLoaderData<typeof loader>();
  const assetIsAvailable = asset.status === "AVAILABLE";
  /** Due to some conflict of types between prisma and remix, we need to use the SerializeFrom type
   * Source: https://github.com/prisma/prisma/discussions/14371
   */
  const location = asset?.location as SerializeFrom<Location>;
  const user = useUserData();
  usePosition();

  return (
    <>
      <AssetImage
        asset={{
          assetId: asset.id,
          mainImage: asset.mainImage,
          mainImageExpiration: asset.mainImageExpiration,
          alt: asset.title,
        }}
        className="mx-auto mb-8 h-[240px] w-full rounded-lg object-cover sm:w-[343px] md:hidden"
      />
      <Header
        subHeading={
          <div className="mt-3 flex gap-2">
            <Badge color={assetIsAvailable ? "#12B76A" : "#2E90FA"}>
              {userFriendlyAssetStatus(asset.status)}
            </Badge>
            {location ? (
              <span className="inline-flex justify-center rounded-2xl bg-gray-100 px-[6px] py-[2px] text-center text-[12px] font-medium text-gray-700">
                {location.name}
              </span>
            ) : null}
          </div>
        }
      >
        <Button
          to="qr"
          variant="secondary"
          icon="barcode"
          onlyIconOnMobile={true}
        >
          View QR code
        </Button>
        <ActionsDopdown asset={asset} />
      </Header>

      <ContextualModal />
      <div className="mt-8 block lg:flex">
        <div className="shrink-0 overflow-hidden lg:w-[343px] xl:w-[400px]">
          <AssetImage
            asset={{
              assetId: asset.id,
              mainImage: asset.mainImage,
              mainImageExpiration: asset.mainImageExpiration,
              alt: asset.title,
            }}
            className={tw(
              "hidden h-auto w-[343px] rounded-lg border object-cover md:block lg:w-full",
              asset.description ? "rounded-b-none border-b-0" : ""
            )}
          />
          {asset.description ? (
            <Card className="mt-0 rounded-t-none">
              <p className=" text-gray-600">{asset.description}</p>
            </Card>
          ) : null}

          {/* We simply check if the asset is available and we can assume that if it't not, there is a custodian assigned */}
          {!assetIsAvailable && asset?.custody?.createdAt ? (
            <Card>
              <div className="flex items-center gap-3">
                <img
                  src="/images/default_pfp.jpg"
                  alt="custodian"
                  className="h-10 w-10 rounded"
                />
                <div>
                  <p className="">
                    In custody of{" "}
                    <span className="font-semibold">
                      {asset.custody?.custodian.name}
                    </span>
                  </p>
                  <span>Since {asset.custody.dateDisplay}</span>
                </div>
              </div>
            </Card>
          ) : null}

          <TextualDivider text="Details" className="mb-8 lg:hidden" />
          <Card>
            <ul className="item-information">
              <li className="mb-4 flex justify-between">
                <span className="text-[12px] font-medium text-gray-600">
                  ID
                </span>
                <div className="max-w-[250px]">{asset.id}</div>
              </li>
              {asset?.category ? (
                <li className="mb-4 flex justify-between">
                  <span className="text-[12px] font-medium text-gray-600">
                    Category
                  </span>
                  <div className="max-w-[250px]">
                    <Badge color={asset.category?.color}>
                      {asset.category?.name}
                    </Badge>
                  </div>
                </li>
              ) : null}
              {location ? (
                <li className="mb-2 flex justify-between">
                  <span className="text-[12px] font-medium text-gray-600">
                    Location
                  </span>
                  <div className="max-w-[250px]">
                    <Tag key={location.id} className="mb-2 ml-2">
                      {location.name}
                    </Tag>
                  </div>
                </li>
              ) : null}
              {asset?.tags?.length > 0 ? (
                <li className="mb-2 flex justify-between">
                  <span className="text-[12px] font-medium text-gray-600">
                    Tags
                  </span>
                  <div className="text-right ">
                    {asset.tags.map((tag) => (
                      <Tag key={tag.id} className="mb-2 ml-2">
                        {tag.name}
                      </Tag>
                    ))}
                  </div>
                </li>
              ) : null}
              <li className="flex justify-between">
                <span className="text-[12px] font-medium text-gray-600">
                  Owner
                </span>
                <div className="max-w-[250px]">
                  <span className="mb-1 ml-1 inline-flex items-center rounded-2xl bg-gray-100 px-2 py-0.5">
                    <ProfilePicture width="w-4" height="h-4" />
                    <span className="ml-1.5 text-[12px] font-medium text-gray-700">
                      {user?.firstName} {user?.lastName}
                    </span>
                  </span>
                </div>
              </li>
            </ul>
          </Card>

          <ScanDetails />
        </div>

        <div className="w-full lg:ml-6">
          <TextualDivider text="Notes" className="mb-8 lg:hidden" />
          <Notes />
        </div>
      </div>
      <ContextualSidebar />
    </>
  );
}

export const ErrorBoundary = () => (
  <ErrorBoundryComponent title="Sorry, asset you are looking for doesn't exist" />
);
