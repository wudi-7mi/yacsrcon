import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import Dashboard from "@/components/dashboard";
import serverCatalog from "@/config/server-catalog.json";
import type { ServerCatalog } from "@/lib/types";

export default async function Home() {
  if (!(await isAuthenticated())) redirect("/login");
  return <Dashboard catalog={serverCatalog as ServerCatalog} />;
}
