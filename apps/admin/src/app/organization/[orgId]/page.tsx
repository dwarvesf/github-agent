"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { api } from "@/trpc/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import Channels from "./channels";
import Repositories from "./repositories";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const organizationSchema = z.object({
  id: z.number().optional(),
  github_name: z.string().min(1, "Name is required"),
  github_token_id: z.string().optional(),
});

type OrganizationFormValues = z.infer<typeof organizationSchema>;

export default function OrganizationDetailPage() {
  const params = useParams();
  const orgId = Number(params.orgId);
  const router = useRouter();

  const { data: organization, isLoading } = api.organization.getAll.useQuery(
    undefined,
    {
      select: (orgs) => orgs.find((o) => o.id === orgId),
    },
  );

  const form = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      github_name: "",
      github_token_id: "",
    },
  });

  React.useEffect(() => {
    if (organization) {
      // Convert null github_token_id to undefined for form reset compatibility
      const resetData = {
        ...organization,
        github_token_id: organization.github_token_id ?? undefined,
      };
      form.reset(resetData);
    }
  }, [organization, form]);

  const updateMutation = api.organization.update.useMutation({
    onSuccess: () => {
      toast.success("Organization updated");
      router.back();
    },
    onError: () => {
      toast.error("Failed to update organization");
    },
  });

  const onSubmit = (values: OrganizationFormValues) => {
    updateMutation.mutate({
      id: orgId,
      github_name: values.github_name,
      ...(values.github_token_id
        ? { github_token_id: values.github_token_id }
        : {}),
    });
  };

  if (isLoading) {
    return <div>Loading organization details...</div>;
  }

  if (!organization) {
    return <div>Organization not found.</div>;
  }

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">{organization.github_name}</h1>

      <Tabs defaultValue="repositories" className="mb-4">
        <TabsList>
          <TabsTrigger value="repositories">Repositories</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
        </TabsList>
        <TabsContent value="repositories" className="mb-8">
          <Repositories />
        </TabsContent>
        <TabsContent value="channels">
          <Channels />
        </TabsContent>
      </Tabs>
    </>
  );
}
