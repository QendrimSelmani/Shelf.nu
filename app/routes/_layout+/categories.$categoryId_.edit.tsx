import { useState } from "react";
import type { LoaderArgs, V2_MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData, useNavigation } from "@remix-run/react";
import { parseFormAny, useZorm } from "react-zorm";
import { z } from "zod";
import { ColorInput } from "~/components/forms/color-input";
import Input from "~/components/forms/input";

import { Button } from "~/components/shared/button";

import { requireAuthSession, commitAuthSession } from "~/modules/auth";
import { getCategory, updateCategory } from "~/modules/category";
import {
  assertIsPost,
  isFormProcessing,
  getRequiredParam,
  handleInputChange,
} from "~/utils";
import { appendToMetaTitle } from "~/utils/append-to-meta-title";
import { sendNotification } from "~/utils/emitter/send-notification.server";
import { zodFieldIsRequired } from "~/utils/zod";

export const UpdateCategoryFormSchema = z.object({
  name: z.string().min(3, "Name is required"),
  description: z.string(),
  color: z.string().regex(/^#/).min(7),
});

const title = "Edit category";

export async function loader({ request, params }: LoaderArgs) {
  await requireAuthSession(request);

  const id = getRequiredParam(params, "categoryId");
  const category = await getCategory({ id });

  const colorFromServer = category?.color;

  const header = {
    title,
  };

  return json({ header, colorFromServer, category });
}

export const meta: V2_MetaFunction<typeof loader> = ({ data }) => [
  { title: data ? appendToMetaTitle(data.header.title) : "" },
];

export async function action({ request, params }: LoaderArgs) {
  const authSession = await requireAuthSession(request);
  assertIsPost(request);
  const formData = await request.formData();
  const result = await UpdateCategoryFormSchema.safeParseAsync(
    parseFormAny(formData)
  );
  const id = getRequiredParam(params, "categoryId");

  if (!result.success) {
    return json(
      {
        errors: result.error,
      },
      { status: 400 }
    );
  }

  await updateCategory({
    ...result.data,
    id,
  });

  sendNotification({
    title: "Category Updated",
    message: "Your category has been updated successfully",
    icon: { name: "success", variant: "success" },
    senderId: authSession.userId,
  });

  return redirect(`/categories`, {
    headers: {
      "Set-Cookie": await commitAuthSession(request, { authSession }),
    },
  });
}

export default function EditCategory() {
  const zo = useZorm("NewQuestionWizardScreen", UpdateCategoryFormSchema);
  const navigation = useNavigation();
  const disabled = isFormProcessing(navigation.state);
  const { colorFromServer, category } = useLoaderData();

  const [formData, setFormData] = useState<{ [key: string]: any }>({
    name: category.name,
    description: category.description,
  });

  return (
    <>
      <Form
        method="post"
        className="block rounded-[12px] border border-gray-200 bg-white px-6 py-5 lg:flex lg:items-end lg:justify-between lg:gap-3"
        ref={zo.ref}
      >
        <div className="gap-3 lg:flex lg:items-end">
          <Input
            label="Name"
            placeholder="Category name"
            className="mb-4 lg:mb-0 lg:max-w-[180px]"
            name={zo.fields.name()}
            disabled={disabled}
            error={zo.errors.name()?.message}
            hideErrorText
            autoFocus
            value={formData.name}
            onChange={(e) => handleInputChange(e, setFormData, "name")}
            required={zodFieldIsRequired(UpdateCategoryFormSchema.shape.name)}
          />
          <Input
            label="Description"
            placeholder="Description (optional)"
            name={zo.fields.description()}
            disabled={disabled}
            data-test-id="categoryDescription"
            className="mb-4 lg:mb-0"
            value={formData.description}
            onChange={(e) => handleInputChange(e, setFormData, "description")}
            required={zodFieldIsRequired(
              UpdateCategoryFormSchema.shape.description
            )}
          />
          <div className="mb-6 lg:mb-0">
            <ColorInput
              name={zo.fields.color()}
              disabled={disabled}
              error={zo.errors.color()?.message}
              hideErrorText
              colorFromServer={colorFromServer}
              required={zodFieldIsRequired(
                UpdateCategoryFormSchema.shape.color
              )}
            />
          </div>
        </div>

        <div className="flex gap-1">
          <Button variant="secondary" to="/categories" size="sm">
            Cancel
          </Button>
          <Button type="submit" size="sm">
            Update
          </Button>
        </div>
      </Form>
    </>
  );
}
