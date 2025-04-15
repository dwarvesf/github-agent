"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { api } from "@/trpc/react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

const organizationSchema = z.object({
  id: z.number().optional(),
  github_name: z.string().min(1, "Name is required"),
  github_token_id: z.string().optional(),
});

type OrganizationFormValues = z.infer<typeof organizationSchema>;

export default function Home() {
  const [openDialog, setOpenDialog] = useState(false);
  const [editingOrg, setEditingOrg] = useState<OrganizationFormValues | null>(
    null,
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingOrg, setDeletingOrg] = useState<{
    id: number;
    github_name: string;
    github_token_id?: string;
  } | null>(null);

  const form = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      github_name: "",
      github_token_id: "",
    },
  });

  const {
    data: organizations,
    isLoading,
    refetch,
  } = api.organization.getAll.useQuery();

  const createMutation = api.organization.create.useMutation({
    onSuccess: () => {
      toast.success("Organization created");
      refetch();
      setOpenDialog(false);
      form.reset();
    },
    onError: () => {
      toast.error("Failed to create organization");
    },
  });

  const updateMutation = api.organization.update.useMutation({
    onSuccess: () => {
      toast.success("Organization updated");
      refetch();
      setOpenDialog(false);
      setEditingOrg(null);
      form.reset();
    },
    onError: () => {
      toast.error("Failed to update organization");
    },
  });

  const deleteMutation = api.organization.delete.useMutation({
    onSuccess: () => {
      toast.success("Organization deleted");
      refetch();
      setDeleteDialogOpen(false);
      setDeletingOrg(null);
    },
    onError: () => {
      toast.error("Failed to delete organization");
    },
  });

  const onSubmit = (values: OrganizationFormValues) => {
    if (editingOrg) {
      updateMutation.mutate({
        id: editingOrg.id!,
        github_name: values.github_name,
      });
    } else {
      createMutation.mutate({
        github_name: values.github_name,
      });
    }
  };

  const onEdit = (org: { id: number; github_name: string }) => {
    setEditingOrg(org);
    form.reset(org);
    setOpenDialog(true);
  };

  const onDelete = () => {
    if (!deletingOrg) return;
    deleteMutation.mutate({ id: deletingOrg.id });
  };

  React.useEffect(() => {
    setDeleteDialogOpen(deletingOrg !== null);
  }, [deletingOrg]);

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Organizations</h1>
        <Button
          onClick={() => {
            setEditingOrg(null);
            form.reset();
            setOpenDialog(true);
          }}
        >
          New organization
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={2} className="text-center">
                Loading...
              </TableCell>
            </TableRow>
          ) : !organizations || organizations.length === 0 ? (
            <TableRow>
              <TableCell colSpan={2} className="text-center">
                No organizations found.
              </TableCell>
            </TableRow>
          ) : (
            organizations.map((org: { id: number; github_name: string }) => (
              <TableRow key={org.id}>
                <TableCell>
                  <a
                    href={`/organization/${org.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {org.github_name}
                  </a>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    className="mr-2"
                    onClick={() => onEdit(org)}
                  >
                    Edit
                  </Button>
                  <AlertDialog
                    open={deleteDialogOpen && deletingOrg?.id === org.id}
                    onOpenChange={setDeleteDialogOpen}
                  >
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeletingOrg(org)}
                      >
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete organization</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete the organization "
                          {org.github_name}"? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={onDelete}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingOrg ? "Edit organization" : "New organization"}
            </DialogTitle>
            <DialogDescription>
              {editingOrg
                ? "Update the organization details below."
                : "Fill in the details to create a new organization."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
              noValidate
            >
              <FormField
                control={form.control}
                name="github_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Organization name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="github_token_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GitHub Token ID</FormLabel>
                    <FormControl>
                      <Input placeholder="GitHub Token ID" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit">
                  {editingOrg ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Toaster />
    </>
  );
}
