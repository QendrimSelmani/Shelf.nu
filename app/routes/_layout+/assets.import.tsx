import type {
  ActionFunctionArgs,
  MetaFunction,
  LoaderFunctionArgs,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link } from "@remix-run/react";
import {
  ImportBackup,
  ImportContent,
} from "~/components/assets/import-content";
import Header from "~/components/layout/header";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "~/components/shared/tabs";
import { createAssetsFromContentImport } from "~/modules/asset";
import { assertUserCanImportAssets } from "~/modules/tier";
import { appendToMetaTitle } from "~/utils/append-to-meta-title";
import { csvDataFromRequest } from "~/utils/csv.server";
import { ShelfStackError } from "~/utils/error";
import { extractCSVDataFromContentImport } from "~/utils/import.server";
import { PermissionAction, PermissionEntity } from "~/utils/permissions";
import { requirePermision } from "~/utils/roles.server";

export const action = async ({ context, request }: ActionFunctionArgs) => {
  const authSession = context.getSession();
  const { userId } = authSession;

  const { organizationId, organizations } = await requirePermision({
    userId,
    request,
    entity: PermissionEntity.asset,
    action: PermissionAction.import,
  });

  const error = {
    message: "",
    details: {
      code: null,
    },
  };

  try {
    await assertUserCanImportAssets({ organizationId, organizations });
    const intent = (await request.clone().formData()).get("intent") as
      | "backup"
      | "content";
    const csvData = await csvDataFromRequest({ request });
    if (csvData.length < 2) {
      throw new Error("CSV file is empty");
    }

    switch (intent) {
      case "backup":
        throw new ShelfStackError({
          message: "This feature is not available for you",
        });
      case "content":
        const contentData = extractCSVDataFromContentImport(csvData);
        await createAssetsFromContentImport({
          data: contentData,
          userId,
          organizationId,
        });
        return json({ success: true, error }, { status: 200 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid CSV file";

    return json(
      {
        success: false,
        error: {
          message,
          details: {
            code: null,
          },
        },
      },
      {
        status: 400,
      }
    );
  }
};

export const loader = async ({ context, request }: LoaderFunctionArgs) => {
  const authSession = context.getSession();
  const { userId } = authSession;

  const { organizationId, organizations } = await requirePermision({
    userId,
    request,
    entity: PermissionEntity.asset,
    action: PermissionAction.import,
  });
  await assertUserCanImportAssets({ organizationId, organizations });

  return json({
    header: {
      title: "Import assets (beta)",
    },
  });
};

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data ? appendToMetaTitle(data.header.title) : "" },
];

export const handle = {
  breadcrumb: () => <Link to="/import">Import</Link>,
};

export default function AssetsImport() {
  return (
    <div className="h-full">
      <Header />
      <div className="flex size-full flex-col items-center">
        <div className="h-[180px] w-full"></div>
        <Tabs defaultValue="content" className="w-1/2">
          <TabsList>
            <TabsTrigger value="content">Import your own content</TabsTrigger>
            <TabsTrigger value="backup">Import from backup</TabsTrigger>
          </TabsList>

          <TabsContent value="content">
            <ImportContent />
          </TabsContent>
          <TabsContent value="backup">
            <ImportBackup />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
