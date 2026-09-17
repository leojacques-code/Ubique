import CRM from "@/components/crm";
import { session } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default async function Page() {
  const s = await session();
  return (
    <CRM
      signedIn={!!s}
      demoEnabled={process.env.NEXT_PUBLIC_DEMO_MODE === "true"}
      configured={
        !!process.env.GOOGLE_CLIENT_ID &&
        !!process.env.ALLOWED_EMAIL &&
        !!process.env.TOKEN_ENCRYPTION_KEY
      }
    />
  );
}
