
import React, { useState, useEffect } from "react";
import axios from "axios";
import { io, Socket } from "socket.io-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import MapComponent from "./MapComponent";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const API_URL = import.meta.env.VITE_API_URL;
const EMPLOYEE_API_URL = "/api/employees";

const EmployeeDashboard: React.FC = () => {
  const { toast } = useToast();
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [driverLocation, setDriverLocation] = useState<any>(null);
  const [driverAddress, setDriverAddress] = useState<string>("Loading...");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [employeeInfo, setEmployeeInfo] = useState<any>(null);

  const userInfo = JSON.parse(localStorage.getItem("user_info") || "{}");

  // Fetch employee info from external API
  // useEffect(() => {
  //   const fetchEmployeeInfo = async () => {
  //     try {
  //       const res = await axios.get(EMPLOYEE_API_URL);
  //       // Find the employee by email or id (adjust as needed)
  //       const employee = res.data.find(
  //         (emp: any) =>
  //           emp.email === userInfo.email ||
  //           emp.employeeId === userInfo.employeeId ||
  //           emp.employeeId === userInfo.id
  //       );
  //       setEmployeeInfo(employee);
  //     } catch (error) {
  //       toast({
  //         title: "Error",
  //         description: "Failed to fetch employee info.",
  //         variant: "destructive",
  //       });
  //     }
  //   };
  //   fetchEmployeeInfo();
  //   // eslint-disable-next-line
  // }, []);



useEffect(() => {
  const fetchEmployeeInfo = async () => {
    try {
      const res = await axios.get(EMPLOYEE_API_URL);
      // Debug: log all emails and userInfo
      const apiEmails = res.data.map((emp: any) => emp.email?.trim().toLowerCase());
      const userEmail = userInfo.email?.trim().toLowerCase();
      console.log('userInfo.email:', userEmail);
      console.log('API emails:', apiEmails);
      // Only match by email (case-insensitive, trimmed)
      const employee = res.data.find(
        (emp: any) => emp.email?.trim().toLowerCase() === userEmail
      );
      if (!employee) {
        toast({
          title: "Not Found",
          description: `No employee found for your account (${userEmail}).`,
          variant: "destructive",
        });
      }
      setEmployeeInfo(employee);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch employee info.",
        variant: "destructive",
      });
    }
  };
  fetchEmployeeInfo();
  // eslint-disable-next-line
}, []);
  // Real-time driver location via Socket.IO
  useEffect(() => {
    if (!employeeInfo) return;
    const newSocket = io(API_URL.replace("/api", ""), {
      transports: ["websocket"],
      upgrade: false,
    });
    setSocket(newSocket);

    // Join room based on employeeId (use employeeInfo.employeeId)
    newSocket.emit("joinRoom", `employee_${employeeInfo.employeeId}`);

    newSocket.on("carLocationUpdate", async (locationData) => {
      setDriverLocation(locationData);
      if (
        locationData &&
        Array.isArray(locationData.location) &&
        locationData.location.length === 2
      ) {
        const [lat, lon] = locationData.location;
        const address = await getAddressFromLatLng(lat, lon);
        setDriverAddress(address);
      } else {
        setDriverAddress("Unknown location");
      }
    });

    return () => {
      newSocket.off("carLocationUpdate");
      newSocket.emit("leaveRoom", `employee_${employeeInfo.employeeId}`);
      newSocket.disconnect();
    };
    // eslint-disable-next-line
  }, [employeeInfo]);

  // Geolocation logic (unchanged)
  const requestLocation = () => {
    setIsLocating(true);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation({ latitude, longitude });
          setIsLocating(false);
        },
        (error) => {
          toast({
            title: "Location Error",
            description: "Could not get your current location.",
            variant: "destructive",
          });
          setIsLocating(false);
          simulateLocation();
        }
      );
    } else {
      toast({
        title: "Geolocation Not Supported",
        description: "Your browser does not support geolocation.",
        variant: "destructive",
      });
      simulateLocation();
    }
  };

  const simulateLocation = () => {
    const latitude = 9.0155 + (Math.random() * 0.01 - 0.005);
    const longitude = 38.7632 + (Math.random() * 0.01 - 0.005);
    setCurrentLocation({ latitude, longitude });
  };

  // Reverse geocode function
  const getAddressFromLatLng = async (lat: number, lon: number) => {
    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/reverse`,
        {
          params: {
            lat,
            lon,
            format: "json",
          },
        }
      );
      return response.data.display_name;
    } catch (error) {
      return "Unknown location";
    }
  };

  // Request initial location when component mounts
  useEffect(() => {
    requestLocation();
    const intervalId = setInterval(() => {
      requestLocation();
    }, 60000);
    return () => clearInterval(intervalId);
    // eslint-disable-next-line
  }, []);



    // Haversine formula to calculate distance in km
  function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (x: number) => (x * Math.PI) / 180;
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Calculate distance and ETA
  const distanceToDriver =
    currentLocation && driverLocation && Array.isArray(driverLocation.location)
      ? haversineDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          driverLocation.location[0],
          driverLocation.location[1]
        )
      : null;

  const estimatedTimeToReach =
    distanceToDriver !== null &&
    driverLocation &&
    driverLocation.speed !== null &&
    driverLocation.speed !== undefined &&
    driverLocation.speed > 0
      ? (distanceToDriver / (driverLocation.speed * 3.6)) * 60 // speed is in m/s, convert to km/h
      : null;

      
  return (
    <div className="container mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Employee Dashboard</CardTitle>
              <CardDescription>
                Track your assigned transportation service
              </CardDescription>
            </div>
            <div className="mt-4 md:mt-0">
              <Button onClick={requestLocation} disabled={isLocating}>
                {isLocating ? "Updating Location..." : "Update My Location"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {employeeInfo ? (
            <div className="mb-4">
              <div className="mb-2">
                <strong>Name:</strong> {employeeInfo.name}
              </div>
              <div className="mb-2">
                <strong>Email:</strong> {employeeInfo.email}
              </div>
              <div className="mb-2">
                <strong>Department:</strong> {employeeInfo.department}
              </div>
              <div className="mb-2">
                <strong>Village:</strong> {employeeInfo.village}
              </div>
              <div className="mb-2">
                <strong>Assigned Vehicle Plate:</strong> {employeeInfo.assignedCarPlateNumber}
              </div>
              <div className="mb-2">
                <strong>Assigned Vehicle ID:</strong> {employeeInfo.assignedCarId}
              </div>
            </div>
          ) : (
            <div>Loading employee info...</div>
          )}
          <div className="h-[500px] w-full">
            <MapComponent
              vehicles={
                employeeInfo
                  ? [
                      {
                        id: employeeInfo.assignedCarId,
                        driverId: null,
                        driverName: "",
                        location: driverLocation
                          ? {
                              latitude: driverLocation.location?.[0] || 0,
                              longitude: driverLocation.location?.[1] || 0,
                              speed: driverLocation.speed,
                              timestamp: driverLocation.timestamp,
                            }
                          : { latitude: 0, longitude: 0 },
                        assignedEmployees: [employeeInfo.employeeId],
                      },
                    ]
                  : []
              }
              employeeLocation={currentLocation || undefined}
              employeeId={employeeInfo?.employeeId}
              driverLocation={
                driverLocation && Array.isArray(driverLocation.location)
                  ? {
                      latitude: driverLocation.location[0],
                      longitude: driverLocation.location[1],
                    }
                  : undefined
              }
              // Pass a key to force re-render when locations change
              key={
                (currentLocation ? `${currentLocation.latitude},${currentLocation.longitude}` : "") +
                (driverLocation && Array.isArray(driverLocation.location)
                  ? `_${driverLocation.location[0]},${driverLocation.location[1]}`
                  : "")
              }
            />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Assigned Driver Location (Real-Time)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {driverLocation ? (
            <div className="bg-gray-100 p-4 rounded shadow">
              <div>
                <strong>Driver Location:</strong>{" "}
                {driverLocation.location
                  ? `${driverLocation.location[0]}, ${driverLocation.location[1]}`
                  : "Unknown"}
              </div>
              <div>
                <strong>Address:</strong> {driverAddress}
              </div>
              <div>
                <strong>Speed:</strong> {driverLocation.speed || "N/A"} m/s
              </div>
              <div>
                <strong>Estimated Arrival Time:</strong>{" "}
                {estimatedTimeToReach !== null
                  ? estimatedTimeToReach < 1
                    ? '< 1 min'
                    : `${estimatedTimeToReach.toFixed(1)} min`
                  : 'N/A'}
              </div>
              <div>
                <strong>Last Update:</strong>{" "}
                {driverLocation.timestamp
                  ? new Date(driverLocation.timestamp).toLocaleTimeString()
                  : "N/A"}
              </div>
            </div>
          ) : (
            <div className="text-gray-500">Waiting for driver location...</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeDashboard;