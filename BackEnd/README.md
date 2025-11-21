# License-plate-recognition

pls help me

pip install ultralytics
pip install opencv-python
https://developer.nvidia.com/cuda-downloads (cuda for gpu เฉพาะ nvidia)
pip3 install torch torchvision --index-url https://download.pytorch.org/whl/cu129
pip install dotenv
pip install openai

BackEnd Api
pip install "fastapi[standard]"
pip install supabase
pip install bcrypt==4.0.1
pip install "passlib[bcrypt]"
pip install rapidfuzz

# run api use this

python -m uvicorn main_api:app --reload --port 8000
python -m uvicorn batch_process:app --reload --host 0.0.0.0 --port 8001

Docs
https://fastapi.tiangolo.com
https://supabase.com/docs/reference/python/initializing?queryGroups=platform&platform=pip
