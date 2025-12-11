"""
Utility functions for device and location tracking.
"""

import logging
from typing import Optional, Tuple

logger = logging.getLogger(__name__)


def get_client_ip(request) -> Optional[str]:
    """Extract client IP address from request."""
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        # X-Forwarded-For can contain multiple IPs, take the first one
        ip = x_forwarded_for.split(",")[0].strip()
    else:
        ip = request.META.get("REMOTE_ADDR")
    return ip


def get_user_agent(request) -> Optional[str]:
    """Extract user agent from request."""
    return request.META.get("HTTP_USER_AGENT")


def get_location_from_ip(ip_address: Optional[str]) -> Optional[str]:
    """
    Get approximate location from IP address.
    
    For now, returns a simple format. In production, you might want to use:
    - GeoIP2 (MaxMind)
    - ipapi.co API
    - ip-api.com API
    - Or another geolocation service
    
    Returns format: "City, Country" or None
    """
    if not ip_address:
        return None

    # Skip private/local IPs
    if ip_address.startswith(("127.", "192.168.", "10.", "172.")):
        return "Local Network"

    # For MVP, we'll return a placeholder
    # In production, integrate with a geolocation service
    try:
        # Example: You could use ipapi.co or similar
        # import requests
        # response = requests.get(f"https://ipapi.co/{ip_address}/json/", timeout=2)
        # if response.status_code == 200:
        #     data = response.json()
        #     city = data.get("city", "")
        #     country = data.get("country_name", "")
        #     return f"{city}, {country}" if city else country
        pass
    except Exception as e:
        logger.warning(f"Failed to get location for IP {ip_address}: {e}")

    # Return None for now - can be enhanced later
    return None


def extract_device_info(user_agent: Optional[str]) -> dict:
    """
    Extract device information from user agent string.
    
    Returns a dict with platform, browser, etc.
    """
    if not user_agent:
        return {}

    info = {
        "user_agent": user_agent,
        "platform": "Unknown",
        "browser": "Unknown",
    }

    try:
        ua_lower = user_agent.lower()

        # Detect platform
        if "iphone" in ua_lower or "ipad" in ua_lower:
            info["platform"] = "iOS"
        elif "android" in ua_lower:
            info["platform"] = "Android"
        elif "mac" in ua_lower:
            info["platform"] = "macOS"
        elif "windows" in ua_lower:
            info["platform"] = "Windows"
        elif "linux" in ua_lower:
            info["platform"] = "Linux"

        # Detect browser
        if "chrome" in ua_lower and "edg" not in ua_lower:
            info["browser"] = "Chrome"
        elif "firefox" in ua_lower:
            info["browser"] = "Firefox"
        elif "safari" in ua_lower and "chrome" not in ua_lower:
            info["browser"] = "Safari"
        elif "edg" in ua_lower:
            info["browser"] = "Edge"
        elif "opera" in ua_lower:
            info["browser"] = "Opera"

    except Exception as e:
        logger.warning(f"Failed to parse user agent: {e}")

    return info

