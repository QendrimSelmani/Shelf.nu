import type { Template } from "@prisma/client";
import { TierId } from "@prisma/client";
import type {
  MetaFunction,
  LoaderFunctionArgs,
  ActionFunctionArgs,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { ErrorBoundryComponent } from "~/components/errors";
import { EmptyState } from "~/components/list/empty-state";
import { ListHeader } from "~/components/list/list-header";
import { ListItem } from "~/components/list/list-item";
import { Badge } from "~/components/shared";
import { ControlledActionButton } from "~/components/shared/controlled-action-button";
import { Table, Td, Th } from "~/components/table";
import { TemplateActionsDropdown } from "~/components/templates/template-actions-dropdown";
import { db } from "~/database";
import { makeActive, makeDefault, makeInactive } from "~/modules/template";
import { assertIsPost } from "~/utils";
import { appendToMetaTitle } from "~/utils/append-to-meta-title";
import { sendNotification } from "~/utils/emitter/send-notification.server";
import { ShelfStackError } from "~/utils/error";
import { PermissionAction, PermissionEntity } from "~/utils/permissions";
import { requirePermision } from "~/utils/roles.server";
import { canCreateMoreTemplates } from "~/utils/subscription";

export const loader = async ({ context, request }: LoaderFunctionArgs) => {
  const authSession = context.getSession();
  const { userId } = authSession;
  const { organizationId } = await requirePermision({
    userId,
    request,
    entity: PermissionEntity.template,
    action: PermissionAction.read,
  });

  // const user = await db.user.findUnique({
  //   where: {
  //     id: userId,
  //   },
  //   select: {
  //     firstName: true,
  //     tier: {
  //       include: { tierLimit: true },
  //     },
  //     templates: {
  //       where: { organizationId },
  //       orderBy: { createdAt: "desc" },
  //       select: {
  //         id: true,
  //         name: true,
  //         description: true,
  //         createdAt: true,
  //         updatedAt: true,
  //         type: true,
  //         isActive: true,
  //         isDefault: true,
  //         pdfSize: true,
  //         pdfUrl: true,
  //       },
  //     },
  //   },
  // });

  if (!userId) throw new ShelfStackError({ message: "User not found" });

  const modelName = {
    singular: "Template",
    plural: "Templates",
  };

  const templates = await db.template.findMany({
    where: {
      organizationId,
    },
  });

  const userTier = (await db.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      tier: {
        include: {
          tierLimit: true,
        },
      },
    },
  }))!.tier;

  const defaultTemplates: { [key: string]: TTemplate } = {};
  templates.forEach((template) => {
    if (template.isDefault) defaultTemplates[template.type] = template;
  });

  return json({
    userId,
    tier: userTier,
    modelName,
    canCreateMoreTemplates: canCreateMoreTemplates({
      tierLimit: userTier?.tierLimit,
      totalTemplates: templates.length,
    }),
    items: templates,
    totalItems: templates.length,
    title: "Templates",
    defaultTemplates,
  });
};

export async function action({ context, request }: ActionFunctionArgs) {
  assertIsPost(request);
  const authSession = context.getSession();
  const { userId } = authSession;
  const { organizationId } = await requirePermision({
    userId,
    request,
    entity: PermissionEntity.template,
    action: PermissionAction.read,
  });

  const formData = await request.clone().formData();
  const intent = formData.get("intent") as "toggleActive" | "makeDefault";

  switch (intent) {
    case "toggleActive": {
      const isActive = formData.get("isActive") === "true";
      const templateId = formData.get("templateId") as string;

      if (isActive) {
        await makeInactive({
          id: templateId,
          organizationId,
        });
      } else {
        await makeActive({
          id: templateId,
          organizationId,
        });
      }

      sendNotification({
        title: "Template updated",
        message: "Your template has been updated successfully",
        icon: { name: "success", variant: "success" },
        senderId: authSession.userId,
      });

      return redirect(`/settings/template`);
    }
    case "makeDefault": {
      const templateId = formData.get("templateId") as string;
      const templateType = formData.get("templateType") as Template["type"];

      await makeDefault({
        id: templateId,
        type: templateType,
        organizationId,
      });

      sendNotification({
        title: "Template updated",
        message: "Your template has been updated successfully",
        icon: { name: "success", variant: "success" },
        senderId: authSession.userId,
      });

      return redirect(`/settings/template`);
    }
  }
}

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data ? appendToMetaTitle(data.title) : "" },
];

