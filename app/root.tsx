import type { PropsWithChildren } from "react";
import type { User } from "@prisma/client";
import type {
  LinksFunction,
  LoaderFunction,
  V2_MetaFunction,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Link,
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "@remix-run/react";

import { ErrorBoundryComponent } from "./components/errors";

import { HomeIcon } from "./components/icons/library";
import fontsStylesheetUrl from "./styles/fonts.css";
import globalStylesheetUrl from "./styles/global.css";
import tailwindStylesheetUrl from "./styles/tailwind.css";
import { NODE_ENV, getBrowserEnv } from "./utils/env";

export interface RootData {
  env: typeof getBrowserEnv;
  user: User;
}

export const handle = {
  breadcrumb: () => (
    <Link to="/" title="Home">
      <HomeIcon className="inline" />
    </Link>
  ),
};

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: tailwindStylesheetUrl },
  { rel: "stylesheet", href: fontsStylesheetUrl },
  { rel: "stylesheet", href: globalStylesheetUrl },
];

export const meta: V2_MetaFunction = () => [
  {
    title: "shelf.nu",
  },
];

export const loader: LoaderFunction = async () =>
  json({
    env: getBrowserEnv(),
  });

export const shouldRevalidate = () => false;

function Document({ children, title }: PropsWithChildren<{ title?: string }>) {
  const { env } = useLoaderData<typeof loader>();
  console.log(NODE_ENV);
  return (
    <html lang="en" className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        {title ? <title>{title}</title> : null}
        <Links />
      </head>
      <body className="h-full">
        {children}
        <ScrollRestoration />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.env = ${JSON.stringify(env)}`,
          }}
        />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <Document>
      <Outlet />
    </Document>
  );
}

export const ErrorBoundary = () => <ErrorBoundryComponent />;
