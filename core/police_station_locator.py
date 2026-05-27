import math

# Default police stations matching the frontend seeding list
POLICE_STATIONS = [
    { "id": "station_central", "name": "City Central Police HQ", "phone": "+1 555-0199", "latitude": 12.93, "longitude": 77.55, "jurisdiction": "Sector 1 & 2" },
    { "id": "station_north", "name": "North Side Precinct", "phone": "+1 555-0144", "latitude": 12.97, "longitude": 77.58, "jurisdiction": "Sector 3" },
    { "id": "station_south", "name": "South Sector Station", "phone": "+1 555-0177", "latitude": 12.91, "longitude": 77.51, "jurisdiction": "Sector 4" }
]

def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Calculate the great circle distance between two points 
    on the earth (specified in decimal degrees)
    """
    # Convert decimal degrees to radians 
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])

    # Haversine formula 
    dlon = lon2 - lon1 
    dlat = lat2 - lat1 
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a)) 
    r = 6371 # Radius of earth in kilometers. Use 3956 for miles
    return c * r

def find_nearest_station(incident_lat, incident_lon, custom_stations=None):
    """
    Given an incident's latitude and longitude, finds the closest police station.
    """
    stations = custom_stations or POLICE_STATIONS
    if not stations:
        return None

    nearest_station = None
    min_distance = float('inf')

    for station in stations:
        dist = haversine_distance(incident_lat, incident_lon, station["latitude"], station["longitude"])
        if dist < min_distance:
            min_distance = dist
            nearest_station = {
                "name": station["name"],
                "phone": station["phone"],
                "distance_km": round(dist, 2),
                "latitude": station["latitude"],
                "longitude": station["longitude"]
            }

    return nearest_station
