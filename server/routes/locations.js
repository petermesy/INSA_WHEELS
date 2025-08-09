const express = require('express');
const router = express.Router();
const axios = require('axios');
const { validateToken } = require('../middleware/auth');
const db = require('../config/db');

// Helper: check if current time is within allowed interval (e.g., 12:00–24:00)
function isWithinAllowedTime() {
  const now = new Date();
  const hour = now.getHours();
  // Allow between 12:00 (inclusive) and 24:00 (exclusive)
  return hour >= 1 && hour < 24;
}

// In-memory store for latest locations (for demo; use DB in production)
const latestVehicleLocations = {};

// Device endpoint (NO auth middleware here)
router.post('/device-car-location', async (req, res) => {
  const { vehicleId, location, accuracy, speed, altitude, deviceToken } = req.body;
  const io = req.app.get('io');
  try {
    if (deviceToken !== process.env.GPS_DEVICE_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized device' });
    }
    if (!vehicleId || !location) {
      return res.status(400).json({ error: 'vehicleId and location are required' });
    }

    // Update vehicle location in DB
    await db.query(
      `UPDATE vehicles SET location_latitude = $1, location_longitude = $2, location_accuracy = $3, location_speed = $4, location_altitude = $5, location_timestamp = NOW() WHERE id = $6`,
      [location[0], location[1], accuracy, speed, altitude, vehicleId]
    );

    // Store latest location in memory (for admin map)
    latestVehicleLocations[vehicleId] = {
      vehicleId,
      location,
      accuracy,
      speed,
      altitude,
      timestamp: new Date()
    };

    // Fetch assigned employees from external API
    let assignedEmployeeIds = [];
    try {
      const empRes = await axios.get('http://172.20.137.176:8080/api/employees');
      assignedEmployeeIds = empRes.data
        .filter(emp => Number(emp.assignedCarId) === Number(vehicleId))
        .map(emp => emp.employeeId); // Use employeeId as string, e.g. "EMP001"
    } catch (err) {
      console.error('Error fetching assigned employees from external API:', err.message);
    }

    const locationData = {
      driverId: null,
      vehicleId,
      location,
      altitude,
      accuracy,
      speed,
      timestamp: new Date()
    };

    // Only emit to employees during allowed time interval
    if (isWithinAllowedTime() && assignedEmployeeIds.length > 0) {
      for (const employeeId of assignedEmployeeIds) {
        io.to(`employee_${employeeId}`).emit('carLocationUpdate', locationData);
      }
    }
    // Always emit to all admins
    io.to('admin').emit('adminCarLocationUpdate', locationData);

    console.log('Device location update received and sent:', locationData);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating device location:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Apply auth middleware to all routes below
router.use(validateToken);

// Location update endpoint for drivers (JWT)
router.post('/car-location', async (req, res) => {
  try {
    // Get driverId from JWT token (req.user)
    const driverId = req.user.userId || req.user.id;
    const { location, altitude, accuracy, speed } = req.body;
    const io = req.app.get('io');

    if (!driverId || !location) {
      return res.status(400).json({ error: 'Driver ID and location are required' });
    }

    // Find the vehicle for this driver
    const vehicleRes = await db.query(
      `SELECT id FROM vehicles WHERE driver_id = $1`,
      [driverId]
    );
    const vehicle = vehicleRes.rows[0];

    // Update vehicle location in DB
    if (vehicle) {
      await db.query(
        `UPDATE vehicles SET location_latitude = $1, location_longitude = $2, location_accuracy = $3, location_speed = $4, location_altitude = $5, location_timestamp = NOW() WHERE id = $6`,
        [location[0], location[1], accuracy, speed, altitude, vehicle.id]
      );
    }

    // Fetch assigned employees from external API
    let assignedEmployeeIds = [];
    if (vehicle) {
      try {
        const empRes = await axios.get('http://172.20.137.176:8080/api/employees');
        assignedEmployeeIds = empRes.data
          .filter(emp => Number(emp.assignedCarId) === Number(vehicle.id))
          .map(emp => emp.employeeId); // Use employeeId as string, e.g. "EMP001"
      } catch (err) {
        console.error('Error fetching assigned employees from external API:', err.message);
      }
    }

    const locationData = {
      driverId,
      vehicleId: vehicle ? vehicle.id : null,
      location,
      altitude,
      accuracy,
      speed,
      timestamp: new Date()
    };

    // Only emit to employees during allowed time interval
    if (isWithinAllowedTime() && assignedEmployeeIds.length > 0) {
      for (const employeeId of assignedEmployeeIds) {
        io.to(`employee_${employeeId}`).emit('carLocationUpdate', locationData);
      }
    }
    // Always emit to all admins
    io.to('admin').emit('adminCarLocationUpdate', locationData);

    console.log('Driver location update received and sent:', locationData);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Endpoint for admin to get all latest vehicle locations
router.get('/all-latest', (req, res) => {
  // Return as array
  res.json(Object.values(latestVehicleLocations));
});

module.exports = router;