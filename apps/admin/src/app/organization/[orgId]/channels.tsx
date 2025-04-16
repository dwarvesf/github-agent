"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api } from "@/trpc/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
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
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";

const channelSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1, "Name is required"),
  platform: z.string().min(1, "Platform is required"),
  platform_channel_id: z.string().min(1, "Platform channel ID is required"),
});

type ChannelFormValues = z.infer<typeof channelSchema>;

export default function Channels() {
  const orgId = Number(
    window.location.pathname.split("/").filter(Boolean).pop(),
  );

  const [openDialog, setOpenDialog] = useState(false);
  const [editingChannel, setEditingChannel] =
    useState<ChannelFormValues | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingChannel, setDeletingChannel] =
    useState<ChannelFormValues | null>(null);

  const form = useForm<ChannelFormValues>({
    resolver: zodResolver(channelSchema),
    defaultValues: {
      name: "",
      platform: "",
      platform_channel_id: "",
    },
  });

  const {
    data: channels,
    refetch,
    isLoading,
  } = api.channel.getByOrganization.useQuery(orgId);

  const createMutation = api.channel.create.useMutation({
    onSuccess: () => {
      toast.success("Channel created");
      refetch();
      setOpenDialog(false);
      form.reset();
    },
    onError: () => {
      toast.error("Failed to create channel");
    },
  });

  const updateMutation = api.channel.update.useMutation({
    onSuccess: () => {
      toast.success("Channel updated");
      refetch();
      setOpenDialog(false);
      setEditingChannel(null);
      form.reset();
    },
    onError: () => {
      toast.error("Failed to update channel");
    },
  });

  const deleteMutation = api.channel.delete.useMutation({
    onSuccess: () => {
      toast.success("Channel deleted");
      refetch();
      setDeleteDialogOpen(false);
      setDeletingChannel(null);
    },
    onError: () => {
      toast.error("Failed to delete channel");
    },
  });

  const onSubmit = (values: ChannelFormValues) => {
    if (editingChannel) {
      updateMutation.mutate({
        id: editingChannel.id!,
        name: values.name,
        platform: "discord",
        platform_channel_id: values.platform_channel_id,
        organization_id: orgId,
      });
    } else {
      createMutation.mutate({
        name: values.name,
        platform: "discord",
        platform_channel_id: values.platform_channel_id,
        organization_id: orgId,
      });
    }
  };

  const onEdit = (channel: ChannelFormValues) => {
    setEditingChannel(channel);
    form.reset(channel);
    setOpenDialog(true);
  };

  const onDelete = () => {
    if (!deletingChannel) return;
    deleteMutation.mutate({ id: deletingChannel.id! });
  };

  React.useEffect(() => {
    setDeleteDialogOpen(deletingChannel !== null);
  }, [deletingChannel]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">Channels</h2>
        <Button
          size="sm"
          onClick={() => {
            setEditingChannel(null);
            form.reset({
              name: "",
              platform: "discord",
              platform_channel_id: "",
            });
            setOpenDialog(true);
          }}
        >
          New channel
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-1/4">Name</TableHead>
            <TableHead className="w-1/4">Platform</TableHead>
            <TableHead className="w-1/4">Platform channel ID</TableHead>
            <TableHead className="w-1/4" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center">
                <Spinner className="mx-auto" />
              </TableCell>
            </TableRow>
          ) : channels && channels.length > 0 ? (
            channels.map((channel) => (
              <TableRow key={channel.id}>
                <TableCell>{channel.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-blue-600">
                    {channel.platform}
                  </Badge>
                </TableCell>
                <TableCell>{channel.platform_channel_id}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    className="mr-2"
                    onClick={() => onEdit(channel)}
                  >
                    Edit
                  </Button>
                  <AlertDialog
                    open={
                      deleteDialogOpen && deletingChannel?.id === channel.id
                    }
                    onOpenChange={setDeleteDialogOpen}
                  >
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeletingChannel(channel)}
                      >
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Channel</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete the channel "
                          {channel.name}"? This action cannot be undone.
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
          ) : (
            <TableRow>
              <TableCell colSpan={4} className="text-center">
                No channels found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingChannel ? "Edit channel" : "New channel"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
              noValidate
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Channel name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="platform"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Platform</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Platform"
                        {...field}
                        value="discord"
                        disabled
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="platform_channel_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Platform channel ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Platform channel ID" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit">
                  {editingChannel ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
