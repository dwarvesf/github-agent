"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";

import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Button } from "@/components/ui/button";

import { api } from "@/trpc/react";

const repositorySchema = z.object({
  id: z.number().optional(),
  github_repo_name: z.string().min(1, "Repository name is required"),
  channel_id: z.number().min(1, "Channel is required"),
});

type RepositoryForm = z.infer<typeof repositorySchema>;

export default function Repositories() {
  const params = useParams();
  const orgId = Number(params.orgId);

  const [editingRepo, setEditingRepo] = useState<RepositoryForm | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: repositories, refetch } =
    api.repository.getByOrganization.useQuery(orgId, {
      enabled: !!orgId,
    });

  const { data: channels } = api.channel.getByOrganization.useQuery(orgId, {
    enabled: !!orgId,
  });

  const form = useForm<RepositoryForm>({
    resolver: zodResolver(repositorySchema),
    defaultValues: {
      github_repo_name: "",
      channel_id: 0,
    },
  });

  function openDialog(repo?: RepositoryForm) {
    if (repo) {
      setEditingRepo(repo);
      form.reset(repo);
    } else {
      setEditingRepo(null);
      form.reset({ github_repo_name: "", channel_id: 0 });
    }
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
    setEditingRepo(null);
  }

  const createMutation = api.repository.create.useMutation({
    onSuccess: () => {
      refetch();
      closeDialog();
    },
  });

  const updateMutation = api.repository.update.useMutation({
    onSuccess: () => {
      refetch();
      closeDialog();
    },
  });

  const deleteMutation = api.repository.delete.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  async function onSubmit(data: RepositoryForm) {
    if (editingRepo && editingRepo.id) {
      await updateMutation.mutateAsync({
        id: editingRepo.id,
        github_repo_name: data.github_repo_name,
        organization_id: orgId,
        channel_id: data.channel_id,
      });
    } else {
      await createMutation.mutateAsync({
        github_repo_name: data.github_repo_name,
        organization_id: orgId,
        channel_id: data.channel_id,
      });
    }
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold">Repositories</h3>
        <Button onClick={() => openDialog()}>Add repository</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Repository name</TableHead>
            <TableHead>Channel</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {repositories?.map((repo: any) => (
            <TableRow key={repo.id}>
              <TableCell>{repo.github_repo_name}</TableCell>
              <TableCell>
                {channels?.find((ch: any) => ch.id === repo.channel_id)?.name ??
                  "N/A"}
              </TableCell>
              <TableCell className="space-x-2 text-right">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    openDialog({
                      id: repo.id,
                      github_repo_name: repo.github_repo_name,
                      channel_id: repo.channel_id,
                    })
                  }
                >
                  Edit
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      Delete
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Confirm delete</DialogTitle>
                      <DialogDescription>
                        Are you sure you want to delete this repository?
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                      </DialogClose>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          deleteMutation.mutate({ id: repo.id });
                        }}
                      >
                        Delete
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </TableCell>
            </TableRow>
          ))}
          {!repositories || repositories.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-muted-foreground text-center"
              >
                No repositories found.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRepo ? "Edit repository" : "Add repository"}
            </DialogTitle>
            <DialogDescription>
              {editingRepo
                ? "Update the repository details below."
                : "Fill in the details to add a new repository."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="github_repo_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Repository name</FormLabel>
                    <FormControl>
                      <Input placeholder="Repository name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="channel_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Channel</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(Number(value))}
                      value={String(field.value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a channel" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {channels?.map((ch: any) => (
                            <SelectItem key={ch.id} value={String(ch.id)}>
                              {ch.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingRepo ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
