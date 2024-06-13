import type {
  ActionFunctionArgs,
  LinksFunction,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { redirect, json } from "@remix-run/node";
import { useLoaderData, Outlet } from "@remix-run/react";
import mapCss from "maplibre-gl/dist/maplibre-gl.css?url";
import { z } from "zod";
import ActionsDropdown from "~/components/assets/actions-dropdown";
import { AssetImage } from "~/components/assets/asset-image";
import { AssetStatusBadge } from "~/components/assets/asset-status-badge";

import Header from "~/components/layout/header";
import type { HeaderData } from "~/components/layout/header/types";
import HorizontalTabs from "~/components/layout/horizontal-tabs";
import { useUserIsSelfService } from "~/hooks/user-user-is-self-service";
import {
  deleteAsset,
  deleteOtherImages,
  getAsset,
  updateAssetBookingAvailability,
} from "~/modules/asset/service.server";
import {
  createQr,
  generateCode,
  getQrByAssetId,
} from "~/modules/qr/service.server";
import { getScanByQrId } from "~/modules/scan/service.server";
import { parseScanData } from "~/modules/scan/utils.server";
import assetCss from "~/styles/asset.css?url";

import { appendToMetaTitle } from "~/utils/append-to-meta-title";
import { checkExhaustiveSwitch } from "~/utils/check-exhaustive-switch";
import { getDateTimeFormat, getLocale } from "~/utils/client-hints";
import { sendNotification } from "~/utils/emitter/send-notification.server";
import { makeShelfError } from "~/utils/error";
import {
  error,
  getParams,
  data,
  parseData,
  getCurrentSearchParams,
} from "~/utils/http.server";
import { parseMarkdownToReact } from "~/utils/md.server";
import {
  PermissionAction,
  PermissionEntity,
} from "~/utils/permissions/permission.validator.server";
import { requirePermission } from "~/utils/roles.server";
import { tw } from "~/utils/tw";
type SizeKeys = "cable" | "small" | "medium" | "large";

export const AvailabilityForBookingFormSchema = z.object({
  availableToBook: z
    .string()
    .transform((val) => val === "on")
    .default("false"),
});

export async function loader({ context, request, params }: LoaderFunctionArgs) {
  const authSession = context.getSession();
  const { userId } = authSession;
  const { assetId: id } = getParams(params, z.object({ assetId: z.string() }), {
    additionalData: { userId },
  });

  try {
    const { organizationId } = await requirePermission({
      userId,
      request,
      entity: PermissionEntity.asset,
      action: PermissionAction.read,
    });

    const locale = getLocale(request);

    const asset = await getAsset({ organizationId, id });

    const searchParams = getCurrentSearchParams(request);
    const size = (searchParams.get("size") || "medium") as SizeKeys;

    let qr = await getQrByAssetId({ assetId: id });

    if (!qr) {
      /** If for some reason there is no QR, we create one and return it */
      qr = await createQr({ assetId: id, userId, organizationId });
    }

    // Create a QR code with a URL
    const { sizes, code } = await generateCode({
      version: qr.version as TypeNumber,
      errorCorrection: qr.errorCorrection as ErrorCorrectionLevel,
      size,
      qr,
    });

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
      dateDisplay: getDateTimeFormat(request, {
        dateStyle: "short",
        timeStyle: "short",
      }).format(note.createdAt),
      content: parseMarkdownToReact(note.content),
    }));

    let custody = null;
    if (asset.custody) {
      const date = new Date(asset.custody.createdAt);
      const dateDisplay = getDateTimeFormat(request, {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date);

      custody = {
        ...asset.custody,
        dateDisplay,
      };
    }

    const header: HeaderData = {
      title: asset.title,
    };

    const qrObj = {
      qr: code,
      sizes,
      showSidebar: true,
    };

    const booking = asset.bookings.length > 0 ? asset.bookings[0] : undefined;
    let currentBooking: any = null;

    if (booking && booking.from) {
      const bookingFrom = new Date(booking.from);
      const bookingDateDisplay = getDateTimeFormat(request, {
        dateStyle: "short",
        timeStyle: "short",
      }).format(bookingFrom);

      currentBooking = { ...booking, from: bookingDateDisplay };

      asset.bookings = [currentBooking];
    }

    return json(
      data({
        asset: {
          ...asset,
          createdAt: getDateTimeFormat(request, {
            dateStyle: "short",
            timeStyle: "short",
          }).format(asset.createdAt),
          custody,
          notes,
          /** We only need customField with same category of asset or without any category */
          customFields: asset.categoryId
            ? asset.customFields.filter(
                (cf) =>
                  !cf.customField.categories.length ||
                  cf.customField.categories
                    .map((c) => c.id)
                    .includes(asset.categoryId!)
              )
            : asset.customFields,
        },
        lastScan,
        header,
        locale,
        qrObj: {
          ...qrObj,
        },
      })
    );
  } catch (cause) {
    const reason = makeShelfError(cause);
    throw json(error(reason));
  }
}

