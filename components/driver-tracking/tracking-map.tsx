"use client";

import { divIcon } from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";

export interface MapPoint { latitude: number; longitude: number; recordedAt?: string; }
export interface TrackingMapMarker extends MapPoint { id: string; label: string; }

const markerIcon = divIcon({ className: "", html: '<span style="display:block;width:16px;height:16px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 1px 4px #334155"></span>', iconSize: [16, 16], iconAnchor: [8, 8] });

export function TrackingMap({ markers = [], route = [] }: { markers?: TrackingMapMarker[]; route?: MapPoint[] }) {
  const center: [number, number] = markers[0]
    ? [markers[0].latitude, markers[0].longitude]
    : route[0] ? [route[0].latitude, route[0].longitude] : [29.3759, 47.9774];
  const path = route.map((point) => [point.latitude, point.longitude] as [number, number]);

  return <MapContainer center={center} zoom={markers.length || route.length ? 13 : 8} className="h-[360px] w-full rounded-lg" scrollWheelZoom={false}>
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    {path.length > 1 && <Polyline positions={path} pathOptions={{ color: "#2563eb", weight: 4 }} />}
    {markers.map((marker) => <Marker key={marker.id} position={[marker.latitude, marker.longitude]} icon={markerIcon}><Popup>{marker.label}{marker.recordedAt ? <><br />{new Date(marker.recordedAt).toLocaleString()}</> : null}</Popup></Marker>)}
  </MapContainer>;
}
