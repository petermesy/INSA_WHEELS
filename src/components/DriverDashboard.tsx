import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import MapComponent from './MapComponent';

const API_URL = import.meta.env.VITE_API_URL;
const VEHICLE_API_URL = "/auth/organization-car/all";
const EMPLOYEE_API_URL = "/api/employees"; // Use Vite proxy

const DriverDashboard: React.FC = () => {
  const { toast } = useToast();
  const [location, setLocation] = useState<{ latitude: number; longitude: number; accuracy?: number; speed?: number; altitude?: number } | null>(null);
  const [status, setStatus] = useState("Waiting...");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(localStorage.getItem('auth_token') || "");
  const [isLoggedIn, setIsLoggedIn] = useState(!!token);
  const [userRole, setUserRole] = useState("");
  const [vehicleData, setVehicleData] = useState<any>(null);
  const [isLoadingVehicle, setIsLoadingVehicle] = useState(false);
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const [address, setAddress] = useState("Loading...");
  const [altitude, setAltitude] = useState<number | null>(null);
  const [assignedEmployees, setAssignedEmployees] = useState<any[]>([]);

  // Fetch user info from localStorage
  useEffect(() => {
    const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
    setUsername(userInfo.email || "");
    setUserRole(userInfo.role || "");
  }, []);

  // Fetch assigned employees for a vehicle using the external API
  const fetchAssignedEmployees = async (vehicleId: number) => {
    try {
      const res = await axios.get(EMPLOYEE_API_URL);
      const employees = res.data.filter(
        (emp: any) => Number(emp.assignedCarId) === Number(vehicleId)
      );
      setAssignedEmployees(employees);
    } catch {
      setAssignedEmployees([]);
    }
  };

  // Fetch vehicle info from external API
  const fetchVehicleData = async () => {
    setIsLoadingVehicle(true);
    try {
      const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
      const res = await axios.get(VEHICLE_API_URL);
      // Find the vehicle assigned to this driver (by driver name or email)
      const vehicle = res.data.organizationCarList.find(
        (v: any) =>
          v.driverName?.toLowerCase() === userInfo.name?.toLowerCase() ||
          v.driverName?.toLowerCase() === userInfo.email?.toLowerCase()
      );
      setVehicleData(vehicle || null);
      if (vehicle && vehicle.id) {
        fetchAssignedEmployees(vehicle.id);
      } else {
        setAssignedEmployees([]);
      }
      if (!vehicle) {
        toast({
          title: "No Vehicle Assigned",
          description: "You are not assigned to any vehicle.",
          variant: "warning",
        });
      }
    } catch (error) {
      setVehicleData(null);
      setAssignedEmployees([]);
      toast({
        title: "Error",
        description: "Failed to fetch vehicle information.",
        variant: "destructive",
      });
    }
    setIsLoadingVehicle(false);
  };

  // Get and send location
  const getAndSendLocation = () => {
    if (!navigator.geolocation) {
      setStatus("Geolocation not supported by your browser.");
      setIsUpdatingLocation(false);
      return;
    }
    setIsUpdatingLocation(true);
    setStatus("Requesting location...");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, altitude, accuracy, speed } = pos.coords;
        setLocation({ latitude, longitude, altitude, accuracy, speed });
        setAltitude(altitude ?? null);

        // Optionally, reverse geocode for address
        try {
          const geoRes = await axios.get(
            `https://nominatim.openstreetmap.org/reverse`,
            {
              params: {
                lat: latitude,
                lon: longitude,
                format: "json",
              },
            }
          );
          setAddress(geoRes.data.display_name || "Unknown location");
        } catch {
          setAddress("Unknown location");
        }

        // Send location to backend
        try {
          await axios.post(
            `${API_URL}/locations/car-location`,
            {
              location: [latitude, longitude],
              accuracy,
              speed,
              altitude,
            },
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          setStatus("Location sent to employees!");
          toast({
            title: "Location Sent",
            description: `Location sent: (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`,
          });
          fetchVehicleData(); // Optionally refresh vehicle data
        } catch (e: any) {
          setStatus(
            e.response?.data?.error
              ? `Failed to send location: ${e.response.data.error}`
              : `Failed to send location: ${e.message}`
          );
          toast({
            title: "Send Failed",
            description: e.response?.data?.error || e.message,
            variant: "destructive",
          });
        }
        setIsUpdatingLocation(false);
      },
      (err) => {
        setStatus("Permission denied or error getting location.");
        setIsUpdatingLocation(false);
        toast({
          title: "Location Error",
          description: "Could not get your current location: " + err.message,
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Fetch vehicle and assigned employees on login
  useEffect(() => {
    if (isLoggedIn && userRole === "driver") {
      fetchVehicleData();
      getAndSendLocation();
      const interval = setInterval(getAndSendLocation, 30000); // Update every 30 seconds
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line
  }, [isLoggedIn, token, userRole]);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-2xl">Driver Dashboard</CardTitle>
            <CardDescription>
              Share your location with assigned employees
            </CardDescription>
          </div>
          <Button onClick={getAndSendLocation} disabled={isUpdatingLocation}>
            {isUpdatingLocation ? "Updating..." : "Update Location"}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg overflow-hidden border mb-6" style={{ height: 400 }}>
            {location && (
              <MapComponent
                vehicles={vehicleData ? [vehicleData] : []}
                driverLocation={location}
              />
            )}
          </div>
          {isLoadingVehicle ? (
            <Card className="mt-4">
              <CardContent className="p-4">
                <p>Loading vehicle information...</p>
              </CardContent>
            </Card>
          ) : !vehicleData ? (
            <Card className="mt-4">
              <CardContent className="p-4">
                <p className="text-amber-500">You are not assigned to any vehicle yet.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="mt-4">
              <CardContent className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Vehicle Type</h3>
                    <p className="font-medium">{vehicleData.carType}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">License Plate</h3>
                    <p className="font-medium">{vehicleData.plateNumber}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Owner</h3>
                    <p className="font-medium">{vehicleData.ownerName}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Assigned Employees</h3>
                    <ul>
                      {assignedEmployees.length > 0 ? assignedEmployees.map((emp) => (
                        <li key={emp.employeeId}>{emp.name} ({emp.email})</li>
                      )) : <li>No employees assigned</li>}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DriverDashboard;