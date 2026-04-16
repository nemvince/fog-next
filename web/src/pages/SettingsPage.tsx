import { settingsApi, type Setting } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from '@/components/ui/Toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item)
    if (!acc[k]) acc[k] = []
    acc[k].push(item)
    return acc
  }, {})
}

function SettingRow({ setting }: { setting: Setting }) {
  const qc = useQueryClient()
  const [value, setValue] = useState(setting.value)

  const saveMutation = useMutation({
    mutationFn: () => settingsApi.set(setting.key, value),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['settings'] })
      toast('Setting saved', { variant: 'success' })
    },
    onError: (e: Error) => toast(e.message, { variant: 'destructive' }),
  })

  const dirty = value !== setting.value

  return (
    <div className="flex items-end gap-3 py-3 border-b border-gray-800">
      <div className="flex-1">
        <Input
          label={setting.key}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        {setting.description && (
          <p className="mt-1 text-xs text-gray-500">{setting.description}</p>
        )}
      </div>
      <Button
        size="sm"
        onClick={() => saveMutation.mutate()}
        disabled={!dirty || saveMutation.isPending}
      >
        Save
      </Button>
    </div>
  )
}

export function SettingsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.list(),
  })

  const settings: Setting[] = data?.data ?? []
  const grouped = groupBy(settings, (s) => s.category ?? 'General')

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center text-gray-400">
        Loading settings…
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="mb-8 text-2xl font-bold">Settings</h1>

      {Object.entries(grouped).map(([category, items]) => (
        <section key={category} className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
            {category}
          </h2>
          <div className="rounded-lg border border-gray-800 bg-gray-900 px-4">
            {items.map((s) => (
              <SettingRow key={s.key} setting={s} />
            ))}
          </div>
        </section>
      ))}

      {settings.length === 0 && (
        <p className="text-gray-500">No settings available.</p>
      )}
    </div>
  )
}
