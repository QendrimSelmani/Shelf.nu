import type { ShouldRevalidateFunctionArgs } from "@remix-run/react";
import { Link, Outlet } from "@remix-run/react";
import { ErrorBoundryComponent } from "~/components/errors";

export async function loader() {
  return null;
}

export function shouldRevalidate({
  actionResult,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  /**
   * If we are toggliong the sidebar, no need to revalidate this loader.
   * Revalidation happens in _layout
   */
  if (actionResult?.isTogglingSidebar) {
    return false;
  }

  return defaultShouldRevalidate;
}

export const handle = {
  breadcrumb: () => <Link to="/assets">Assets</Link>,
};

export default function AssetsPage() {
  return <Outlet />;
}

export const ErrorBoundary = () => <ErrorBoundryComponent />;
