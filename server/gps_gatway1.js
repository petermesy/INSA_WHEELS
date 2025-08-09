// Save as gps_gateway.js
const  fetch =require('node-fetch');

const BACKEND_URL = "http://localhost:4000/api/locations/device-car-location";
const DEVICE_TOKEN = "jps_token";

let lat = 9.0155, lng = 38.7632;
let prev_lat = lat, prev_lng = lng;
const interval = 10; // seconds

function haversine(lat1, lon1, lat2, lon2) {
    const toRad = deg => deg * Math.PI / 180;
    const R = 6371.0; // Earth radius in km
    const dlat = toRad(lat2 - lat1);
    const dlon = toRad(lon2 - lon1);
    const a = Math.sin(dlat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dlon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

setInterval(async () => {
    lat += 0.0001;
    lng += 0.0001;
    const distance = haversine(prev_lat, prev_lng, lat, lng); // in km
    const speed = distance / (interval / 3600); // km/h
    prev_lat = lat;
    prev_lng = lng;

    const payload = {
        vehicleId: 2,
        location: [lat, lng],
        speed: speed,
        deviceToken: DEVICE_TOKEN
    };

    try {
        const response = await fetch(BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const text = await response.text();
        console.log(`Status: ${response.status} Response: ${text}, Speed: ${speed.toFixed(2)} km/h`);
    } catch (err) {
        console.error('Error:', err);
    }
}, interval * 1000);