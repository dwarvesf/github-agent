"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { api as trpc } from "@/trpc/react";

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
} from "@/components/ui/dialog";

import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";

const memberSchema = z.object({
  github_id: z.string().min(1, "GitHub ID is required"),
  platform_id: z.string().min(1, "Platform ID is required"),
  platform_type: z.string().min(1, "Platform type is required"),
});

type MemberFormValues = z.infer<typeof memberSchema>;

export default function MembersPage() {
  const utils = trpc.useContext();
  const membersQuery = trpc.members.getAll.useQuery();

  const createMember = trpc.members.create.useMutation({
    onSuccess: () => {
      utils.members.getAll.invalidate();
      setCreateOpen(false);
    },
  });

  const updateMember = trpc.members.update.useMutation({
    onSuccess: () => {
      utils.members.getAll.invalidate();
      setEditOpen(false);
      setEditingMember(null);
    },
  });

  const deleteMember = trpc.members.delete.useMutation({
    onSuccess: () => {
      utils.members.getAll.invalidate();
      setDeleteOpen(false);
      setDeletingMember(null);
    },
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [editingMember, setEditingMember] = useState<
    (MemberFormValues & { id: number }) | null
  >(null);
  const [deletingMember, setDeletingMember] = useState<{
    id: number;
    github_id: string;
  } | null>(null);

  const createForm = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      github_id: "",
      platform_id: "",
      platform_type: "discord",
    },
  });

  const editForm = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      github_id: "",
      platform_id: "",
      platform_type: "discord",
    },
  });

  React.useEffect(() => {
    if (editingMember) {
      editForm.reset({
        github_id: editingMember.github_id,
        platform_id: editingMember.platform_id,
        platform_type: editingMember.platform_type,
      });
    }
  }, [editingMember, editForm]);

  function onCreateSubmit(data: MemberFormValues) {
    createMember.mutate(data);
  }

  function onEditSubmit(data: MemberFormValues) {
    if (!editingMember) return;
    updateMember.mutate({ id: editingMember.id, ...data });
  }

  function onDeleteConfirm() {
    if (!deletingMember) return;
    deleteMember.mutate({ id: deletingMember.id });
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="mb-4 text-2xl font-bold">Members</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">New member</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New member</DialogTitle>
              <DialogDescription>
                Fill in the form to create a new member.
              </DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form
                onSubmit={createForm.handleSubmit(onCreateSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={createForm.control}
                  name="github_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GitHub ID</FormLabel>
                      <FormControl>
                        <Input placeholder="GitHub ID" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="platform_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Platform ID</FormLabel>
                      <FormControl>
                        <Input placeholder="Platform ID" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="platform_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Platform type</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Platform type"
                          {...field}
                          disabled
                          value="discord"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={createMember.isPending}>
                    Create
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-1/5">GitHub ID</TableHead>
            <TableHead className="w-2/5">Platform ID</TableHead>
            <TableHead>Platform type</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {membersQuery.isLoading ? (
            <TableRow>
              <TableCell colSpan={4}>
                <Spinner className="mx-auto" />
              </TableCell>
            </TableRow>
          ) : (
            membersQuery.data?.map((member) => (
              <TableRow key={member.id}>
                <TableCell>{member.github_id}</TableCell>
                <TableCell>{member.platform_id}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-blue-600">
                    {member.platform_type}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Dialog
                    open={editOpen && editingMember?.id === member.id}
                    onOpenChange={setEditOpen}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingMember(member)}
                        className="mr-2"
                      >
                        Edit
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit member</DialogTitle>
                        <DialogDescription>
                          Update the member details.
                        </DialogDescription>
                      </DialogHeader>
                      <Form {...editForm}>
                        <form
                          onSubmit={editForm.handleSubmit(onEditSubmit)}
                          className="space-y-4"
                        >
                          <FormField
                            control={editForm.control}
                            name="github_id"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>GitHub ID</FormLabel>
                                <FormControl>
                                  <Input placeholder="GitHub ID" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={editForm.control}
                            name="platform_id"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Platform ID</FormLabel>
                                <FormControl>
                                  <Input placeholder="Platform ID" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={editForm.control}
                            name="platform_type"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Platform type</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Platform type"
                                    {...field}
                                    disabled
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <DialogFooter>
                            <Button
                              type="submit"
                              disabled={updateMember.isPending}
                            >
                              Update
                            </Button>
                          </DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>

                  <AlertDialog
                    open={deleteOpen && deletingMember?.id === member.id}
                    onOpenChange={setDeleteOpen}
                  >
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeletingMember(member)}
                      >
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently
                          delete the member with GitHub ID &quot;
                          {member.github_id}&quot;.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={onDeleteConfirm}
                          className="bg-destructive"
                        >
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
    </>
  );
}
