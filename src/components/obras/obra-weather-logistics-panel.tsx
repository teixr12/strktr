'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from '@/hooks/use-toast'
import { apiRequest } from '@/lib/api/client'
import { featureFlags } from '@/lib/feature-flags'
import type { ObraLocationPayload } from '@/shared/types/obra-location'
import type { ObraWeatherPayload } from '@/shared/types/obra-weather'
import type {
  ObraLogisticsEstimatePayload,
  ObraLogisticsEstimateRequest,
} from '@/shared/types/obra-logistics'

const ObraLocationMap = dynamic(
  () => import('@/components/obras/obra-location-map').then((module) => module.ObraLocationMap),
  { ssr: false }
)

interface ObraWeatherLogisticsPanelProps {
  obraId: string
  obraNome: string
}

function asNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function ObraWeatherLogisticsPanel({ obraId, obraNome }: ObraWeatherLogisticsPanelProps) {
  const weatherEnabled = featureFlags.obraWeatherV1
  const mapEnabled = featureFlags.obraMapV1
  const logisticsEnabled = featureFlags.obraLogisticsV1

  const [loadingLocation, setLoadingLocation] = useState(false)
  const [savingLocation, setSavingLocation] = useState(false)
  const [locationPayload, setLocationPayload] = useState<ObraLocationPayload | null>(null)
  const [weatherPayload, setWeatherPayload] = useState<ObraWeatherPayload | null>(null)
  const [loadingWeather, setLoadingWeather] = useState(false)
  const [estimating, setEstimating] = useState(false)
  const [estimatePayload, setEstimatePayload] = useState<ObraLogisticsEstimatePayload | null>(null)

  const [latInput, setLatInput] = useState('')
  const [lngInput, setLngInput] = useState('')
  const [originLatInput, setOriginLatInput] = useState('')
  const [originLngInput, setOriginLngInput] = useState('')
  const [consumptionInput, setConsumptionInput] = useState('10')
  const [fuelInput, setFuelInput] = useState('6')
  const [tollInput, setTollInput] = useState('0')

  const hasFeatures = weatherEnabled || mapEnabled || logisticsEnabled
  const location = locationPayload?.location || null

  const loadLocation = useCallback(async () => {
    if (!hasFeatures) return
    setLoadingLocation(true)
    try {
      const payload = await apiRequest<ObraLocationPayload>(`/api/v1/obras/${obraId}/location`)
      setLocationPayload(payload)
      if (payload.location) {
        setLatInput(String(payload.location.lat))
        setLngInput(String(payload.location.lng))
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Falha ao carregar localização', 'error')
    } finally {
      setLoadingLocation(false)
    }
  }, [hasFeatures, obraId])

  const loadWeather = useCallback(async () => {
    if (!weatherEnabled || !location) return
    setLoadingWeather(true)
    try {
      const payload = await apiRequest<ObraWeatherPayload>(`/api/v1/obras/${obraId}/weather?days=7`)
      setWeatherPayload(payload)
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Falha ao carregar previsão', 'error')
      setWeatherPayload(null)
    } finally {
      setLoadingWeather(false)
    }
  }, [weatherEnabled, location, obraId])

  useEffect(() => {
    void loadLocation()
  }, [loadLocation])

  useEffect(() => {
    if (!location) {
      setWeatherPayload(null)
      return
    }
    void loadWeather()
  }, [location, loadWeather])

  const saveLocation = useCallback(async () => {
    const lat = asNumber(latInput)
    const lng = asNumber(lngInput)
    if (lat === null || lng === null) {
      toast('Latitude/longitude inválidas', 'error')
      return
    }

    setSavingLocation(true)
    try {
      const payload = await apiRequest<ObraLocationPayload>(`/api/v1/obras/${obraId}/location`, {
        method: 'PATCH',
        body: { lat, lng, source: 'manual' },
      })
      setLocationPayload(payload)
      toast('Localização atualizada', 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Falha ao salvar localização', 'error')
    } finally {
      setSavingLocation(false)
    }
  }, [latInput, lngInput, obraId])

  const estimateLogistics = useCallback(async () => {
    const originLat = asNumber(originLatInput)
    const originLng = asNumber(originLngInput)
    const consumption = asNumber(consumptionInput)
    const fuel = asNumber(fuelInput)
    const toll = asNumber(tollInput)

    if (originLat === null || originLng === null || consumption === null || fuel === null) {
      toast('Preencha origem, consumo e combustível com valores válidos', 'error')
      return
    }

    const payload: ObraLogisticsEstimateRequest = {
      originLat,
      originLng,
      consumptionKmPerLiter: consumption,
      fuelPricePerLiter: fuel,
      tollCost: toll === null ? 0 : toll,
    }

    setEstimating(true)
    try {
      const estimate = await apiRequest<ObraLogisticsEstimatePayload>(
        `/api/v1/obras/${obraId}/logistics/estimate`,
        {
          method: 'POST',
          body: payload,
        }
      )
      setEstimatePayload(estimate)
      toast('Estimativa logística calculada', 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Provider de rota indisponível', 'error')
    } finally {
      setEstimating(false)
    }
  }, [consumptionInput, fuelInput, obraId, originLatInput, originLngInput, tollInput])

  const topWeather = useMemo(() => weatherPayload?.days?.slice(0, 3) || [], [weatherPayload])

  if (!hasFeatures) return null

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Clima, Mapa e Logística</h3>
        <span className="text-[11px] text-gray-500">Wave2</span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Localização da obra</p>
          {loadingLocation ? (
            <p className="text-xs text-gray-500">Carregando localização...</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={latInput}
                  onChange={(event) => setLatInput(event.target.value)}
                  placeholder="Latitude"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
                <input
                  value={lngInput}
                  onChange={(event) => setLngInput(event.target.value)}
                  placeholder="Longitude"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>
              <button
                type="button"
                onClick={() => void saveLocation()}
                disabled={savingLocation}
                className="rounded-lg bg-sand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-sand-600 disabled:opacity-60"
              >
                {savingLocation ? 'Salvando...' : 'Salvar localização'}
              </button>
              {location && (
                <p className="text-[11px] text-gray-500">
                  Fonte: {location.source} · Atualizado em {new Date(location.updated_at).toLocaleString('pt-BR')}
                </p>
              )}
            </>
          )}
        </div>

        {mapEnabled && location ? (
          <ObraLocationMap lat={location.lat} lng={location.lng} title={obraNome} />
        ) : (
          <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-gray-300 px-3 text-center text-xs text-gray-500 dark:border-gray-700">
            Defina latitude/longitude para habilitar o mapa da obra.
          </div>
        )}
      </div>

      {weatherEnabled && (
        <div className="space-y-2 border-t border-gray-200 pt-3 dark:border-gray-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Condições da obra (7 dias)</p>
          {!location ? (
            <p className="text-xs text-gray-500">Sem localização definida para previsão.</p>
          ) : loadingWeather ? (
            <p className="text-xs text-gray-500">Consultando Open-Meteo...</p>
          ) : weatherPayload?.unavailableReason ? (
            <p className="text-xs text-amber-600">{weatherPayload.unavailableReason}</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-3">
              {topWeather.map((day) => (
                <div key={day.date} className="rounded-xl border border-gray-200 px-3 py-2 dark:border-gray-700">
                  <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{day.date}</p>
                  <p className="text-[11px] text-gray-500">{day.description}</p>
                  <p className="mt-1 text-[11px] text-gray-700 dark:text-gray-300">
                    {day.tempMin ?? '-'}° / {day.tempMax ?? '-'}°
                  </p>
                  <p className="text-[11px] text-gray-500">
                    Chuva {day.precipProbMax ?? '-'}% · Vento {day.windSpeedMax ?? '-'} km/h
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-gray-700 dark:text-gray-200">
                    Severidade: {day.severity.toUpperCase()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {logisticsEnabled && (
        <div className="space-y-2 border-t border-gray-200 pt-3 dark:border-gray-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Estimativa logística</p>
          <div className="grid gap-2 md:grid-cols-3">
            <input
              value={originLatInput}
              onChange={(event) => setOriginLatInput(event.target.value)}
              placeholder="Origem lat"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
            <input
              value={originLngInput}
              onChange={(event) => setOriginLngInput(event.target.value)}
              placeholder="Origem lng"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
            <input
              value={consumptionInput}
              onChange={(event) => setConsumptionInput(event.target.value)}
              placeholder="Km/L"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
            <input
              value={fuelInput}
              onChange={(event) => setFuelInput(event.target.value)}
              placeholder="Preço combustível"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
            <input
              value={tollInput}
              onChange={(event) => setTollInput(event.target.value)}
              placeholder="Pedágio"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
            <button
              type="button"
              onClick={() => void estimateLogistics()}
              disabled={estimating || !location}
              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {estimating ? 'Calculando...' : 'Simular logística'}
            </button>
          </div>
          {!location && <p className="text-xs text-gray-500">Defina a localização da obra para simular rota.</p>}
          {estimatePayload && (
            <div className="rounded-xl border border-gray-200 px-3 py-2 text-xs dark:border-gray-700">
              <p className="font-semibold text-gray-900 dark:text-gray-100">Provider: {estimatePayload.provider}</p>
              <p className="text-gray-600 dark:text-gray-300">
                Distância: {estimatePayload.route.distanceKm} km · Duração: {estimatePayload.route.durationMin} min
              </p>
              <p className="text-gray-600 dark:text-gray-300">
                Combustível: {estimatePayload.costs.fuelLiters} L · Custo combustível: R$ {estimatePayload.costs.fuelCost}
              </p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                Custo total estimado: R$ {estimatePayload.costs.totalCost}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

