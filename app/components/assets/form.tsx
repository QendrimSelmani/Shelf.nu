import type { Asset, CustomField, Qr } from "@prisma/client";
import { Form, Link, useLoaderData, useNavigation } from "@remix-run/react";
import { useAtom, useAtomValue } from "jotai";
import type { Tag } from "react-tag-autocomplete";
import { useZorm } from "react-zorm";
import { z } from "zod";
import { updateTitleAtom } from "~/atoms/assets.new";
import { fileErrorAtom, validateFileAtom } from "~/atoms/file";
import { isFormProcessing } from "~/utils";

import { mergedSchema } from "~/utils/custom-field-schema";
import { zodFieldIsRequired } from "~/utils/zod";
import AssetCustomFields from "./custom-fields-inputs";

import { CategorySelect } from "../category/category-select";
import FormRow from "../forms/form-row";
import Input from "../forms/input";
import { LocationSelect } from "../location/location-select";
import { Button } from "../shared";
import { Spinner } from "../shared/spinner";
import { TagsAutocomplete } from "../tag/tags-autocomplete";

export const NewAssetFormSchema = z.object({
  title: z.string().min(2, "Title is required"),
  description: z.string(),
  category: z.string(),
  newLocationId: z.string().optional(),
  /** This holds the value of the current location. We need it for comparison reasons on the server.
   * We send it as part of the form data and compare it with the current location of the asset and prevent querying the database if it's the same.
   */
  currentLocationId: z.string().optional(),
  qrId: z.string().optional(),
  tags: z.string().optional(),
});

/** Pass props of the values to be used as default for the form fields */
interface Props {
  title?: Asset["title"];
  category?: Asset["categoryId"];
  location?: Asset["locationId"];
  description?: Asset["description"];
  qrId?: Qr["id"] | null;
  tags?: Tag[];
}

export const AssetForm = ({
  title,
  category,
  description,
  qrId,
  tags,
}: Props) => {
  const navigation = useNavigation();

  const { customFields } = useLoaderData();

  // console.log(customFields);

  const FormSchema = mergedSchema({
    baseSchema: NewAssetFormSchema,
    customFields: customFields.map(
      (cf: CustomField) =>
        cf.active && {
          id: cf.id,
          name: cf.name,
          helpText: cf?.helpText || "",
          required: cf.required,
          type: cf.type.toLowerCase() as "text" | "number" | "date" | "boolean",
        }
    ),
  });

  const zo = useZorm("NewQuestionWizardScreen", FormSchema);

  const disabled = isFormProcessing(navigation.state);

  const fileError = useAtomValue(fileErrorAtom);
  const [, validateFile] = useAtom(validateFileAtom);
  const [, updateTitle] = useAtom(updateTitleAtom);

  return (
    <Form
      ref={zo.ref}
      method="post"
      className="flex w-full flex-col gap-2"
      encType="multipart/form-data"
    >
      {qrId ? (
        <input type="hidden" name={zo.fields.qrId()} value={qrId} />
      ) : null}
      <FormRow
        rowLabel={"Name"}
        className="border-b-0 pb-[10px]"
        required={zodFieldIsRequired(FormSchema.shape.title)}
      >
        <Input
          label="Name"
          hideLabel
          name={zo.fields.title()}
          disabled={disabled}
          error={zo.errors.title()?.message}
          autoFocus
          onChange={updateTitle}
          className="w-full"
          defaultValue={title || ""}
          required={zodFieldIsRequired(FormSchema.shape.title)}
        />
      </FormRow>

      <FormRow rowLabel={"Main image"} className="pt-[10px]">
        <div>
          <p className="hidden lg:block">Accepts PNG, JPG or JPEG (max.4 MB)</p>
          <Input
            disabled={disabled}
            accept="image/png,.png,image/jpeg,.jpg,.jpeg"
            name="mainImage"
            type="file"
            onChange={validateFile}
            label={"Main image"}
            hideLabel
            error={fileError}
            className="mt-2"
            inputClassName="border-0 shadow-none p-0 rounded-none"
          />
          <p className="mt-2 lg:hidden">Accepts PNG, JPG or JPEG (max.4 MB)</p>
        </div>
      </FormRow>

      <FormRow
        rowLabel={"Category"}
        subHeading={
          <p>
            Make it unique. Each asset can have 1 category. It will show on your
            index.
          </p>
        }
        className="border-b-0 pb-[10px]"
        required={zodFieldIsRequired(FormSchema.shape.category)}
      >
        <CategorySelect defaultValue={category || undefined} />
      </FormRow>

      <FormRow
        rowLabel={"Tags"}
        subHeading={
          <p>
            Tags can help you organise your database. They can be combined.{" "}
            <Link to="/tags/new" className="text-gray-600 underline">
              Create tags
            </Link>
          </p>
        }
        className="border-b-0 py-[10px]"
        required={zodFieldIsRequired(FormSchema.shape.tags)}
      >
        <TagsAutocomplete existingTags={tags || []} />
      </FormRow>

      <FormRow
        rowLabel={"Location"}
        subHeading={
          <p>
            A location is a place where an item is supposed to be located. This
            is different than the last scanned location{" "}
            <Link to="/locations/new" className="text-gray-600 underline">
              Create locations
            </Link>
          </p>
        }
        className="pt-[10px]"
        required={zodFieldIsRequired(FormSchema.shape.newLocationId)}
      >
        <LocationSelect />
      </FormRow>

      <div>
        <FormRow
          rowLabel="Description"
          subHeading={
            <p>
              This is the initial object description. It will be shown on the
              asset’s overview page. You can always change it.
            </p>
          }
          className="border-b-0"
          required={zodFieldIsRequired(FormSchema.shape.description)}
        >
          <Input
            inputType="textarea"
            label={zo.fields.description()}
            name={zo.fields.description()}
            defaultValue={description || ""}
            placeholder="Add a description for your asset."
            disabled={disabled}
            data-test-id="assetDescription"
            className="w-full"
            required={zodFieldIsRequired(FormSchema.shape.description)}
          />
        </FormRow>
      </div>

      <AssetCustomFields zo={zo} schema={FormSchema} />

      <div className="pt-6 text-right">
        <Button type="submit" disabled={disabled}>
          {disabled ? <Spinner /> : "Save"}
        </Button>
      </div>
    </Form>
  );
};
