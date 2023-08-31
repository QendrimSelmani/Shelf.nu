import type { Category } from "@prisma/client";
import type { ActionArgs, LoaderArgs, V2_MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, Outlet } from "@remix-run/react";
import { DeleteCategory } from "~/components/category/delete-category";
import Header from "~/components/layout/header";
import type { HeaderData } from "~/components/layout/header/types";
import { Filters, List } from "~/components/list";
import { Badge } from "~/components/shared/badge";
import { Button } from "~/components/shared/button";
import { Th, Td } from "~/components/table";

import { requireAuthSession } from "~/modules/auth";
import { deleteCategory, getCategories } from "~/modules/category";
import {
  assertIsDelete,
  generatePageMeta,
  getCurrentSearchParams,
  getParamsValues,
} from "~/utils";
import { appendToMetaTitle } from "~/utils/append-to-meta-title";
import { sendNotification } from "~/utils/emitter/send-notification.server";

export async function loader({ request }: LoaderArgs) {
  const { userId } = await requireAuthSession(request);

  const searchParams = getCurrentSearchParams(request);
  const { page, perPage, search } = getParamsValues(searchParams);
  const { prev, next } = generatePageMeta(request);

  const { categories, totalCategories } = await getCategories({
    userId,
    page,
    perPage,
    search,
  });
  const totalPages = Math.ceil(totalCategories / perPage);

  const header: HeaderData = {
    title: "Categories",
  };
  const modelName = {
    singular: "category",
    plural: "categories",
  };
  return json({
    header,
    items: categories,
    search,
    page,
    totalItems: totalCategories,
    totalPages,
    perPage,
    prev,
    next,
    modelName,
  });
}

export const meta: V2_MetaFunction<typeof loader> = ({ data }) => [
  { title: data ? appendToMetaTitle(data.header.title) : "" },
];

export async function action({ request }: ActionArgs) {
  const { userId } = await requireAuthSession(request);
  assertIsDelete(request);
  const formData = await request.formData();
  const id = formData.get("id") as string;

  await deleteCategory({ id, userId });
  sendNotification({
    title: "Category deleted",
    message: "Your category has been deleted successfully",
    icon: { name: "trash", variant: "error" },
    senderId: userId,
  });

  return json({ success: true });
}

export const handle = {
  breadcrumb: () => <Link to="/categories">Categories</Link>,
};

export default function CategoriesPage() {
  return (
    <>
      <Header>
        <Button
          to="new"
          role="link"
          aria-label={`new category`}
          icon="plus"
          data-test-id="createNewCategory"
        >
          New Category
        </Button>
      </Header>
      <div className="mt-8 flex flex-1 flex-col gap-2">
        <Filters />
        <Outlet />
        <List
          ItemComponent={CategoryItem}
          headerChildren={
            <>
              <Th>Description</Th>
              <Th>Actions</Th>
            </>
          }
        />
      </div>
    </>
  );
}

const CategoryItem = ({
  item,
}: {
  item: Pick<Category, "id" | "description" | "name" | "color">;
}) => (
  <>
    <Td title={`Category: ${item.name}`} className="w-1/4 ">
      <Badge color={item.color}>{item.name}</Badge>
    </Td>
    <Td className="w-3/4 text-gray-500" title="Description">
      {item.description}
    </Td>
    <Td>
      <Button
        to={`${item.id}/edit`}
        role="link"
        aria-label={`edit category`}
        variant="secondary"
        size="sm"
        className=" mx-2 text-[12px]"
        icon={"write"}
        title={"Edit"}
        data-test-id="editCategoryButton"
      />
      <DeleteCategory category={item} />
    </Td>
  </>
);
