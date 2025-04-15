"use client";

import { api } from "@/trpc/react";

export function LatestPost() {
  const [lastestOrgs] = api.organization.getLatest.useSuspenseQuery();

  return (
    <div className="w-full max-w-xs">
      {lastestOrgs ? (
        <p className="truncate">
          Your most recent post: {lastestOrgs.github_name}
        </p>
      ) : (
        <p>You have no posts yet.</p>
      )}
    </div>
  );
}
