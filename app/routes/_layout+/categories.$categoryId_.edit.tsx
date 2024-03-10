import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import { parseFormAny, useZorm } from "react-zorm";
import { z } from "zod";
import { ColorInput } from "~/components/forms/color-input";
import Input from "~/components/forms/input";

import { Button } from "~/components/shared/button";

import { getCategory, updateCategory } from "~/modules/category";
import { isFormProcessing, getRequiredParam } from "~/utils";
import { appendToMetaTitle } from "~/utils/append-to-meta-title";
import { sendNotification } from "~/utils/emitter/send-notification.server";
import { PermissionAction, PermissionEntity } from "~/utils/permissions";
import { requirePermision } from "~/utils/roles.server";
import { zodFieldIsRequired } from "~/utils/zod";

export const UpdateCategoryFormSchema = z.object({
  name: z.string().min(3, "Name is required"),
  description: z.string(),
  color: z.string().regex(/^#/).min(7),
});

const title = "Edit category";

export async function loader({ context, request, params }: LoaderFunctionArgs) {
  const authSession = context.getSession();
  const { organizationId } = await requirePermision({
    userId: authSession.userId,
    request,
    entity: PermissionEntity.category,
    action: PermissionAction.update,
  });

  const id = getRequiredParam(params, "categoryId");
  const category = await getCategory({ id, organizationId });

  const colorFromServer = category?.color;

  const header = {
    title,
  };

  return json({ header, colorFromServer, category });
}

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data ? appendToMetaTitle(data.header.title) : "" },
];

export async function action({ context, request, params }: LoaderFunctionArgs) {
  const authSession = context.getSession();
  const { organizationId } = await requirePermision({
    userId: authSession.userId,
    request,
    entity: PermissionEntity.category,
    action: PermissionAction.update,
  });

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
      {
        status: 400,
      }
    );
  }

  const rsp = await updateCategory({
    ...result.data,
    id,
    organizationId,
  });

  // Handle response error when creating. Mostly due to duplicate name
  if (rsp?.error) {
    return json(
      {
        errors: rsp.error,
      },
      {
        status: 400,
      }
    );
  }

  sendNotification({
    title: "Category Updated",
    message: "Your category has been updated successfully",
    icon: { name: "success", variant: "success" },
    senderId: authSession.userId,
  });

  return redirect(`/categories`);
}

export default function EditCategory() {
  const zo = useZorm("NewQuestionWizardScreen", UpdateCategoryFormSchema);
  const navigation = useNavigation();
  const disabled = isFormProcessing(navigation.state);
  const { colorFromServer, category } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return category && colorFromServer ? (
    <>
      <Form
        method="post"
        className="block rounded border border-gray-200 bg-white px-6 py-5"
        ref={zo.ref}
      >
        <div className=" lg:flex lg:items-end lg:justify-between lg:gap-3">
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
              required={zodFieldIsRequired(UpdateCategoryFormSchema.shape.name)}
              defaultValue={category.name}
            />
            <Input
              label="Description"
              placeholder="Description (optional)"
              name={zo.fields.description()}
              disabled={disabled}
              data-test-id="categoryDescription"
              className="mb-4 lg:mb-0"
              required={zodFieldIsRequired(
                UpdateCategoryFormSchema.shape.description
              )}
              defaultValue={category.description || undefined}
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
        </div>
        {actionData?.errors ? (
          <div className="mt-3 text-sm text-error-500">
            {actionData?.errors?.message}
          </div>
        ) : null}
      </Form>
    </>
  ) : null;
}
