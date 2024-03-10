import { OrganizationRoles } from "@prisma/client";
import type {
  ActionFunctionArgs,
  LinksFunction,
  LoaderFunctionArgs,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { DateTime } from "luxon";
import { parseFormAny } from "react-zorm";
import { BookingForm, NewBookingFormSchema } from "~/components/booking/form";
import styles from "~/components/booking/styles.new.css";
import { db } from "~/database";

import { upsertBooking } from "~/modules/booking";
import { setSelectedOrganizationIdCookie } from "~/modules/organization/context.server";
import { getClientHint, getHints } from "~/utils/client-hints";
import { setCookie } from "~/utils/cookies.server";
import { dateForDateTimeInputValue } from "~/utils/date-fns";
import { sendNotification } from "~/utils/emitter/send-notification.server";
import { PermissionAction, PermissionEntity } from "~/utils/permissions";
import { requirePermision } from "~/utils/roles.server";

/**
 * In the case of bookings, when the user clicks "new", we automatically create the booking.
 * In order to not have to manage 2 different pages for new and view/edit we do some simple but big brain strategy
 * In the .new route we dont even return any html, we just create a draft booking and directly redirect to the .bookingId route.
 * This way all actions are available and its way easier to manage so in a way this works kind of like a resource route.
 */
export async function loader({ context, request }: LoaderFunctionArgs) {
  const authSession = context.getSession();
  const { organizationId, role } = await requirePermision({
    userId: authSession?.userId,
    request,
    entity: PermissionEntity.booking,
    action: PermissionAction.create,
  });

  const isSelfService = role === OrganizationRoles.SELF_SERVICE;

  const booking = await upsertBooking(
    {
      organizationId,
      name: "Draft booking",
      creatorId: authSession.userId,
      // If the user is self service, we already set them as the custodian as that is the only possible option
      ...(isSelfService && {
        custodianUserId: authSession.userId,
      }),
    },
    getClientHint(request)
  );

  const [teamMembers, org] = await db.$transaction([
    /**
     * We need to fetch the team members to be able to display them in the custodian dropdown.
     */
    db.teamMember.findMany({
      where: {
        deletedAt: null,
        organizationId,
        userId: {
          not: null,
        },
      },
      include: {
        user: true,
      },
      orderBy: {
        userId: "asc",
      },
    }),
    /** We create a teamMember entry to represent the org owner.
     * Most important thing is passing the ID of the owner as the userId as we are currently only supporting
     * assigning custody to users, not NRM.
     */
    db.organization.findUnique({
      where: {
        id: organizationId,
      },
      select: {
        owner: true,
      },
    }),
  ]);

  if (org?.owner) {
    teamMembers.push({
      id: "owner",
      name: "owner",
      user: org.owner,
      userId: org.owner.id as string,
      organizationId,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
  }

  return json(
    {
      showModal: true,
      booking,
      teamMembers,
    },
    {
      headers: [
        setCookie(await setSelectedOrganizationIdCookie(organizationId)),
      ],
    }
  );
}

export async function action({ context, request }: ActionFunctionArgs) {
  const formData = await request.formData();

  const authSession = context.getSession();
  const { organizationId } = await requirePermision({
    userId: authSession?.userId,
    request,
    entity: PermissionEntity.booking,
    action: PermissionAction.create,
  });

  const result = await NewBookingFormSchema().safeParseAsync(
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

  const { name, custodian, id } = result.data;
  const hints = getHints(request);
  const startDate = formData.get("startDate")!.toString();
  const endDate = formData.get("endDate")!.toString();
  const fmt = "yyyy-MM-dd'T'HH:mm";
  const from = DateTime.fromFormat(startDate, fmt, {
    zone: hints.timeZone,
  }).toJSDate();
  const to = DateTime.fromFormat(endDate, fmt, {
    zone: hints.timeZone,
  }).toJSDate();
  var booking = await upsertBooking(
    {
      custodianUserId: custodian,
      organizationId,
      id,
      name,
      from,
      to,
    },
    getClientHint(request)
  );

  sendNotification({
    title: "Booking saved",
    message: "Your booking has been saved successfully",
    icon: { name: "success", variant: "success" },
    senderId: authSession.userId,
  });

  const manageAssetsUrl = `/bookings/${
    booking.id
  }/add-assets?${new URLSearchParams({
    // We force the as Date because we know that the booking.from and booking.to are set and exist at this point.
    bookingFrom: (booking.from as Date).toISOString(),
    bookingTo: (booking.to as Date).toISOString(),
    hideUnavailable: "true",
    unhideAssetsBookigIds: booking.id,
  })}`;

  return redirect(manageAssetsUrl);
}

export const handle = {
  name: "bookings.new",
};

export const links: LinksFunction = () => [{ rel: "stylesheet", href: styles }];
export default function NewBooking() {
  const { booking, teamMembers } = useLoaderData<typeof loader>();

  return (
    <div>
      <header className="mb-5">
        <h2>Create new booking</h2>
        <p>
          Choose a name for your booking, select a start and end time and choose
          the custodian. Based on the selected information, asset availability
          will be determined.
        </p>
      </header>
      <div>
        <BookingForm
          id={booking.id}
          name={booking.name}
          startDate={
            booking.from
              ? dateForDateTimeInputValue(new Date(booking.from))
              : undefined
          }
          endDate={
            booking.to
              ? dateForDateTimeInputValue(new Date(booking.to))
              : undefined
          }
          custodianUserId={
            booking.custodianUserId ||
            teamMembers.find(
              (member) => member.user?.id === booking.custodianUserId
            )?.id
          }
          isModal={true}
        />
      </div>
    </div>
  );
}
