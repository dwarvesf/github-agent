'use client'

import React, { useState } from 'react'
import { useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog'

import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { Button } from '@/components/ui/button'

import { api } from '@/trpc/react'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/ui/EmptyState'

const repositorySchema = z.object({
  id: z.number().optional(),
  github_repo_name: z.string().min(1, 'Repository name is required'),
  channel_id: z.number().min(1, 'Channel is required'),
})

type RepositoryForm = z.infer<typeof repositorySchema>

export default function Repositories() {
  const params = useParams()
  const orgId = Number(params.orgId)

  const [editingRepo, setEditingRepo] = useState<RepositoryForm | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const {
    data: repositories,
    isLoading,
    refetch,
  } = api.repository.getByOrganization.useQuery(orgId, {
    enabled: !!orgId,
  })

  const { data: channels } = api.channel.getByOrganization.useQuery(orgId, {
    enabled: !!orgId,
  })

  const form = useForm<RepositoryForm>({
    resolver: zodResolver(repositorySchema),
    defaultValues: {
      github_repo_name: '',
      channel_id: undefined,
    },
  })

  function openDialog(repo?: RepositoryForm) {
    if (repo) {
      setEditingRepo(repo)
      form.reset(repo)
    } else {
      setEditingRepo(null)
      form.reset({ github_repo_name: '', channel_id: undefined })
    }
    setIsDialogOpen(true)
  }

  function closeDialog() {
    setIsDialogOpen(false)
    setEditingRepo(null)
  }

  const createMutation = api.repository.create.useMutation({
    onSuccess: () => {
      refetch()
      closeDialog()
      form.reset({ channel_id: undefined, github_repo_name: '' })
    },
  })

  const updateMutation = api.repository.update.useMutation({
    onSuccess: () => {
      refetch()
      closeDialog()
      form.reset({ channel_id: undefined, github_repo_name: '' })
    },
  })

  const deleteMutation = api.repository.delete.useMutation({
    onSuccess: () => {
      refetch()
    },
  })

  async function onSubmit(data: RepositoryForm) {
    if (editingRepo && editingRepo.id) {
      await updateMutation.mutateAsync({
        id: editingRepo.id,
        github_repo_name: data.github_repo_name,
        organization_id: orgId,
        channel_id: data.channel_id,
      })
    } else {
      await createMutation.mutateAsync({
        github_repo_name: data.github_repo_name,
        organization_id: orgId,
        channel_id: data.channel_id,
      })
    }
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold">Repositories</h3>
        <Button size="sm" onClick={() => openDialog()}>
          New repository
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-1/3">Name</TableHead>
            <TableHead className="w-1/3">Channel</TableHead>
            <TableHead className="w-1/3" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center">
                <Spinner className="mx-auto" />
              </TableCell>
            </TableRow>
          ) : (
            <>
              {!repositories || repositories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center">
                    <EmptyState message="No repositories found." />
                  </TableCell>
                </TableRow>
              ) : (
                repositories?.map((repo) => (
                  <TableRow key={repo.id}>
                    <TableCell>{repo.github_repo_name}</TableCell>
                    <TableCell>
                      {channels?.find((ch) => ch.id === repo.channel_id)
                        ?.name ?? 'N/A'}
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
                                deleteMutation.mutate({ id: repo.id })
                              }}
                            >
                              Delete
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </>
          )}
        </TableBody>
      </Table>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRepo ? 'Edit repository' : 'Add repository'}
            </DialogTitle>
            <DialogDescription>
              {editingRepo
                ? 'Update the repository details below.'
                : 'Fill in the details to add a new repository.'}
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
                      value={field.value ? String(field.value) : ''}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a channel" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {channels?.map((ch) => (
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
                  {editingRepo ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
