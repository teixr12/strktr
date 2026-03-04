'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Loader2, Upload } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { apiRequest } from '@/lib/api/client'

interface VisitPayload {
  visit: {
    id: string
    type: 'PRE' | 'POST'
    visit_date: string
    metadata: Record<string, unknown>
  }
  rooms: Array<{
    id: string
    name: string
    sort_order: number
  }>
  photos: Array<{
    id: string
    room_id: string | null
    url: string
    metadata: Record<string, unknown>
    annotations: Array<{
      id: string
      type: 'arrow' | 'rect' | 'text'
      text: string | null
    }>
  }>
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'))
    reader.onload = () => resolve(String(reader.result || ''))
    reader.readAsDataURL(file)
  })
}

export function ConstructionDocsVisitContent({ visitId }: { visitId: string }) {
  const [payload, setPayload] = useState<VisitPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState<string>('')

  const photosByRoom = useMemo(() => {
    const map = new Map<string, VisitPayload['photos']>()
    for (const photo of payload?.photos || []) {
      const key = photo.room_id || 'sem-room'
      const group = map.get(key) || []
      group.push(photo)
      map.set(key, group)
    }
    return map
  }, [payload?.photos])

  async function load() {
    setLoading(true)
    try {
      const data = await apiRequest<VisitPayload>(`/api/v1/construction-docs/visits/${visitId}`)
      setPayload(data)
      if (data.rooms.length > 0 && !selectedRoom) {
        setSelectedRoom(data.rooms[0].id)
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Erro ao carregar visita', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitId])

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return

    setSaving(true)
    try {
      const items = await Promise.all(
        Array.from(files).map(async (file) => ({
          filename: file.name,
          mime_type: file.type || 'application/octet-stream',
          base64: await fileToBase64(file),
          room_id: selectedRoom || null,
        }))
      )

      await apiRequest(`/api/v1/construction-docs/visits/${visitId}/photos`, {
        method: 'POST',
        body: {
          files: items,
        },
      })
      toast('Fotos enviadas', 'success')
      await load()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Erro ao enviar fotos', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="tailadmin-page space-y-4" aria-busy={loading || saving}>
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Visita Construction Docs</h1>
            <p className="text-sm text-gray-500">{visitId}</p>
          </div>
          <Link
            href="/construction-docs/templates"
            className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            Ver templates
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs uppercase text-gray-500">Ambiente</label>
            <select
              value={selectedRoom}
              onChange={(event) => setSelectedRoom(event.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
            >
              <option value="">Sem ambiente</option>
              {(payload?.rooms || []).map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </div>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-sand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-sand-600">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload de fotos
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => void uploadFiles(event.target.files)}
            />
          </label>
        </div>

        {loading && <p className="text-sm text-gray-500">Carregando...</p>}

        {!loading && (payload?.photos || []).length === 0 && (
          <p className="text-sm text-gray-500">Nenhuma foto enviada ainda.</p>
        )}

        <div className="space-y-4">
          {[...(payload?.rooms || []), { id: 'sem-room', name: 'Sem ambiente', sort_order: 9999 }].map((room) => {
            const photos = photosByRoom.get(room.id) || []
            if (photos.length === 0) return null

            return (
              <div key={room.id} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{room.name}</h3>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {photos.map((photo) => (
                    <div key={photo.id} className="rounded-xl border border-gray-200 p-2 dark:border-gray-700">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt="Foto da visita" className="h-28 w-full rounded-lg object-cover" />
                      <p className="mt-2 text-[11px] text-gray-500">Anotações: {photo.annotations.length}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
