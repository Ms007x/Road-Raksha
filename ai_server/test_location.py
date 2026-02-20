import geocoder
import requests

def test_location():
    print("🌍 Testing Geolocation...")
    
    # Method 1: Geocoder (IP-based)
    try:
        g = geocoder.ip('me')
        print(f"\nMethod 1 (geocoder):")
        if g.latlng:
            print(f"✅ Success! Lat: {g.latlng[0]}, Lng: {g.latlng[1]}")
            print(f"   City: {g.city}")
            print(f"   State: {g.state}")
            print(f"   Country: {g.country}")
        else:
            print("❌ Failed: No lat/lng returned")
            print(f"   Raw: {g.json}")
    except Exception as e:
        print(f"❌ Error: {e}")

    # Method 2: Fallback API (ipinfo.io)
    try:
        print(f"\nMethod 2 (Direct API):")
        r = requests.get("https://ipinfo.io/json")
        data = r.json()
        if 'loc' in data:
            lat, lng = data['loc'].split(',')
            print(f"✅ Success! Lat: {lat}, Lng: {lng}")
            print(f"   City: {data.get('city')}")
        else:
            print("❌ Failed: No 'loc' field")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_location()
