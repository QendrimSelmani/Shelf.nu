import type { ReactElement } from "react";
import { useRef, useState } from "react";
import type { CustomField, CustomFieldType } from "@prisma/client";
import { CalendarIcon } from "@radix-ui/react-icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@radix-ui/react-popover";
import { Link, useLoaderData, useNavigation } from "@remix-run/react";
import { format } from "date-fns";
import type { Zorm } from "react-zorm";
import type { z } from "zod";
import type { ShelfAssetCustomFieldValueType } from "~/modules/asset/types";
import type { loader } from "~/routes/_layout+/assets.$assetId_.edit";
import { getCustomFieldDisplayValue } from "~/utils/custom-fields";
import { isFormProcessing } from "~/utils/form";
import { tw } from "~/utils/tw";
import { zodFieldIsRequired } from "~/utils/zod";
import { Calendar } from "../forms/calendar-input";
import FormRow from "../forms/form-row";
import Input from "../forms/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../forms/select";
import { Switch } from "../forms/switch";
import { SearchIcon } from "../icons/library";
import { Button } from "../shared/button";

export default function AssetCustomFields({
  zo,
  schema,
  autoIdCreation,
  formType,
}: {
  zo: Zorm<z.ZodObject<any, any, any>>;
  schema: z.ZodObject<any, any, any>;
  autoIdCreation?: boolean;
  formType?: string;
}) {
  const optionTriggerRef = useRef<HTMLButtonElement>(null);

  /** Get the custom fields from the loader */

  const { customFields, asset } = useLoaderData<typeof loader>();

  const customFieldsValues =
    (asset?.customFields as unknown as ShelfAssetCustomFieldValueType[]) || [];

  const [dateObj, setDateObj] = useState(
    customFieldsValues
      .filter((v) => v.value.valueDate)
      .reduce(
        (res, cur) => {
          res[cur.customFieldId] = new Date(cur.value.valueDate!);
          return res;
        },
        {} as Record<string, Date | null>
      )
  );

  const navigation = useNavigation();
  const disabled = isFormProcessing(navigation.state);

  const getCustomFieldVal = (id: string) => {
    const value = customFieldsValues?.find((cfv) => cfv.customFieldId === id)
      ?.value;
    return value ? getCustomFieldDisplayValue(value) : "";
  };

  const fieldTypeToCompMap: {
    [key in CustomFieldType]?: (field: CustomField) => ReactElement;
  } = {
    BOOLEAN: (field) => (
      <div className="flex items-center gap-3">
        <Switch
          name={`cf-${field.id}`}
          disabled={disabled}
          defaultChecked={
            getCustomFieldVal(field.id) === "true" || field.required
          }
        />
        <label className="font-medium text-gray-700 lg:hidden">
          <span className={field.required ? "required-input-label" : ""}>
            {field.name}
          </span>
        </label>
      </div>
    ),
    DATE: (field) => (
      <>
        <label className="mb-1.5 font-medium text-gray-700 lg:hidden">
          <span className={field.required ? "required-input-label" : ""}>
            {field.name}
          </span>
        </label>
        <input
          name={`cf-${field.id}`}
          value={dateObj[field.id]?.toISOString() || ""}
          hidden
        />
        <Popover>
          <div className="flex w-full items-center gap-x-2">
            <PopoverTrigger asChild>
              <Button
                variant="secondary"
                className={tw(
                  "w-full pl-1 text-left font-normal md:min-w-[300px]",
                  !dateObj[field.id] && "text-muted-foreground"
                )}
              >
                <div className="flex justify-between">
                  {dateObj[field.id] ? (
                    <span>{format(new Date(dateObj[field.id]!), "PPP")}</span>
                  ) : (
                    <span>Pick a date</span>
                  )}
                  <CalendarIcon className="ml-3 size-5" />
                </div>
              </Button>
            </PopoverTrigger>

            {dateObj[field.id] ? (
              <Button
                icon="x"
                variant="secondary"
                type="button"
                onClick={() => {
                  setDateObj({ ...dateObj, [field.id]: null });
                }}
              />
            ) : null}
          </div>
          {zo.errors[`cf-${field.id}`]()?.message ? (
            <p className="text-sm text-error-500">
              {zo.errors[`cf-${field.id}`]()?.message}
            </p>
          ) : null}

          <PopoverContent side="top" className="z-[100] w-auto p-0" align="end">
            <Calendar
              name={`cf-${field.id}`}
              mode="single"
              selected={dateObj[field.id]}
              onSelect={(d: Date) => setDateObj({ ...dateObj, [field.id]: d })}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </>
    ),
    OPTION: (field) => {
      const val = getCustomFieldVal(field.id);

      return (
        <>
          <label className="mb-1.5 font-medium text-gray-700 lg:hidden">
            <span className={field.required ? "required-input-label" : ""}>
              {field.name}
            </span>
          </label>
          <Select
            name={`cf-${field.id}`}
            defaultValue={val ? val : undefined}
            disabled={disabled}
          >
            <SelectTrigger className="px-3.5 py-3" ref={optionTriggerRef}>
              <SelectValue placeholder={`Choose ${field.name}`} />
            </SelectTrigger>
            {zo.errors[`cf-${field.id}`]()?.message ? (
              <p className="text-sm text-error-500">
                {zo.errors[`cf-${field.id}`]()?.message}
              </p>
            ) : null}

            <SelectContent
              position="popper"
              className="w-full min-w-[300px] p-0"
              align="center"
              sideOffset={5}
              style={{ width: optionTriggerRef.current?.clientWidth }}
            >
              <div className="max-h-[320px] w-full overflow-auto">
                {field.options.map((value, index) => (
                  <SelectItem
                    value={value}
                    key={value + index}
                    className="w-full px-6 py-4"
                  >
                    <span className="mr-4 text-[14px] text-gray-700">
                      {value.toLowerCase()}
                    </span>
                  </SelectItem>
                ))}
              </div>
            </SelectContent>
          </Select>
        </>
      );
    },
  };

  return (
    <div className="border-b pb-6">
      <div className="mb-6 border-b pb-5">
        <h2 className="mb-1 text-[18px] font-semibold">Custom Fields</h2>
        <Link
          to="/settings/custom-fields"
          className="font-medium text-primary-600"
        >
          Manage custom fields
        </Link>
      </div>
      {customFields.length > 0 ? (
        customFields.map((field, index) => {
          const value = customFieldsValues?.find(
            (cfv) => cfv.customFieldId === field.id
          )?.value;
          const displayVal = value ? getCustomFieldDisplayValue(value) : "";
          return (
            <FormRow
              key={field.id + index}
              rowLabel={field.name}
              subHeading={field.helpText ? <p>{field.helpText}</p> : undefined}
              className="border-b-0"
              required={field.required}
            >
              {typeof fieldTypeToCompMap[field.type] === "function" ? (
                fieldTypeToCompMap[field.type]!(field as unknown as CustomField)
              ) : (
                <Input
                  hideLabel
                  placeholder={field.helpText || undefined}
                  inputType={
                    field.type === "MULTILINE_TEXT" ? "textarea" : "input"
                  }
                  type={field.type.toLowerCase()}
                  label={field.name}
                  name={`cf-${field.id}`}
                  error={zo.errors[`cf-${field.id}`]()?.message}
                  disabled={disabled}
                  defaultValue={displayVal}
                  className="w-full"
                  required={zodFieldIsRequired(schema.shape[`cf-${field.id}`])}
                  autoIdCreation={!!autoIdCreation}
                  formType={formType}
                />
              )}
            </FormRow>
          );
        })
      ) : (
        <div>
          <div className=" mx-auto max-w-screen-sm rounded-xl border border-gray-300 bg-white px-5 py-10 text-center">
            <div>
              <div className="mb-4 inline-flex items-center justify-center rounded-full border-8 border-solid border-gray-50 bg-gray-100 p-2 text-gray-600">
                <SearchIcon />
              </div>
              <h4 className="mb-6 text-base">No active custom fields</h4>
              <Button to="/settings/custom-fields/new" variant="primary">
                Create custom fields
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
