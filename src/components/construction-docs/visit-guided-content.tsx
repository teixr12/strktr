'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Loader2, Plus, Trash2 } from 'lucide-react'
import { apiRequest } from '@/lib/api/client'
import { toast } from '@/hooks/use-toast'

type VisitType = 'PRE' | 'POST'

type CreateVisitResponse = {
  visit: {
    id: string
  }
}

export function ConstructionDocsVisitGuidedContent({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [saving, setSaving] = useState(false)
  const [visitType, setVisitType] = useState<VisitType>('PRE')
  const [visitDate, setVisitDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [objective, setObjective] = useState('')
  const [roomInput, setRoomInput] = useState('')
  const [rooms, setRooms] = useState<Array<{ name: string; sort_order: number }>>([])

  const canGoNext = useMemo(() => {
    if (step === 1) return visitDate.length >= 10
    if (step === 2) return rooms.length > 0
    return true
  }, [rooms.length, step, visitDate.length])

  function addRoom() {
    const name = roomInput.trim()
    if (!name) return
    if (rooms.some((room) => room.name.toLowerCase() === name.toLowerCase())) {
      toast('Este ambiente já foi adicionado', 'error')
      return
    }
    setRooms((current) => [...current, { name, sort_order: current.length }])
    setRoomInput('')
  }

  function removeRoom(index: number) {
    setRooms((current) => current.filter((_, idx) => idx !== index).map((room, idx) => ({ ...room, sort_order: idx })))
  }

  async function createVisit() {
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        type: visitType,
        visit_date: visitDate,
        initial_rooms: rooms,
      }

      if (objective.trim().length > 0) {
        payload.metadata = { objective: objective.trim() }
      }

      const response = await apiRequest<CreateVisitResponse>(
        `/api/v1/construction-docs/projects/${projectId}/visits`,
        {
          method: 'POST',
          body: payload,
        }
      )

      toast('Visita criada com sucesso', 'success')
      router.push(`/construction-docs/visits/${response.visit.id}`)
      router.refresh()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Erro ao criar visita', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="tailadmin-page space-y-4" aria-busy={saving}>
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Fluxo Guiado de Visita</h1>
        <p className="mt-2 text-sm text-gray-500">
          Projeto <span className="font-mono">{projectId}</span>. Configure a visita em 3 passos e já siga para upload/anotações.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
          <span className={step >= 1 ? 'text-sand-600' : 'text-gray-400'}>1. Dados</span>
          <span className="text-gray-300">/</span>
          <span className={step >= 2 ? 'text-sand-600' : 'text-gray-400'}>2. Ambientes</span>
          <span className="text-gray-300">/</span>
          <span className={step >= 3 ? 'text-sand-600' : 'text-gray-400'}>3. Confirmar</span>
        </div>

        {step === 1 && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <label className="min-w-[180px] space-y-1">
                <span className="text-xs font-medium text-gray-500">Tipo de visita</span>
                <select
                  value={visitType}
                  onChange={(event) => setVisitType(event.target.value as VisitType)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                >
                  <option value="PRE">Pré-obra</option>
                  <option value="POST">Pós-obra</option>
                </select>
              </label>
              <label className="min-w-[180px] space-y-1">
                <span className="text-xs font-medium text-gray-500">Data</span>
                <input
                  type="date"
                  value={visitDate}
                  onChange={(event) => setVisitDate(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                />
              </label>
            </div>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-gray-500">Objetivo (opcional)</span>
              <textarea
                rows={3}
                value={objective}
                onChange={(event) => setObjective(event.target.value)}
                placeholder="Ex.: validar etapas críticas antes da concretagem"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
              />
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Adicione os ambientes para acelerar upload e organização das fotos.
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                value={roomInput}
                onChange={(event) => setRoomInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addRoom()
                  }
                }}
                placeholder="Ex.: Sala, Cozinha, Fachada"
                className="min-w-[260px] flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
              />
              <button
                type="button"
                onClick={addRoom}
                className="inline-flex items-center gap-2 rounded-xl bg-sand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-sand-600"
              >
                <Plus className="h-4 w-4" />
                Adicionar
              </button>
            </div>
            <div className="space-y-2">
              {rooms.length === 0 && (
                <p className="rounded-xl border border-dashed border-gray-300 px-3 py-3 text-sm text-gray-500 dark:border-gray-700">
                  Nenhum ambiente adicionado ainda.
                </p>
              )}
              {rooms.map((room, index) => (
                <div
                  key={`${room.name}-${index}`}
                  className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2 dark:border-gray-700"
                >
                  <span className="text-sm text-gray-800 dark:text-gray-100">
                    {index + 1}. {room.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeRoom(index)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remover
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2 text-sm text-gray-700 dark:text-gray-200">
            <p>
              <span className="font-semibold">Tipo:</span> {visitType === 'PRE' ? 'Pré-obra' : 'Pós-obra'}
            </p>
            <p>
              <span className="font-semibold">Data:</span>{' '}
              {new Date(`${visitDate}T00:00:00`).toLocaleDateString('pt-BR')}
            </p>
            <p>
              <span className="font-semibold">Ambientes:</span> {rooms.length}
            </p>
            <p>
              <span className="font-semibold">Objetivo:</span> {objective.trim() || 'Não informado'}
            </p>
            <p className="pt-2 text-xs text-gray-500">
              Ao confirmar, a visita é persistida no backend e você será redirecionado para a tela da visita.
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <Link
            href={`/construction-docs/projects/${projectId}`}
            className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            Voltar ao projeto
          </Link>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((current) => (current > 1 ? ((current - 1) as 1 | 2 | 3) : current))}
                className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Anterior
              </button>
            )}
            {step < 3 && (
              <button
                type="button"
                onClick={() => setStep((current) => (current < 3 ? ((current + 1) as 1 | 2 | 3) : current))}
                disabled={!canGoNext}
                className="inline-flex items-center gap-1 rounded-xl bg-sand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-sand-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Próximo
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
            {step === 3 && (
              <button
                type="button"
                onClick={() => void createVisit()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Confirmar e abrir visita
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
