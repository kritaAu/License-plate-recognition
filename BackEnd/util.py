import requests
from datetime import datetime

API_URL = "http://127.0.0.1:8000/events"

def send_event(payload: dict):
    r = requests.post(API_URL, json=payload, timeout=10)
    r.raise_for_status()
    return r.json()

if __name__ == "__main__":
    
    event = {
        "status": "Staff",
        "datetime": datetime.now().isoformat(),  
        "plate": "มท213",
        "province": "กรุงเทพมหานคร",
        "direction": "IN",
        "blob": None 
    }

    try:
        resp = send_event(event)
        print(resp)
    except requests.HTTPError as e:
        print("HTTP error:", e.response.text)
    except Exception as e:
        print("Error:", str(e))
