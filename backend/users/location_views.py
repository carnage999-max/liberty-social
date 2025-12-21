"""
Location tracking and geolocation views.
Handles both GPS-based and IP-based location detection.
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
import logging

logger = logging.getLogger(__name__)


def get_client_ip(request):
    """
    Extract client IP from request, handling proxies.
    """
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def get_location_from_ip(ip_address):
    """
    Get country, state, city from IP address.
    
    Tries multiple methods:
    1. Django's built-in GeoIP2 (requires MaxMind database)
    2. Falls back to simple lookup via ip-api.com (free)
    3. Returns None if all fail
    """
    # Try method 1: Django GeoIP2
    try:
        from django.contrib.gis.geoip2 import GeoIP2
        g = GeoIP2()
        location_data = g.city(ip_address)
        
        return {
            'country': location_data.get('country_name'),
            'state': location_data.get('region'),  # State/Province
            'city': location_data.get('city'),
        }
    except Exception as e:
        logger.debug(f"GeoIP2 lookup failed for {ip_address}: {str(e)}")
    
    # Try method 2: ip-api.com (free, public API)
    try:
        import requests
        
        response = requests.get(
            f'http://ip-api.com/json/{ip_address}',
            timeout=2,
            params={'fields': 'country,regionName,city,status,message'}
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'success':
                return {
                    'country': data.get('country'),
                    'state': data.get('regionName'),
                    'city': data.get('city'),
                }
        
        logger.debug(f"ip-api lookup failed: {data.get('message')}")
    except Exception as e:
        logger.debug(f"ip-api lookup failed for {ip_address}: {str(e)}")
    
    return None


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_user_location(request):
    """
    Update user's location data.
    
    Accepts GPS coordinates (optional) and falls back to IP geolocation.
    
    Request body:
    {
        "latitude": float (optional),
        "longitude": float (optional),
        "accuracy": float (optional),  # GPS accuracy in meters
        "age": int (optional),         # Allow updating age too if provided
    }
    
    Returns:
    {
        "success": true,
        "source": "gps" | "ip",
        "location": {
            "country": str,
            "state": str,
            "city": str,
            "latitude": float (if GPS),
            "longitude": float (if GPS),
            "accuracy": float (if GPS),
        },
        "updated_fields": [list of fields that were updated]
    }
    """
    user = request.user
    updated_fields = []
    location_source = None
    location_data = {}
    
    # Get GPS data if provided
    latitude = request.data.get('latitude')
    longitude = request.data.get('longitude')
    accuracy = request.data.get('accuracy')
    
    if latitude is not None and longitude is not None:
        # Use GPS data directly - trust the client
        location_source = 'gps'
        
        # You could optionally reverse-geocode GPS coordinates here
        # For now, we'll just accept them without country/state/city
        # In a full implementation, you'd use a reverse geocoding service
        # (Google Maps API, Nominatim, etc.)
        
        logger.info(f"User {user.id} updating location from GPS: ({latitude}, {longitude})")
        location_data = {
            'latitude': latitude,
            'longitude': longitude,
            'accuracy': accuracy,
        }
    
    if not location_source:
        # Fallback to IP-based geolocation
        try:
            client_ip = get_client_ip(request)
            ip_location = get_location_from_ip(client_ip)
            
            if ip_location:
                location_source = 'ip'
                location_data.update(ip_location)
                logger.info(f"User {user.id} location detected from IP {client_ip}: {ip_location}")
            else:
                logger.warning(f"Could not determine location for user {user.id} from IP {client_ip}")
                return Response(
                    {
                        'success': False,
                        'error': 'Could not determine location from GPS or IP',
                        'source': None,
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            logger.error(f"Error getting location for user {user.id}: {str(e)}")
            return Response(
                {
                    'success': False,
                    'error': 'Error processing location data',
                    'source': None,
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    # Update user model with location data
    try:
        if 'country' in location_data and location_data['country']:
            user.country = location_data['country']
            updated_fields.append('country')
        
        if 'state' in location_data and location_data['state']:
            user.state = location_data['state']
            updated_fields.append('state')
        
        if 'city' in location_data and location_data['city']:
            user.city = location_data['city']
            updated_fields.append('city')
        
        # Optionally update age if provided
        age = request.data.get('age')
        if age is not None:
            user.age = age
            updated_fields.append('age')
        
        user.save()
        
        return Response({
            'success': True,
            'source': location_source,
            'location': location_data,
            'updated_fields': updated_fields,
            'message': f"Location updated from {location_source.upper()} source"
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"Error saving location for user {user.id}: {str(e)}")
        return Response(
            {
                'success': False,
                'error': 'Error saving location data',
                'source': location_source,
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_location(request):
    """
    Get current user's location data.
    """
    user = request.user
    
    return Response({
        'user_id': str(user.id),
        'country': user.country,
        'state': user.state,
        'city': user.city,
        'age': user.age,
    }, status=status.HTTP_200_OK)
