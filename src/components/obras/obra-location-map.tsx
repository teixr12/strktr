'use client'

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MapContainer, Marker, Popup, Polyline, TileLayer } from 'react-leaflet'

const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png'
const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png'
const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'

let markerConfigured = false
if (!markerConfigured) {
  L.Icon.Default.mergeOptions({
    iconRetinaUrl,
    iconUrl,
    shadowUrl,
  })
  markerConfigured = true
}

interface ObraLocationMapMarker {
  lat: number
  lng: number
  title: string
  description?: string | null
}

interface ObraLocationMapProps {
  lat: number
  lng: number
  title: string
  subtitle?: string | null
  secondaryMarker?: ObraLocationMapMarker | null
  routeLine?: Array<[number, number]>
}

export function ObraLocationMap({
  lat,
  lng,
  title,
  subtitle,
  secondaryMarker,
  routeLine,
}: ObraLocationMapProps) {
  return (
    <div className="h-64 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
      <MapContainer center={[lat, lng]} zoom={14} className="h-full w-full" scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]}>
          <Popup>
            <div className="space-y-1">
              <p className="text-sm font-semibold">{title}</p>
              {subtitle ? <p className="text-xs text-gray-600">{subtitle}</p> : null}
            </div>
          </Popup>
        </Marker>
        {secondaryMarker ? (
          <Marker position={[secondaryMarker.lat, secondaryMarker.lng]}>
            <Popup>
              <div className="space-y-1">
                <p className="text-sm font-semibold">{secondaryMarker.title}</p>
                {secondaryMarker.description ? (
                  <p className="text-xs text-gray-600">{secondaryMarker.description}</p>
                ) : null}
              </div>
            </Popup>
          </Marker>
        ) : null}
        {routeLine && routeLine.length > 1 ? (
          <Polyline positions={routeLine} pathOptions={{ color: '#0f766e', weight: 4, opacity: 0.75 }} />
        ) : null}
      </MapContainer>
    </div>
  )
}
