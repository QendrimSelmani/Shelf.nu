import { useMemo } from "react";

import { AssetStatus, BookingStatus } from "@prisma/client";
import { useLoaderData } from "@remix-run/react";
import { useBookingStatus } from "~/hooks/use-booking-status";
import { useUserIsSelfService } from "~/hooks/user-user-is-self-service";
import type { BookingWithCustodians } from "~/routes/_layout+/bookings";
import type { AssetWithBooking } from "~/routes/_layout+/bookings.$bookingId.add-assets";
import { AssetRowActionsDropdown } from "./asset-row-actions-dropdown";
import { AvailabilityLabel } from "./availability-label";
import { AssetImage } from "../assets/asset-image";
import { AssetStatusBadge } from "../assets/asset-status-badge";
import { List } from "../list";
import { Badge, Button } from "../shared";
import { ControlledActionButton } from "../shared/controlled-action-button";
import TextualDivider from "../shared/textual-divider";
import { Td, Th } from "../table";

export function BookingAssetsColumn() {
  const { booking } = useLoaderData<{ booking: BookingWithCustodians }>();
  const isSelfService = useUserIsSelfService();

  const manageAssetsUrl = useMemo(
    () =>
      `add-assets?${new URLSearchParams({
        // We force the as String because we know that the booking.from and booking.to are strings and exist at this point.
        // This button wouldnt be available at all if there is no booking.from and booking.to
        bookingFrom: new Date(booking.from as string).toISOString(),
        bookingTo: new Date(booking.to as string).toISOString(),
        hideUnavailable: "true",
        unhideAssetsBookigIds: booking.id,
      })}`,
    [booking]
  );

  const isCompleted = useMemo(
    () => booking.status === BookingStatus.COMPLETE,
    [booking.status]
  );
  const isArchived = useMemo(
    () => booking.status === BookingStatus.ARCHIVED,
    [booking.status]
  );

  // Self service can only manage assets for bookings that are DRAFT
  const canManageAssetsAsSelfService =
    isSelfService && booking.status !== BookingStatus.DRAFT;

  return (
    <div className="flex-1">
      <div className=" w-full">
        <TextualDivider text="Assets" className="mb-8 lg:hidden" />
        <div className="mb-3 flex gap-4 lg:hidden"></div>
        <div className="flex flex-col">
          {/* THis is a fake table header */}
          <div className="-mx-4 flex justify-between border border-b-0 bg-white p-4 text-left font-normal text-gray-600 md:mx-0 md:rounded md:px-6">
            <div>
              <div className=" text-md font-semibold text-gray-900">Assets</div>
              <div>{booking.assets.length} items</div>
            </div>
            <ControlledActionButton
              canUseFeature={
                !!booking.from &&
                !!booking.to &&
                !isCompleted &&
                !isArchived &&
                !canManageAssetsAsSelfService
              }
              buttonContent={{
                title: "Manage Assets",
                message: isCompleted
                  ? "Booking is completed. You cannot change the assets anymore"
                  : isSelfService
                  ? "You are unable to manage assets at this point becasue the booking is already reserved. Cancel this booking and create another one if you need to make changes."
                  : "You need to select a start and end date and save your booking before you can add assets to your booking",
              }}
              buttonProps={{
                as: "button",
                to: manageAssetsUrl,
                icon: "plus",
                className: "whitespace-nowrap",
              }}
              skipCta={true}
            />
          </div>
          <List
            ItemComponent={ListAssetContent}
            hideFirstHeaderColumn={true}
            headerChildren={
              <>
                <Th>Name</Th>
                <Th> </Th>
                <Th>Category</Th>
                <Th> </Th>
              </>
            }
            customEmptyStateContent={{
              title: "Start by defining a booking period",
              text: "Assets added to your booking will show up here. You must select a Start and End date and Save your booking in order to be able to add assets.",
              newButtonRoute: manageAssetsUrl,
              newButtonContent: "Manage Assets",
              buttonProps: {
                disabled: !booking.from || !booking.to,
              },
            }}
            className="md:rounded-t-[0px]"
          />
        </div>
      </div>
    </div>
  );
}

const ListAssetContent = ({ item }: { item: AssetWithBooking }) => {
  const { category } = item;
  const { booking } = useLoaderData<{ booking: BookingWithCustodians }>();
  const isSelfService = useUserIsSelfService();
  const { isOngoing, isCompleted, isArchived, isOverdue } =
    useBookingStatus(booking);

  /** Weather the asset is checked out in a booking different than the current one */
  const isCheckedOut = useMemo(
    () =>
      (item.status === AssetStatus.CHECKED_OUT &&
        !item.bookings.some((b) => b.id === booking.id)) ??
      false,
    [item.status, item.bookings, booking.id]
  );

  return (
    <>
      <Td className="w-full p-0 md:p-0">
        <div className="flex justify-between gap-3 p-4 md:justify-normal md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center">
              <AssetImage
                asset={{
                  assetId: item.id,
                  mainImage: item.mainImage,
                  mainImageExpiration: item.mainImageExpiration,
                  alt: item.title,
                }}
                className="size-full rounded-[4px] border object-cover"
              />
            </div>
            <div className="flex flex-row items-center gap-2 md:flex-col md:items-start md:gap-0">
              <div className="min-w-[130px]">
                <span className="word-break mb-1 block font-medium">
                  <Button
                    to={`/assets/${item.id}`}
                    variant="link"
                    className="text-gray-900 hover:text-gray-700"
                  >
                    {item.title}
                  </Button>
                </span>
                <div>
                  <AssetStatusBadge
                    status={item.status}
                    availableToBook={item.availableToBook}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Td>
      {/* If asset status is different than available, we need to show a label */}
      <Td>
        {!isCompleted && !isArchived ? (
          <AvailabilityLabel asset={item} isCheckedOut={isCheckedOut} />
        ) : null}
      </Td>
      <Td className="">
        {category ? (
          <Badge color={category.color} withDot={false}>
            {category.name}
          </Badge>
        ) : null}
      </Td>
      <Td className="pr-4 text-right">
        {/* Self Service can only remove assets if the booking is not started already */}
        {isSelfService && (isOngoing || isOverdue) ? null : (
          <AssetRowActionsDropdown asset={item} />
        )}
      </Td>
    </>
  );
};
