import Page from "@/app/page";
export const dynamic = "force-dynamic";
export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Page searchParams={Promise.resolve({ id })} />;
}
