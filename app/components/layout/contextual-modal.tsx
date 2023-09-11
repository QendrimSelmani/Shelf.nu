import { Outlet, useMatches } from "@remix-run/react";
import { AnimatePresence } from "framer-motion";
import { Dialog } from "./dialog";

export default function ContextualModal() {
  const matches = useMatches();
  /** Get the last item which refers to the current route */
  const currentRoute = matches[matches.length - 1];
  const showModal = currentRoute?.data?.showModal;

  return (
    <AnimatePresence>
      <Dialog open={showModal}>
        <Outlet />
      </Dialog>
    </AnimatePresence>
  );
}
