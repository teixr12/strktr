'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from '@/hooks/use-toast'
import { apiRequest } from '@/lib/api/client'
import { featureFlags } from '@/lib/feature-flags'
import { track } from '@/lib/analytics/client'
import type { ObraLocationInput, ObraLocationPayload } from '@/shared/types/obra-location'
import type { OrgHqLocationPayload } from '@/shared/types/org-hq-location'
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
  weatherEnabled?: boolean
  mapEnabled?: boolean
  logisticsEnabled?: boolean
}

type AddressFormState = {
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
}

const EMPTY_ADDRESS_FORM: AddressFormState = {
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
}

function asNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function hasAddressValue(form: AddressFormState) {
  return Boolean(form.cep || form.logradouro || form.cidade || form.estado || form.bairro)
}

function mapLocationToForm(location: ObraLocationPayload['location'] | OrgHqLocationPayload['location']): AddressFormState {
  if (!location) return EMPTY_ADDRESS_FORM
  return {
    cep: location.cep || '',
    logradouro: location.logradouro || '',
    numero: location.numero || '',
    complemento: location.complemento || '',
    bairro: location.bairro || '',
    cidade: location.cidade || '',
    estado: location.estado || '',
  }
}

function buildAddressBody(form: AddressFormState): ObraLocationInput {
  return {
    cep: form.cep || null,
    logradouro: form.logradouro || null,
    numero: form.numero || null,
    complemento: form.complemento || null,
    bairro: form.bairro || null,
    cidade: form.cidade || null,
    estado: form.estado || null,
    source: 'manual',
  }
}

function formatLocationLabel(location: ObraLocationPayload['location'] | OrgHqLocationPayload['location']) {
  if (!location) return null
  return (
    location.formatted_address ||
    [
      [location.logradouro, location.numero].filter(Boolean).join(', '),
      [location.bairro, location.cidade, location.estado].filter(Boolean).join(' · '),
      location.cep,
    ]
      .filter(Boolean)
      .join(' · ')
  )
}

function severityTone(severity: string) {
  if (severity === 'high') return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300'
  if (severity === 'medium') return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300'
  return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300'
}

