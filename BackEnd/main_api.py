from fastapi import FastAPI
from supabase import create_client
import os
from dotenv import load_dotenv

# โหลดค่า .env
load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")
supabase = create_client(url, key)

app = FastAPI()

# ดึงข้อมูลจากตาราง Member
@app.get("/members")
def get_members(limit: int = 10):
    response = supabase.table("Member").select("*").limit(limit).execute()
    print(response)  # 👈 debug log
    return response.data


