'use client'

import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from '@/hooks/use-toast'
import { X } from 'lucide-react'
import { apiRequest } from '@/lib/api/client'
import type { Obra } from '@/types/database'
import { obraFormSchema, type ObraFormDTO } from '@/shared/schemas/execution'

interface ObraFormModalProps {
  obra?: Obra | null
  onClose: () => void
  onSaved: () => void
}

export function ObraFormModal({ obra, onClose, onSaved }: ObraFormModalProps) {
  const isEdit = !!obra
  const [loading, setLoading] = useState(false)

  const defaultValues = useMemo<ObraFormDTO>(
    () => ({
      nome: obra?.nome || '',
      cliente: obra?.cliente || '',
      local: obra?.local || '',
      tipo: obra?.tipo || 'Residencial',
      valor_contrato: obra?.valor_contrato || 0,
      area_m2: obra?.area_m2 || null,
      progresso: obra?.progresso || 0,
      status: obra?.status || 'Em Andamento',
      etapa_atual: obra?.etapa_atual || null,
      data_inicio: obra?.data_inicio || null,
      data_previsao: obra?.data_previsao || null,
      descricao: obra?.descricao || null,
    }),
    [obra]
  )

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<ObraFormDTO>({
    resolver: zodResolver(obraFormSchema),
    defaultValues,
  })

  async function onSubmit(values: ObraFormDTO) {
    setLoading(true)
    try {
      if (isEdit && obra) {
        await apiRequest(`/api/v1/obras/${obra.id}`, {
          method: 'PUT',
          body: values,
        })
      } else {
        await apiRequest('/api/v1/obras', {
          method: 'POST',
          body: values,
        })
      }
      toast(isEdit ? 'Obra atualizada!' : 'Obra criada!', 'success')
      onSaved()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar obra'
      toast(message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50 backdrop-blur-sm">
      <div className="modal-glass modal-animate w-full md:max-w-lg rounded-t-3xl md:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto dark:bg-gray-900">
        <div className="p-5 border-b border-gray-200/50 dark:border-gray-800 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEdit ? 'Editar Obra' : 'Nova Obra'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-3">
          <div>
            <input
              {...register('nome')}
              placeholder="Nome da obra *"
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-500/50 dark:text-white"
            />
            {errors.nome && <p className="text-xs text-red-500 mt-1">{errors.nome.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <input
                {...register('cliente')}
                placeholder="Cliente *"
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-500/50 dark:text-white"
              />
              {errors.cliente && <p className="text-xs text-red-500 mt-1">{errors.cliente.message}</p>}
            </div>
            <div>
              <input
                {...register('local')}
                placeholder="Local *"
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-500/50 dark:text-white"
              />
              {errors.local && <p className="text-xs text-red-500 mt-1">{errors.local.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <select {...register('tipo')} className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white">
              <option>Residencial</option><option>Comercial</option><option>Industrial</option><option>Rural</option><option>Reforma</option>
            </select>
            <select {...register('status')} className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white">
              <option>Em Andamento</option><option>Orçamento</option><option>Pausada</option><option>Concluída</option><option>Cancelada</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">R$</span>
              <input
                type="number"
                {...register('valor_contrato', { valueAsNumber: true })}
                placeholder="Valor contrato"
                className="w-full pl-8 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white"
              />
            </div>
            <input
              type="number"
              {...register('area_m2', {
                setValueAs: (value) => (value === '' ? null : Number(value)),
              })}
              placeholder="Área m²"
              className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input
              {...register('etapa_atual', {
                setValueAs: (value) => (value?.trim() ? value : null),
              })}
              placeholder="Etapa atual (ex: Fundação)"
              className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white"
            />
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Progresso: {watch('progresso') || 0}%</label>
              <input
                type="range"
                min="0"
                max="100"
                value={watch('progresso') || 0}
                onChange={(e) => setValue('progresso', Number(e.target.value))}
                className="w-full accent-sand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Data Início</label>
              <input
                type="date"
                {...register('data_inicio', { setValueAs: (value) => (value || null) })}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Previsão Conclusão</label>
              <input
                type="date"
                {...register('data_previsao', { setValueAs: (value) => (value || null) })}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white"
              />
            </div>
          </div>

          <textarea
            {...register('descricao', {
              setValueAs: (value) => (value?.trim() ? value : null),
            })}
            placeholder="Descrição / observações"
            rows={3}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none resize-none dark:text-white"
          />

          <button type="submit" disabled={loading} className="w-full py-3.5 bg-gradient-to-r from-sand-500 to-sand-700 hover:from-sand-600 hover:to-sand-800 text-white font-medium rounded-2xl btn-press transition-all shadow-lg shadow-sand-500/25 disabled:opacity-60">
            {loading ? 'Salvando...' : 'Salvar Obra'}
          </button>
        </form>
      </div>
    </div>
  )
}
