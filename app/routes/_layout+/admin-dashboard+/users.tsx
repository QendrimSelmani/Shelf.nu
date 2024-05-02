import type { User } from "@prisma/client";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect, json } from "@remix-run/node";
import { ErrorContent } from "~/components/errors";
import type { HeaderData } from "~/components/layout/header/types";
import { List } from "~/components/list";
import { Filters } from "~/components/list/filters";
import { Pagination } from "~/components/list/pagination";
import { Td } from "~/components/table";
import { getPaginatedAndFilterableUsers } from "~/modules/user/service.server";
import { makeShelfError } from "~/utils/error";
import { data, error } from "~/utils/http.server";
import { requireAdmin } from "~/utils/roles.server";

export async function loader({ context, request }: LoaderFunctionArgs) {
  const authSession = context.getSession();
  const { userId } = authSession;

  try {
    await requireAdmin(userId);

    const { search, totalUsers, perPage, page, users, totalPages } =
      await getPaginatedAndFilterableUsers({
        request,
      });

    if (page > totalPages) {
      return redirect("/admin-dashboard");
    }

    const header: HeaderData = {
      title: `Admin dashboard`,
    };

    const modelName = {
      singular: "user",
      plural: "users",
    };

    return json(
      data({
        header,
        items: users,
        search,
        page,
        totalItems: totalUsers,
        perPage,
        totalPages,
        modelName,
      })
    );
  } catch (cause) {
    const reason = makeShelfError(cause, { userId });
    throw json(error(reason), { status: reason.status });
  }
}

export default function Area51() {
  return (
    <div>
      <h1>Admin dashboard</h1>
      <div className="mt-8 flex flex-1 flex-col md:mx-0 md:gap-2">
        <Filters>
          <Pagination />
        </Filters>
        <List
          ItemComponent={ListUserContent}
          link={(itemId) => ({ to: `../${itemId}` })}
        />
      </div>
    </div>
  );
}

const ListUserContent = ({ item }: { item: User }) => (
  <>
    <Td className="w-full p-0 md:p-0">
      <div className="flex justify-between gap-3 p-4 md:justify-normal md:px-6">
        {item.email}
      </div>
    </Td>
  </>
);

export const ErrorBoundary = () => <ErrorContent />;
