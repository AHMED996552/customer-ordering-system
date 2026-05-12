import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import ReactDOMServer from 'react-dom/server';
import { MapPin } from "lucide-react";


const iconHtml = ReactDOMServer.renderToString(
  <MapPin
    size={40}
    color="red"
    style={{
      transform: "translate(-25%, -75%)",
    }}
  />
);

// Custom marker icon
const customIcon = new L.DivIcon({
  html: iconHtml,
  className: "bg-transparent border-0 text-primary",
  iconSize: [40, 40],
  iconAnchor: [20, 40],
});

const LocationPicker: React.FC<{ onPositionChange: (pos: [number, number]) => void }> = ({ onPositionChange }) => {
  useMapEvents({
    click(e) {
      onPositionChange([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
};

// Component to handle map re-centering
const ViewUpdater: React.FC<{ center: [number, number] }> = ({ center }) => {
  const map = useMap();
  map.setView(center, map.getZoom());
  return null;
};

const DeliverySection: React.FC = () => {
  const [position, setPosition] = useState<[number, number]>([25.1873919, 55.2031154]); // Dubai default
  const [isConfirmed, setIsConfirmed] = useState(false);

  const handleReset = () => {
    setIsConfirmed(false);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPosition([pos.coords.latitude, pos.coords.longitude]);
        },
        (err) => {
          console.error("Geolocation error:", err);
          alert("Could not get your location. Please check your browser permissions.");
        }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  const handleConfirm = () => {
    setIsConfirmed(true);
    // In a real app, this might save to a context or parent state
  };

  return (
    <div className="glass-card p-lg rounded-xl space-y-md shadow-2xl mb-lg border border-primary/10">
      <div className="flex justify-between items-center">
        <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">
          Delivery Destination
        </h3>
        <button 
          onClick={handleReset}
          className="text-primary font-label-caps text-xs hover:underline uppercase tracking-wider transition-all"
        >
          Use Current Location
        </button>
      </div>
      <div className="relative w-full h-64 rounded-lg overflow-hidden border border-outline-variant/30 z-0">
        <MapContainer 
          center={position} 
          zoom={13} 
          scrollWheelZoom={false}
          className="w-full h-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={position} icon={customIcon} />
          <LocationPicker onPositionChange={(pos) => {
            setPosition(pos);
            setIsConfirmed(false);
          }} />
          <ViewUpdater center={position} />
        </MapContainer>
      </div>
      <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center gap-md pt-2">
        <div className="space-y-xs">
          <p className="font-headline-md text-body-lg text-on-surface">Set Precise Destination</p>
          <p className="font-body-md text-on-surface-variant text-sm">
            Lat: {position[0].toFixed(4)}, Lng: {position[1].toFixed(4)}
          </p>
        </div>
        <button
          onClick={handleConfirm}
          className={`px-lg py-sm rounded-full font-label-caps text-xs uppercase tracking-widest transition-all duration-300 flex items-center gap-xs ${
            isConfirmed 
            ? "bg-secondary text-on-secondary shadow-lg scale-105" 
            : "bg-primary text-on-primary hover:bg-primary/90 shadow-md"
          }`}
        >
          {isConfirmed ? (
            <>
              <span className="material-symbols-outlined text-sm">check_circle</span>
              Location Confirmed
            </>
          ) : (
            "Confirm Location"
          )}
        </button>
      </div>
      {!isConfirmed && (
        <p className="font-body-md text-on-surface-variant text-xs italic opacity-70">
          Click the map or use your current location, then confirm to proceed.
        </p>
      )}
    </div>
  );
};

export default DeliverySection;
