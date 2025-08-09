import React from 'react';
import axios from 'axios';
import MapComponent from '../MapComponent';
import AdminVehiclesList from './AdminVehiclesList';

const API_URL = import.meta.env.VITE_API_URL;

interface VehiclesTabProps {
  vehicles: any[];
  users: any[];
  isLoadingVehicles: boolean;
  isLoadingUsers: boolean;
  vehiclesError: unknown;
  refetchVehicles: () => void;
}

const VehiclesTab: React.FC<VehiclesTabProps> = ({ 
  vehicles, 
  users, 
  isLoadingVehicles, 
  isLoadingUsers, 
  vehiclesError, 
  refetchVehicles 
}) => {
  const [vehicleLocations, setVehicleLocations] = React.useState<any[]>([]);
  const [loadingLocations, setLoadingLocations] = React.useState(false);
  const [locationsError, setLocationsError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchLocations = async () => {
      setLoadingLocations(true);
      setLocationsError(null);
      try {
        // Adjust endpoint as needed to match your backend route for all latest vehicle locations
        const token = localStorage.getItem('auth_token');
        const res = await axios.get(`${API_URL}/locations/all-latest`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setVehicleLocations(res.data || []);
      } catch (err: any) {
        setLocationsError('Failed to fetch vehicle locations');
      }
      setLoadingLocations(false);
    };
    fetchLocations();
    const interval = setInterval(fetchLocations, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [API_URL]);

  return isLoadingVehicles || isLoadingUsers ? (
    <p className="text-center py-4">Loading vehicles...</p>
  ) : vehiclesError ? (
    <p className="text-center py-4 text-destructive">Error loading vehicles</p>
  ) : (
    <>
      {/* Map showing all vehicle locations for admin */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">All Vehicle Locations (Live)</h3>
        <div style={{ height: 400 }}>
          {loadingLocations ? (
            <p>Loading locations...</p>
          ) : locationsError ? (
            <p className="text-destructive">{locationsError}</p>
          ) : (
            <MapComponent
              vehicles={vehicleLocations.map(v => ({
                id: v.vehicleId || v.id,
                driverId: v.driverId || v.driver_id,
                driverName: v.driverName || v.driver_name || "",
                location: {
                  latitude: v.location?.[0] || v.latitude,
                  longitude: v.location?.[1] || v.longitude,
                },
                assignedEmployees: v.assignedEmployees || [],
              }))}
            />
          )}
        </div>
      </div>
      <AdminVehiclesList 
        vehicles={vehicles}
        drivers={users}
        refetchVehicles={refetchVehicles}
      />
    </>
  );
};

export default VehiclesTab;
