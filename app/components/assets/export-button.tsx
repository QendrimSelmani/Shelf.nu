import { useLoaderData } from "@remix-run/react";
import type { loader } from "~/routes/_layout+/assets._index";
import { ControlledActionButton } from "../shared/controlled-action-button";

export const ExportButton = ({
  canExportAssets,
}: {
  canExportAssets: boolean;
}) => {
  const { totalItems } = useLoaderData<typeof loader>();
  return (
    <ControlledActionButton
      canUseFeature={canExportAssets}
      buttonContent={{
        title: "Download CSV",
        message: "Exporting is not available on the free tier of shelf.",
      }}
      buttonProps={{
        to: `/assets/export/assets-${new Date()
          .toISOString()
          .slice(0, 10)}.csv`,
        variant: "secondary",
        role: "link",
        download: true,
        reloadDocument: true,
        disabled: !canExportAssets || totalItems === 0,
        title: totalItems === 0 ? "No assets to export" : "Export assets",
      }}
    />
  );
};
