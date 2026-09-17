import { oauthConfigured, configurationStatus } from "@/lib/config";
import LiteCRM from "@/components/lite-crm";
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
    <LiteCRM
      initialView={params.view}
      initialId={params.id}
      signedIn={!!s}
      configured={oauthConfigured()}
      configuration={configurationStatus()}
    />
  );
}