export function ObraWeatherLogisticsPanel({
  obraId,
  obraNome,
  weatherEnabled = false,
  mapEnabled = false,
  logisticsEnabled = false,
}: ObraWeatherLogisticsPanelProps) {
  const addressUxV2 = featureFlags.obraAddressUxV2
  const hqRoutingEnabled = featureFlags.obraHqRoutingV1 && logisticsEnabled
  const addressLogisticsUx = addressUxV2 && hqRoutingEnabled

  const [loadingLocation, setLoadingLocation] = useState(false)
  const [savingLocation, setSavingLocation] = useState(false)
  const [locationPayload, setLocationPayload] = useState<ObraLocationPayload | null>(null)
  const [weatherPayload, setWeatherPayload] = useState<ObraWeatherPayload | null>(null)
  const [loadingWeather, setLoadingWeather] = useState(false)
  const [estimating, setEstimating] = useState(false)
  const [estimatePayload, setEstimatePayload] = useState<ObraLogisticsEstimatePayload | null>(null)
  const [hqPayload, setHqPayload] = useState<OrgHqLocationPayload | null>(null)
  const [loadingHq, setLoadingHq] = useState(false)

  const [latInput, setLatInput] = useState('')
  const [lngInput, setLngInput] = useState('')
  const [originLatInput, setOriginLatInput] = useState('')
  const [originLngInput, setOriginLngInput] = useState('')
  const [consumptionInput, setConsumptionInput] = useState('10')
  const [fuelInput, setFuelInput] = useState('6')
  const [tollInput, setTollInput] = useState('0')
  const [locationForm, setLocationForm] = useState<AddressFormState>(EMPTY_ADDRESS_FORM)
  const [originOverrideForm, setOriginOverrideForm] = useState<AddressFormState>(EMPTY_ADDRESS_FORM)
  const [useOriginOverride, setUseOriginOverride] = useState(false)

  const hasFeatures = weatherEnabled || mapEnabled || logisticsEnabled
  const location = locationPayload?.location || null
  const hqLocation = hqPayload?.location || null

  const loadLocation = useCallback(async () => {
    if (!hasFeatures) return
    setLoadingLocation(true)
    try {
      const payload = await apiRequest<ObraLocationPayload>(`/api/v1/obras/${obraId}/location`)
      setLocationPayload(payload)
      if (payload.location) {
        setLatInput(String(payload.location.lat))
        setLngInput(String(payload.location.lng))
        setLocationForm(mapLocationToForm(payload.location))
      } else {
        setLocationForm(EMPTY_ADDRESS_FORM)
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Falha ao carregar localização', 'error')
    } finally {
      setLoadingLocation(false)
    }
  }, [hasFeatures, obraId])

  const loadHq = useCallback(async () => {
    if (!hqRoutingEnabled) return
    setLoadingHq(true)
    try {
      const payload = await apiRequest<OrgHqLocationPayload>('/api/v1/config/org/hq-location')
      setHqPayload(payload)
    } catch (error) {
      setHqPayload(null)
      toast(error instanceof Error ? error.message : 'Falha ao carregar sede da organização', 'error')
    } finally {
      setLoadingHq(false)
    }
  }, [hqRoutingEnabled])

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
    if (hqRoutingEnabled) {
      void loadHq()
    }
  }, [hqRoutingEnabled, loadHq])

  useEffect(() => {
    if (!location) {
      setWeatherPayload(null)
      return
    }
    void loadWeather()
  }, [location, loadWeather])

  const saveLegacyLocation = useCallback(async () => {
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
      void track('obra_location_saved', {
        source: 'obras',
        entity_type: 'obra',
        entity_id: obraId,
        outcome: 'success',
      })
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Falha ao salvar localização', 'error')
    } finally {
      setSavingLocation(false)
    }
  }, [latInput, lngInput, obraId])

  const saveAddressLocation = useCallback(async () => {
    if (!hasAddressValue(locationForm)) {
      toast('Preencha CEP ou endereço para salvar a localização da obra', 'error')
      return
    }

    setSavingLocation(true)
    try {
      const payload = await apiRequest<ObraLocationPayload>(`/api/v1/obras/${obraId}/location`, {
        method: 'PATCH',
        body: buildAddressBody(locationForm),
      })
      setLocationPayload(payload)
      setLocationForm(mapLocationToForm(payload.location))
      if (payload.location) {
        setLatInput(String(payload.location.lat))
        setLngInput(String(payload.location.lng))
      }
      toast('Endereço da obra atualizado', 'success')
      void track('obra_location_saved', {
        source: 'obras',
        entity_type: 'obra',
        entity_id: obraId,
        outcome: 'success',
      })
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Falha ao salvar endereço da obra', 'error')
    } finally {
      setSavingLocation(false)
    }
  }, [locationForm, obraId])

  const estimateLogistics = useCallback(async () => {
    const consumption = asNumber(consumptionInput)
    const fuel = asNumber(fuelInput)
    const toll = asNumber(tollInput)

    if (consumption === null || fuel === null) {
      toast('Preencha consumo e combustível com valores válidos', 'error')
      return
    }

    const payload: ObraLogisticsEstimateRequest = {
      consumptionKmPerLiter: consumption,
      fuelPricePerLiter: fuel,
      tollCost: toll === null ? 0 : toll,
      useOrgHq: addressLogisticsUx && !useOriginOverride,
    }

    if (addressLogisticsUx) {
      if (useOriginOverride) {
        if (!hasAddressValue(originOverrideForm)) {
          toast('Preencha o endereço da origem manual para simular logística', 'error')
          return
        }
        payload.originOverride = buildAddressBody(originOverrideForm)
      } else if (!hqLocation && hqRoutingEnabled) {
        toast('Defina a sede da organização em Configurações ou use uma origem manual', 'error')
        return
      }
    } else {
      const originLat = asNumber(originLatInput)
      const originLng = asNumber(originLngInput)
      if (originLat === null || originLng === null) {
        toast('Preencha a origem da rota com latitude e longitude válidas', 'error')
        return
      }
      payload.originLat = originLat
      payload.originLng = originLng
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
      void track('logistics_estimated', {
        source: 'obras',
        entity_type: 'obra',
        entity_id: obraId,
        outcome: 'success',
      })
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Provider de rota indisponível', 'error')
    } finally {
      setEstimating(false)
    }
  }, [
    addressLogisticsUx,
    consumptionInput,
    fuelInput,
    hqLocation,
    hqRoutingEnabled,
    obraId,
    originLatInput,
    originLngInput,
    originOverrideForm,
    tollInput,
    useOriginOverride,
  ])

  const forecastDays = useMemo(() => weatherPayload?.days || [], [weatherPayload])
  const locationSummary = formatLocationLabel(location)
  const hqSummary = formatLocationLabel(hqLocation)

  if (!hasFeatures) return null

  return (
    <div className="glass-card rounded-2xl p-5 space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Clima, mapa e logística</h3>
          <p className="text-[11px] text-gray-500">
            {addressUxV2 ? 'Fluxo por CEP/endereço com sede da organização' : 'Fluxo legado por latitude/longitude'}
          </p>
        </div>
        <span className="text-[11px] text-gray-500">Wave2</span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <div className="space-y-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Localização da obra</p>
              <p className="text-xs text-gray-500">
                {locationSummary || 'Defina o endereço da obra para habilitar mapa, clima e logística.'}
              </p>
            </div>
            {location ? (
              <span className="rounded-full bg-sand-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-sand-700 dark:bg-sand-900/30 dark:text-sand-300">
                {location.source}
              </span>
            ) : null}
          </div>

          {loadingLocation ? (
            <div className="space-y-2">
              <div className="skeleton h-10 rounded-xl" />
              <div className="skeleton h-10 rounded-xl" />
              <div className="skeleton h-10 rounded-xl" />
            </div>
          ) : addressUxV2 ? (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={locationForm.cep}
                  onChange={(event) => setLocationForm((prev) => ({ ...prev, cep: event.target.value }))}
                  placeholder="CEP"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
                <input
                  value={locationForm.numero}
                  onChange={(event) => setLocationForm((prev) => ({ ...prev, numero: event.target.value }))}
                  placeholder="Número"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
                <input
                  value={locationForm.logradouro}
                  onChange={(event) => setLocationForm((prev) => ({ ...prev, logradouro: event.target.value }))}
                  placeholder="Logradouro"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 md:col-span-2"
                />
                <input
                  value={locationForm.complemento}
                  onChange={(event) => setLocationForm((prev) => ({ ...prev, complemento: event.target.value }))}
                  placeholder="Complemento"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 md:col-span-2"
                />
                <input
                  value={locationForm.bairro}
                  onChange={(event) => setLocationForm((prev) => ({ ...prev, bairro: event.target.value }))}
                  placeholder="Bairro"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
                <input
                  value={locationForm.cidade}
                  onChange={(event) => setLocationForm((prev) => ({ ...prev, cidade: event.target.value }))}
                  placeholder="Cidade"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
                <input
                  value={locationForm.estado}
                  onChange={(event) => setLocationForm((prev) => ({ ...prev, estado: event.target.value }))}
                  placeholder="UF"
                  maxLength={2}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm uppercase text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void saveAddressLocation()}
                  disabled={savingLocation}
                  className="rounded-lg bg-sand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-sand-600 disabled:opacity-60"
                >
                  {savingLocation ? 'Salvando...' : 'Salvar endereço'}
                </button>
                <p className="text-[11px] text-gray-500">
                  O sistema valida o endereço e converte para coordenadas internamente.
                </p>
              </div>
            </>
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
                onClick={() => void saveLegacyLocation()}
                disabled={savingLocation}
                className="rounded-lg bg-sand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-sand-600 disabled:opacity-60"
              >
                {savingLocation ? 'Salvando...' : 'Salvar localização'}
              </button>
            </>
          )}

          {location ? (
            <p className="text-[11px] text-gray-500">
              Atualizado em {new Date(location.updated_at).toLocaleString('pt-BR')}
            </p>
          ) : null}
        </div>

        {mapEnabled && location ? (
          <ObraLocationMap
            lat={location.lat}
            lng={location.lng}
            title={obraNome}
            subtitle={locationSummary}
            secondaryMarker={
              hqLocation
                ? {
                    lat: hqLocation.lat,
                    lng: hqLocation.lng,
                    title: 'Sede da organização',
                    description: hqSummary,
                  }
                : null
            }
          />
        ) : (
          <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-gray-300 px-4 text-center text-xs text-gray-500 dark:border-gray-700">
            {addressUxV2
              ? 'Salve o CEP/endereço da obra para habilitar o mapa visual.'
              : 'Defina latitude/longitude para habilitar o mapa da obra.'}
          </div>
        )}
      </div>

      {weatherEnabled ? (
        <div className="space-y-3 border-t border-gray-200 pt-4 dark:border-gray-800">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Previsão da obra (7 dias)</p>
              <p className="text-xs text-gray-500">Open-Meteo com severidade operacional para chuva, vento e calor.</p>
            </div>
            {weatherPayload?.provider ? (
              <span className="text-[11px] text-gray-500">Provider: {weatherPayload.provider}</span>
            ) : null}
          </div>
          {!location ? (
            <div className="rounded-xl border border-dashed border-gray-300 px-4 py-5 text-xs text-gray-500 dark:border-gray-700">
              Defina a localização da obra para consultar previsão climática.
            </div>
          ) : loadingWeather ? (
            <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-7">
              {Array.from({ length: 7 }).map((_, idx) => (
                <div key={idx} className="skeleton h-28 rounded-xl" />
              ))}
            </div>
          ) : weatherPayload?.unavailableReason ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
              {weatherPayload.unavailableReason}
            </div>
          ) : forecastDays.length ? (
            <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-7">
              {forecastDays.map((day) => (
                <div key={day.date} className={`rounded-xl border px-3 py-3 ${severityTone(day.severity)}`}>
                  <p className="text-xs font-semibold">{new Date(`${day.date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</p>
                  <p className="mt-1 text-[11px]">{day.description}</p>
                  <p className="mt-2 text-sm font-semibold">{day.tempMax ?? '-'}°</p>
                  <p className="text-[11px] opacity-80">mín. {day.tempMin ?? '-'}°</p>
                  <p className="mt-2 text-[11px] opacity-80">Chuva {day.precipProbMax ?? '-'}%</p>
                  <p className="text-[11px] opacity-80">Vento {day.windSpeedMax ?? '-'} km/h</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 px-4 py-5 text-xs text-gray-500 dark:border-gray-700">
              Nenhum dado de previsão disponível para esta obra no momento.
            </div>
          )}
        </div>
      ) : null}

      {logisticsEnabled ? (
        <div className="space-y-3 border-t border-gray-200 pt-4 dark:border-gray-800">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Estimativa logística</p>
              <p className="text-xs text-gray-500">Tempo, distância e custo com base na sede da organização ou numa origem manual.</p>
            </div>
            {loadingHq ? <span className="text-[11px] text-gray-500">Carregando sede...</span> : null}
          </div>

          {addressLogisticsUx ? (
            <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Origem padrão</p>
                  <p className="text-xs text-gray-500">
                    {hqSummary || 'Nenhuma sede configurada. Use origem manual ou configure a sede em Configurações.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setUseOriginOverride((prev) => !prev)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900"
                >
                  {useOriginOverride ? 'Usar sede padrão' : 'Usar outra origem'}
                </button>
              </div>

              {useOriginOverride ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={originOverrideForm.cep}
                    onChange={(event) => setOriginOverrideForm((prev) => ({ ...prev, cep: event.target.value }))}
                    placeholder="CEP de origem"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  />
                  <input
                    value={originOverrideForm.numero}
                    onChange={(event) => setOriginOverrideForm((prev) => ({ ...prev, numero: event.target.value }))}
                    placeholder="Número"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  />
                  <input
                    value={originOverrideForm.logradouro}
                    onChange={(event) => setOriginOverrideForm((prev) => ({ ...prev, logradouro: event.target.value }))}
                    placeholder="Logradouro de origem"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 md:col-span-2"
                  />
                  <input
                    value={originOverrideForm.bairro}
                    onChange={(event) => setOriginOverrideForm((prev) => ({ ...prev, bairro: event.target.value }))}
                    placeholder="Bairro"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  />
                  <input
                    value={originOverrideForm.cidade}
                    onChange={(event) => setOriginOverrideForm((prev) => ({ ...prev, cidade: event.target.value }))}
                    placeholder="Cidade"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  />
                  <input
                    value={originOverrideForm.estado}
                    onChange={(event) => setOriginOverrideForm((prev) => ({ ...prev, estado: event.target.value }))}
                    placeholder="UF"
                    maxLength={2}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm uppercase text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  />
                </div>
              ) : null}
            </div>
          ) : (
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
              <div className="rounded-lg border border-dashed border-gray-300 px-3 py-2 text-[11px] text-gray-500 dark:border-gray-700">
                Fluxo legado: origem manual por latitude/longitude.
              </div>
            </div>
          )}

          <div className="grid gap-2 md:grid-cols-4">
            <input
              value={consumptionInput}
              onChange={(event) => setConsumptionInput(event.target.value)}
              placeholder="Consumo km/l"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
            <input
              value={fuelInput}
              onChange={(event) => setFuelInput(event.target.value)}
              placeholder="Preço combustível"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
            <input
              value={tollInput}
              onChange={(event) => setTollInput(event.target.value)}
              placeholder="Pedágio"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
            <button
              type="button"
              onClick={() => void estimateLogistics()}
              disabled={estimating || !location}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {estimating ? 'Calculando...' : 'Simular logística'}
            </button>
          </div>

          {!location ? (
            <div className="rounded-xl border border-dashed border-gray-300 px-4 py-5 text-xs text-gray-500 dark:border-gray-700">
              Defina a localização da obra para simular rota.
            </div>
          ) : null}

          {estimatePayload ? (
            <div className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-gray-700 space-y-1">
              <p className="font-semibold text-gray-900 dark:text-gray-100">Provider: {estimatePayload.provider}</p>
              <p className="text-gray-600 dark:text-gray-300">
                Origem: {estimatePayload.origin.formatted_address || `${estimatePayload.origin.lat}, ${estimatePayload.origin.lng}`}
              </p>
              <p className="text-gray-600 dark:text-gray-300">
                Destino: {estimatePayload.destination.formatted_address || `${estimatePayload.destination.lat}, ${estimatePayload.destination.lng}`}
              </p>
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
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
