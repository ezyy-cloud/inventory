import { ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ClientForm } from '../components/ClientForm'
import { QueryErrorBanner } from '../components/QueryErrorBanner'
import { useClient, useCreateClient, useUpdateClient } from '../hooks/useClients'
import { useClientTags, useClientTagAssignments, useSetClientTags } from '../hooks/useClientTags'

export function ClientFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'

  const { data: client, isError: clientError, error: clientErrorObj, refetch: refetchClient } = useClient(isNew ? null : id ?? null)
  const { data: tags = [] } = useClientTags()
  const { data: assignedTagIds = [] } = useClientTagAssignments(isNew ? null : id ?? null)
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])

  useEffect(() => {
    if (!isNew && assignedTagIds) setSelectedTagIds(assignedTagIds)
  }, [isNew, assignedTagIds])

  const createClient = useCreateClient()
  const updateClient = useUpdateClient()
  const setClientTags = useSetClientTags(id ?? null)
  const mutationError = createClient.error ?? updateClient.error ?? setClientTags.error

  const handleSubmit = async (data: Parameters<typeof createClient.mutateAsync>[0]) => {
    try {
      if (isNew) {
        const created = await createClient.mutateAsync(data)
        if (selectedTagIds.length > 0 && created?.id) {
          await setClientTags.mutateAsync({ tagIds: selectedTagIds, clientId: created.id })
        }
        navigate('/clients')
      } else if (id) {
        await updateClient.mutateAsync({ id, ...data })
        if (selectedTagIds.length > 0 || assignedTagIds.length > 0) {
          await setClientTags.mutateAsync({ tagIds: selectedTagIds })
        }
        navigate(`/clients/${id}`)
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="space-y-6">
      {!isNew && clientError && (
        <QueryErrorBanner
          message={clientErrorObj?.message ?? 'Failed to load client.'}
          onRetry={() => void refetchClient()}
        />
      )}
      {mutationError != null && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {mutationError.message}
        </div>
      )}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(isNew ? '/clients' : `/clients/${id}`)}
          className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-black"
        >
          <ChevronRight className="h-4 w-4 rotate-180" /> Back
        </button>
        <h2 className="text-xl font-semibold text-black">
          {isNew ? 'Add Client' : `Edit ${client?.name ?? 'Client'}`}
        </h2>
      </div>

      <ClientForm
        initialValues={client ?? undefined}
        onSubmit={handleSubmit}
        onCancel={() => navigate(isNew ? '/clients' : `/clients/${id}`)}
        isSubmitting={createClient.isPending || updateClient.isPending || setClientTags.isPending}
        tags={tags}
        selectedTagIds={selectedTagIds}
        onTagsChange={setSelectedTagIds}
      />
    </div>
  )
}
