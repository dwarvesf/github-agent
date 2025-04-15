import { LatestPost } from "@/app/_components/organization";
import { api, HydrateClient } from "@/trpc/server";
import { Button } from "@/components/ui/button";

export default async function Home() {
  void api.organization.getLatest.prefetch();

  return (
    <HydrateClient>
      <Button>Hello</Button>
      <LatestPost />
    </HydrateClient>
  );
}