export const ErrorBoundary = () => <ErrorBoundryComponent />;

export default function TemplatePage() {
  const { items, canCreateMoreTemplates, tier, totalItems } =
    useLoaderData<typeof loader>();

  const hasItems = totalItems > 0;

  let upgradeMessage =
    "You are currently able to create a max of 3 templates. If you want to create more than 3 Team templates, please get in touch with sales";
  if (tier.id == TierId.free || tier.id == TierId.tier_1) {
    upgradeMessage = `You cannot create more than ${tier.tierLimit} template on a ${tier.name} subscription. `;
  }

  return (
    <div>
      <div className="w-full">
        <div className="mb-2.5 flex flex-col bg-white md:rounded-[12px] md:border md:border-gray-200 md:px-6 md:py-5">
          <h2 className=" text-lg text-gray-900">Templates</h2>
          <p className="text-sm text-gray-600">
            Manage all your templates here.
          </p>
        </div>
        <div className="mb-2.5 flex items-start justify-between gap-x-5 bg-white md:rounded-[12px] md:border md:border-gray-200 md:px-6 md:py-5">
          <div className="w-2/5">
            <h3 className="text-sm text-gray-600">PDF Templates</h3>
            <p className="text-sm text-gray-600">
              Use these templates to generate a PDF document for assigning
              custody and your bookings. You can even set them up to require an
              electronic signature. Default means that this template will be
              first selected.
            </p>
          </div>
          <div className="mb-2.5 flex w-3/5 flex-col items-center justify-between bg-white md:rounded-[12px] md:border md:border-gray-200 md:px-6 md:py-5">
            {!hasItems ? (
              <EmptyState
                customContent={{
                  title: "No templates on database",
                  text: "What are you waiting for? Add your first template now!",
                  newButtonRoute: `new`,
                  newButtonContent: "Add Template",
                }}
                modelName={{
                  singular: "template",
                  plural: "templates",
                }}
              />
            ) : (
              <>
                <div className="flex w-full items-center justify-between">
                  <h3 className="text-md text-gray-900">PDF Templates</h3>
                  <ControlledActionButton
                    canUseFeature={canCreateMoreTemplates}
                    buttonContent={{
                      title: "Add template",
                      message: upgradeMessage,
                      ctaText: "upgrading to team plan",
                    }}
                    skipCta={tier.id === TierId.tier_2}
                    buttonProps={{
                      to: "new",
                      role: "link",
                      icon: "plus",
                      "aria-label": `new template`,
                      "data-test-id": "createNewTemplateButton",
                      variant: "primary",
                    }}
                  />
                </div>
                <div className="mt-5 w-full flex-1 overflow-x-auto rounded-[12px] border bg-white">
                  <Table>
                    <ListHeader
                      children={
                        <>
                          <Th>Default</Th>
                          <Th>Status</Th>
                          <Th>Actions</Th>
                        </>
                      }
                    />
                    <tbody>
                      {items.map((template) => (
                        <ListItem item={template} key={template.id}>
                          <TemplateRow item={template} />
                        </ListItem>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type TTemplate = Pick<
  Template,
  "id" | "name" | "type" | "isDefault" | "isActive" | "pdfSize" | "pdfUrl"
>;

const TemplateRow = ({ item }: { item: TTemplate }) => (
  <>
    <Td className="w-full">
      <div className="flex flex-col items-start justify-between">
        <span className="text-text-sm font-medium text-gray-900">
          {item.name}
        </span>
        <span className="text-text-sm font-light text-gray-600">
          {item.type}
        </span>
      </div>
    </Td>
    <Td>
      {item.isDefault && (
        <Badge withDot={false} color="#334054">
          Default
        </Badge>
      )}
    </Td>
    <Td>
      {item.isActive ? (
        <Badge color="#0dec5d">Active</Badge>
      ) : (
        <Badge color="#344054" withDot={false}>
          Inactive
        </Badge>
      )}
    </Td>
    <Td>
      <TemplateActionsDropdown template={item} />
    </Td>
  </>
);
