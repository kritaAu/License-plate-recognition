# License-plate-recognition

pls help me

pip install ultralytics
pip install opencv-python
https://developer.nvidia.com/cuda-downloads (cuda for gpu เฉพาะ nvidia)
pip3 install torch torchvision --index-url https://download.pytorch.org/whl/cu129
pip install filterpy
pip install dotenv
pip install openai
pip install watchdog

BackEnd Api
pip install "fastapi[standard]"
pip install supabase

# run api use this

python -m uvicorn main_api:app --reload
python -m uvicorn batch_process:app --reload --port 8001


Docs
https://fastapi.tiangolo.com
https://supabase.com/docs/reference/python/initializing?queryGroups=platform&platform=pip
