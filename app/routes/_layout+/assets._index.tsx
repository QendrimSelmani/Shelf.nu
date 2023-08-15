import type { Category, Asset, Tag, Custody } from "@prisma/client";
import type { LoaderArgs, V2_MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useNavigate } from "@remix-run/react";
import { useAtom, useAtomValue } from "jotai";
import { redirect } from "react-router";
import { AssetImage } from "~/components/assets/asset-image";
import { ChevronRight } from "~/components/icons";
import Header from "~/components/layout/header";
import type { HeaderData } from "~/components/layout/header/types";
import { Filters, List } from "~/components/list";
import {
  clearCategoryFiltersAtom,
  clearTagFiltersAtom,
  selectedCategoriesAtom,
  selectedTagsAtom,
} from "~/components/list/filters/atoms";
import { CategoryFilters } from "~/components/list/filters/category";
import { TagFilters } from "~/components/list/filters/tag";
import type { ListItemData } from "~/components/list/list-item";
import { Badge } from "~/components/shared/badge";
import { Button } from "~/components/shared/button";
import { Tag as TagBadge } from "~/components/shared/tag";
import { Td, Th } from "~/components/table";
import { getPaginatedAndFilterableAssets } from "~/modules/asset";
import { requireAuthSession } from "~/modules/auth";
import { getUserByID } from "~/modules/user";
import { notFound } from "~/utils";
import { appendToMetaTitle } from "~/utils/append-to-meta-title";

export interface IndexResponse {
  /** Page number. Starts at 1 */
  page: number;

  /** Items to be loaded per page */
  perPage: number;

  /** Items to be rendered in the list */
  items: ListItemData[];

  categoriesIds?: string[];

  /** Total items - before filtering */
  totalItems: number;

  /** Total pages */
  totalPages: number;

  /** Search string */
  search: string | null;

  /** Next page url - used for pagination */
  next: string;

  /** Prev page url - used for pagination */
  prev: string;

  /** Used so all the default actions can be generate such as empty state, creating and so on */
  modelName: {
    singular: string;
    plural: string;
  };
}

export async function loader({ request }: LoaderArgs) {
  const { userId } = await requireAuthSession(request);
  const user = await getUserByID(userId);

  if (!user) {
    return redirect("/login");
  }
  const {
    search,
    totalAssets,
    perPage,
    page,
    prev,
    next,
    categories,
    tags,
    assets,
    totalPages,
  } = await getPaginatedAndFilterableAssets({
    request,
    userId,
  });

  console.log(page);
  console.log(totalPages);

  if (totalPages !== 0 && page > totalPages) {
    return redirect("/assets");
  }

  if (!assets) {
    throw notFound(`No assets found`);
  }

  const header: HeaderData = {
    title: user?.firstName ? `${user.firstName}'s inventory` : `Your inventory`,
  };

  const modelName = {
    singular: "asset",
    plural: "assets",
  };

  return json({
    header,
    items: assets,
    categories,
    tags,
    search,
    page,
    totalItems: totalAssets,
    perPage,
    totalPages,
    next,
    prev,
    modelName,
  });
}

export const meta: V2_MetaFunction<typeof loader> = ({ data }) => [
  { title: appendToMetaTitle(data.header.title) },
];

export default function AssetIndexPage() {
  const navigate = useNavigate();
  const selectedCategories = useAtomValue(selectedCategoriesAtom);
  const [, clearCategoryFilters] = useAtom(clearCategoryFiltersAtom);

  const selectedTags = useAtomValue(selectedTagsAtom);
  const [, clearTagFilters] = useAtom(clearTagFiltersAtom);

  const hasFiltersToClear =
    selectedCategories.items.length > 0 || selectedTags.items.length > 0;

  const handleClearFilters = () => {
    clearCategoryFilters();
    clearTagFilters();
  };

  return (
    <>
      <Header>
        <Button
          to="new"
          role="link"
          aria-label={`new asset`}
          icon="plus"
          data-test-id="createNewAsset"
        >
          New Asset
        </Button>
      </Header>
      <div className="mt-8 flex flex-1 flex-col md:mx-0 md:gap-2">
        <Filters>
          <div className="flex items-center justify-around gap-6 md:justify-end">
            {hasFiltersToClear ? (
              <div className="hidden gap-6 md:flex">
                <Button
                  as="button"
                  onClick={handleClearFilters}
                  variant="link"
                  className="block max-w-none font-normal  text-gray-500 hover:text-gray-600"
                >
                  Clear all filters
                </Button>
                <div className="text-gray-500"> | </div>
              </div>
            ) : null}
            <CategoryFilters />
            <TagFilters />
          </div>
        </Filters>
        <List
          ItemComponent={ListAssetContent}
          navigate={(itemId) => navigate(itemId)}
          className=" overflow-x-visible md:overflow-x-auto"
          headerChildren={
            <>
              <Th className="hidden md:table-cell">Custodian</Th>
              <Th className="hidden md:table-cell">Category</Th>
              <Th className="hidden md:table-cell">Tags</Th>
            </>
          }
        />
      </div>
    </>
  );
}

const ListAssetContent = ({
  item,
}: {
  item: Asset & {
    category?: Category;
    tags?: Tag[];
    custody: Custody & {
      custodian: {
        name: string;
      };
    };
  };
}) => {
  const { category, tags, custody } = item;

  return (
    <>
      <Td className="w-full whitespace-normal p-0 md:p-0">
        <div className="flex justify-between gap-3 p-4 md:justify-normal md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center">
              <AssetImage
                asset={{
                  assetId: item.id,
                  mainImage: item.mainImage,
                  mainImageExpiration: item.mainImageExpiration,
                  alt: item.title,
                }}
                className="h-full w-full rounded-[4px] border object-cover"
              />
            </div>
            <div className="">
              <span className="word-break mb-1 block font-medium">
                {item.title}
              </span>
              <div className="block md:hidden">
                {category ? (
                  <Badge color={category.color}>{category.name}</Badge>
                ) : null}
              </div>
            </div>
          </div>

          <button className="block md:hidden">
            <ChevronRight />
          </button>
        </div>
      </Td>
      <Td className="hidden md:table-cell">
        {custody ? (
          <span className="inline-flex justify-center rounded-2xl bg-gray-100 px-[6px] py-[2px] text-center text-[12px] font-medium text-gray-700">
            {custody.custodian.name}
          </span>
        ) : null}
      </Td>
      <Td className="hidden md:table-cell">
        {category ? (
          <Badge color={category.color}>{category.name}</Badge>
        ) : null}
      </Td>
      <Td className="hidden text-left md:table-cell">
        <ListItemTagsColumn tags={tags} />
      </Td>
    </>
  );
};

const ListItemTagsColumn = ({ tags }: { tags: Tag[] | undefined }) => {
  const visibleTags = tags?.slice(0, 2);
  const remainingTags = tags?.slice(2);

  return tags && tags?.length > 0 ? (
    <div className="">
      {visibleTags?.map((tag) => (
        <TagBadge key={tag.name} className="mr-2">
          {tag.name}
        </TagBadge>
      ))}
      {remainingTags && remainingTags?.length > 0 ? (
        <TagBadge
          className="mr-2 w-6 text-center"
          title={`${remainingTags?.map((t) => t.name).join(", ")}`}
        >
          {`+${tags.length - 2}`}
        </TagBadge>
      ) : null}
    </div>
  ) : null;
};
