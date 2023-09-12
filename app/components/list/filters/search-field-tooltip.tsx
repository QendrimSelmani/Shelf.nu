import { useLoaderData } from "@remix-run/react";
import { HelpIcon } from "~/components/icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/shared/tooltip";

export const SearchFieldTooltip = () => {
  const { searchFieldTooltip } = useLoaderData();
  return searchFieldTooltip ? (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <i className="absolute right-3.5 top-1/2 flex -translate-y-1/2 cursor-pointer text-gray-400 hover:text-gray-700">
            <HelpIcon />
          </i>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="max-w-[260px] sm:max-w-[320px]">
            <h6 className="mb-1 text-xs font-semibold text-gray-700">
              Powerful database search
            </h6>
            <p className="text-xs font-medium text-gray-500">
              Search database entries on asset name or <b>description</b>,
              <b>category</b>, <b>tag</b>, <b>location</b>, <b>custodian names</b>. Separate your keywords
              with spaces for the best results.
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : null;
};
