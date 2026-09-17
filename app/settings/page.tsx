import Page from "@/app/page";
export const dynamic = "force-dynamic";
export default function RoutedPage() {
  return <Page searchParams={Promise.resolve({ view: "Paramètres" })} />;
}
