'use client'

import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

import { api } from '@/trpc/react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Edit } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/spinner'

const organizationSchema = z.object({
  id: z.number().optional(),
  github_name: z.string().min(1, 'Name is required'),
  github_token_id: z.string().min(1, 'Token ID is required'),
})

type OrganizationFormValues = z.infer<typeof organizationSchema>

function GitHubTokenInput({
  field,
  editingOrg,
}: {
  field: any
  editingOrg: OrganizationFormValues | null
}) {
  const [isEditingToken, setIsEditingToken] = useState(false)

  // Function to truncate the token value like abc..xyz
  const truncateToken = (token: string) => {
    if (token.length <= 16) return token
    return `${token.slice(0, 8)}........${token.slice(-8)}`
  }

  useEffect(() => {
    // Reset editing state when dialog is opened or editingOrg changes
    setIsEditingToken(false)
  }, [editingOrg])

  return (
    <FormItem>
      <FormLabel>GitHub Token ID</FormLabel>
      <FormControl>
        {editingOrg && !isEditingToken ? (
          <div className="relative">
            <Input
              placeholder="GitHub Token ID"
              value={field.value ? truncateToken(field.value) : ''}
              disabled
            />
            <Button
              size="sm"
              variant="ghost"
              type="button"
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1"
              onClick={() => {
                setIsEditingToken(true)
                field.onChange('')
              }}
              aria-label="Edit GitHub Token ID"
            >
              <Edit className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Input
            placeholder="GitHub Token ID"
            {...field}
            value={field.value || ''}
            autoFocus
          />
        )}
      </FormControl>
      <FormMessage />
    </FormItem>
  )
}

export default function Home() {
  const [openDialog, setOpenDialog] = useState(false)
  const [editingOrg, setEditingOrg] = useState<OrganizationFormValues | null>(
    null,
  )
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingOrg, setDeletingOrg] = useState<{
    id: number
  } | null>(null)

  const form = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      github_name: '',
      github_token_id: '',
    },
  })

  const {
    data: organizations,
    isLoading,
    refetch,
  } = api.organization.getAll.useQuery()

  const createMutation = api.organization.create.useMutation({
    onSuccess: () => {
      toast.success('Organization created')
      refetch()
      setOpenDialog(false)
      form.reset()
    },
    onError: () => {
      toast.error('Failed to create organization')
    },
  })

  const updateMutation = api.organization.update.useMutation({
    onSuccess: () => {
      toast.success('Organization updated')
      refetch()
      setOpenDialog(false)
      setEditingOrg(null)
      form.reset()
    },
    onError: () => {
      toast.error('Failed to update organization')
    },
  })

  const deleteMutation = api.organization.delete.useMutation({
    onSuccess: () => {
      toast.success('Organization deleted')
      refetch()
      setDeleteDialogOpen(false)
      setDeletingOrg(null)
    },
    onError: () => {
      toast.error('Failed to delete organization')
    },
  })

  const onSubmit = (values: OrganizationFormValues) => {
    if (editingOrg) {
      updateMutation.mutate({
        id: editingOrg.id!,
        github_name: values.github_name,
        github_token_id: values.github_token_id,
      })
    } else {
      createMutation.mutate({
        github_name: values.github_name,
        github_token_id: values.github_token_id,
      })
    }
  }

  const onEdit = (org: {
    id: number
    github_name: string
    github_token_id: string
  }) => {
    setEditingOrg(org)
    form.reset(org)
    setOpenDialog(true)
  }

  const onDelete = () => {
    if (!deletingOrg) return
    deleteMutation.mutate({ id: deletingOrg.id })
  }

  useEffect(() => {
    setDeleteDialogOpen(deletingOrg !== null)
  }, [deletingOrg])

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Organizations</h1>
        <Button
          size="sm"
          onClick={() => {
            form.reset({ github_name: '', github_token_id: '' })
            setEditingOrg(null)
            setOpenDialog(true)
          }}
        >
          New organization
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-1/3">Name</TableHead>
            <TableHead className="w-1/3">Repositories</TableHead>
            <TableHead className="w-1/3 text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center">
                <Spinner className="mx-auto" />
              </TableCell>
            </TableRow>
          ) : !organizations || organizations.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center">
                No organizations found.
              </TableCell>
            </TableRow>
          ) : (
            organizations.map((org) => (
              <TableRow key={org.id}>
                <TableCell className="w-1/3">
                  <a
                    href={`/organization/${org.id}`}
                    className="hover:underline"
                  >
                    {org.github_name}
                  </a>
                </TableCell>
                <TableCell className="w-1/3">
                  {org._count.repositories}
                </TableCell>
                <TableCell className="w-1/3 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    className="mr-2"
                    onClick={() =>
                      onEdit({
                        github_name: org.github_name,
                        github_token_id: org.github_token_id || '',
                        id: org.id,
                      })
                    }
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
                        onClick={() => setDeletingOrg({ id: org.id })}
                      >
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete organization</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete the organization
                          &ldquo;
                          {org.github_name}&quot;? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <Button onClick={onDelete} variant="destructive">
                          Delete
                        </Button>
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
              {editingOrg ? 'Edit organization' : 'New organization'}
            </DialogTitle>
            <DialogDescription>
              {editingOrg
                ? 'Update the organization details below.'
                : 'Fill in the details to create a new organization.'}
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
                  <GitHubTokenInput field={field} editingOrg={editingOrg} />
                )}
              />
              <DialogFooter>
                <Button type="submit">
                  {editingOrg ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Toaster />
    </>
  )
}
