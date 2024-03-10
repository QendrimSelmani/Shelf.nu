import { cloneElement } from "react";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import { useNavigation } from "@remix-run/react";
import type { ModelFilterItem, ModelFilterProps } from "~/hooks";
import { useModelFilters } from "~/hooks";
import { isFormProcessing, tw } from "~/utils";
import { EmptyState } from "./empty-state";
import Input from "../forms/input";
import { CheckIcon } from "../icons";
import { Button } from "../shared";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../shared/dropdown";
import type { Icon } from "../shared/icons-map";
import { Spinner } from "../shared/spinner";
import When from "../when/when";

type Props = ModelFilterProps & {
  className?: string;
  style?: React.CSSProperties;
  trigger: React.ReactElement;
  label?: string;
  searchIcon?: Icon;
  showSearch?: boolean;
  renderItem?: (options: {
    item: ModelFilterItem;
    checked: boolean;
  }) => React.ReactNode;
};

export default function DynamicDropdown({
  className,
  style,
  label = "Filter",
  trigger,
  searchIcon = "search",
  model,
  initialDataKey,
  countKey,
  showSearch = true,
  renderItem,
}: Props) {
  const navigation = useNavigation();
  const isSearching = isFormProcessing(navigation.state);

  const {
    selectedItems,
    searchQuery,
    setSearchQuery,
    handleSearchQueryChange,
    totalItems,
    items,
    handleSelectItemChange,
    clearFilters,
    resetModelFiltersFetcher,
    getAllEntries,
  } = useModelFilters({
    model,
    countKey,
    initialDataKey,
  });

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        className="inline-flex items-center gap-2 text-gray-500"
        asChild
      >
        <div>
          {cloneElement(trigger)}
          <When truthy={selectedItems.length > 0}>
            <div className="flex size-6 items-center justify-center rounded-full bg-primary-50 px-2 py-[2px] text-xs font-medium text-primary-700">
              {selectedItems.length}
            </div>
          </When>
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className={tw(
          "w-[290px] overflow-y-hidden p-0 md:w-[350px]",
          className
        )}
        style={style}
      >
        <div className="flex items-center justify-between p-3">
          <div className="text-xs font-semibold text-gray-700">{label}</div>
          <When truthy={selectedItems.length > 0 && showSearch}>
            <Button
              as="button"
              variant="link"
              className="whitespace-nowrap text-xs font-normal text-gray-500 hover:text-gray-600"
              onClick={clearFilters}
            >
              Clear filter
            </Button>
          </When>
        </div>

        <When truthy={showSearch}>
          <div className="filters-form relative border-y border-y-gray-200 p-3">
            <Input
              type="text"
              label={`Search ${label}`}
              placeholder={`Search ${label}`}
              hideLabel
              className="text-gray-500"
              icon={searchIcon}
              autoFocus
              value={searchQuery}
              onChange={handleSearchQueryChange}
            />
            <When truthy={Boolean(searchQuery)}>
              <Button
                icon="x"
                variant="tertiary"
                disabled={Boolean(searchQuery)}
                onClick={() => {
                  resetModelFiltersFetcher();
                  setSearchQuery("");
                }}
                className="z-100 pointer-events-auto absolute right-[14px] top-0 mr-2 h-full border-0 p-0 text-center text-gray-400 hover:text-gray-900"
              />
            </When>
          </div>
        </When>

        <div className="max-h-[320px] divide-y overflow-y-auto">
          {searchQuery !== "" && items.length === 0 && (
            <EmptyState searchQuery={searchQuery} modelName={model.name} />
          )}
          {items.map((item) => {
            const checked = selectedItems.includes(item.id);
            if (typeof renderItem === "function") {
              return (
                <label
                  key={item.id}
                  htmlFor={item.id}
                  className="flex cursor-pointer select-none items-center justify-between px-6 py-4 text-sm font-medium outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 hover:bg-gray-100 focus:bg-gray-100 "
                >
                  {renderItem({ item, checked })}
                  <input
                    id={item.id}
                    type="checkbox"
                    value={item.id}
                    className="hidden"
                    checked={checked}
                    onChange={(e) => {
                      handleSelectItemChange(e.currentTarget.value);
                    }}
                  />
                  <When truthy={checked}>
                    <CheckIcon className="text-primary" />
                  </When>
                </label>
              );
            }

            return (
              <label
                key={item.id}
                htmlFor={item.id}
                className={tw(
                  "flex cursor-pointer select-none items-center justify-between px-6 py-4 text-sm font-medium outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 hover:bg-gray-100 focus:bg-gray-100",
                  checked && "bg-gray-50"
                )}
              >
                {item.name}
                <input
                  id={item.id}
                  type="checkbox"
                  value={item.id}
                  className="hidden"
                  checked={checked}
                  onChange={(e) => {
                    handleSelectItemChange(e.currentTarget.value);
                  }}
                />
                <When truthy={checked}>
                  <CheckIcon className="text-primary" />
                </When>
              </label>
            );
          })}

          {items.length < totalItems && searchQuery === "" && (
            <button
              disabled={isSearching}
              onClick={getAllEntries}
              className="flex w-full cursor-pointer select-none items-center justify-between px-6 py-3 text-sm font-medium text-gray-600 outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 hover:bg-gray-100 focus:bg-gray-100"
            >
              Show all
              <span>
                {isSearching ? (
                  <Spinner className="size-4" />
                ) : (
                  <ChevronDownIcon className="size-4" />
                )}
              </span>
            </button>
          )}
        </div>
        <When truthy={totalItems > 6}>
          <div className="border-t p-3 text-gray-500">
            Showing {items.length} out of {totalItems}, type to search for more
          </div>
        </When>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
