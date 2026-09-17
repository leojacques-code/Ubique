import { oauthConfigured } from "@/lib/config";
import CRM from "@/components/crm";
import { session } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; id?: string }>;
}) {
  const params = await searchParams;
  const s = await session();
  return (
    <CRM
      initialView={params.view}
      initialId={params.id}
      signedIn={!!s}
      demoEnabled={process.env.NEXT_PUBLIC_DEMO_MODE !== "false"}
      configured={oauthConfigured()}
    />
  );
}