export async function action({ context, request, params }: ActionFunctionArgs) {
  const authSession = context.getSession();
  const { userId } = authSession;
  const { assetId: id } = getParams(params, z.object({ assetId: z.string() }), {
    additionalData: { userId },
  });

  try {
    const formData = await request.formData();

    const { intent } = parseData(
      formData,
      z.object({ intent: z.enum(["delete", "toggle"]) })
    );

    const intent2ActionMap: { [K in typeof intent]: PermissionAction } = {
      delete: PermissionAction.delete,
      toggle: PermissionAction.update,
    };

    const { organizationId } = await requirePermission({
      userId,
      request,
      entity: PermissionEntity.asset,
      action: intent2ActionMap[intent],
    });

    switch (intent) {
      case "delete": {
        const { mainImageUrl } = parseData(
          formData,
          z.object({ mainImageUrl: z.string().optional() })
        );

        await deleteAsset({ organizationId, id });

        if (mainImageUrl) {
          // as it is deletion operation giving hardcoded path(to make sure all the images were deleted)
          await deleteOtherImages({
            userId,
            assetId: id,
            data: { path: `main-image-${id}.jpg` },
          });
        }

        sendNotification({
          title: "Asset deleted",
          message: "Your asset has been deleted successfully",
          icon: { name: "trash", variant: "error" },
          senderId: authSession.userId,
        });

        return redirect(`/assets`);
      }
      case "toggle": {
        const { availableToBook } = parseData(
          formData,
          AvailabilityForBookingFormSchema
        );

        await updateAssetBookingAvailability(id, availableToBook);

        sendNotification({
          title: "Asset availability status updated successfully",
          message: "Your asset's availability for booking has been updated",
          icon: { name: "success", variant: "success" },
          senderId: authSession.userId,
        });

        return json(data(null));
      }
      default: {
        checkExhaustiveSwitch(intent);
        return json(data(null));
      }
    }
  } catch (cause) {
    const reason = makeShelfError(cause, { userId, id });
    return json(error(reason), { status: reason.status });
  }
}

export const meta: MetaFunction<typeof loader> = ({ data }) => [
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

  let items = [
    { to: "overview", content: "Overview" },
    { to: "activity", content: "Activity" },
  ];
  /** Due to some conflict of types between prisma and remix, we need to use the SerializeFrom type
   * Source: https://github.com/prisma/prisma/discussions/14371
   */
  const isSelfService = useUserIsSelfService();
  return (
    <>
      <Header
        slots={{
          "left-of-title": (
            <AssetImage
              asset={{
                assetId: asset.id,
                mainImage: asset.mainImage,
                mainImageExpiration: asset.mainImageExpiration,
                alt: asset.title,
              }}
              className={tw(
                "mr-4 size-[56px] cursor-pointer rounded border object-cover"
              )}
              withPreview
            />
          ),
        }}
        subHeading={
          <div className="flex gap-2">
            <AssetStatusBadge
              status={asset.status}
              availableToBook={asset.availableToBook}
            />
          </div>
        }
      >
        {!isSelfService ? <ActionsDropdown /> : null}
      </Header>
      <HorizontalTabs items={items} />
      <div>
        <Outlet />
      </div>
    </>
  );
}
