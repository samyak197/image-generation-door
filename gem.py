from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from google import genai
from google.genai import types
from PIL import Image
from io import BytesIO
from dotenv import load_dotenv
import base64
import os
import uuid
import shutil
import datetime
import json
import time

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")

TEMP_DIR = "temp_images"
os.makedirs(TEMP_DIR, exist_ok=True)

HISTORY_DIR = "image_history"
os.makedirs(HISTORY_DIR, exist_ok=True)

app.mount("/history", StaticFiles(directory=HISTORY_DIR), name="history")

PROMPTS_DIR = "prompt_history"
os.makedirs(PROMPTS_DIR, exist_ok=True)

app.mount("/prompts", StaticFiles(directory=PROMPTS_DIR), name="prompts")

API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=API_KEY)

app.mount("/images", StaticFiles(directory=TEMP_DIR), name="images")

def save_history_entry(entry_type, prompt, image_path=None, input_image_path=None, response_text="", additional_data=None):
    timestamp = datetime.datetime.now().isoformat()
    entry_id = str(uuid.uuid4())
    
    data = {
        "id": entry_id,
        "timestamp": timestamp,
        "type": entry_type,
        "prompt": prompt,
        "response_text": response_text,
        "created_at": time.time(),
    }
    
    if image_path:
        data["image_path"] = image_path
    
    if input_image_path:
        data["input_image_path"] = input_image_path
    
    if additional_data:
        data.update(additional_data)
    
    history_file = os.path.join(PROMPTS_DIR, f"{entry_type}_{entry_id}.json")
    with open(history_file, "w") as f:
        json.dump(data, f, indent=2)
    
    return entry_id

@app.post("/generate-image/")
async def generate_image(prompt: str = Form(...)):
    try:
        print(f"Generating image with prompt: {prompt}")
        contents = (prompt,)
        response = client.models.generate_content(
            model="gemini-2.0-flash-exp-image-generation",
            contents=contents,
            config=types.GenerateContentConfig(
                response_modalities=['TEXT', 'IMAGE']
            )
        )
        
        image_data = None
        response_text = ""
        
        print(f"Response received, processing parts...")
        for part in response.candidates[0].content.parts:
            if part.text is not None:
                response_text += part.text
            elif part.inline_data is not None:
                image_data = part.inline_data.data
        
        if image_data:
            clean_filename = f"{uuid.uuid4()}.png"
            filepath = os.path.join(TEMP_DIR, clean_filename)
            correct_image_url = f"/images/{clean_filename}"

            print(f"Got image data, type: {type(image_data)}")
            
            try:
                base64_encoded = None
                try:
                    if isinstance(image_data, bytes):
                        try:
                            base64.b64decode(image_data, validate=True)
                            base64_encoded = image_data.decode('utf-8')
                        except:
                            base64_encoded = base64.b64encode(image_data).decode('utf-8')
                except Exception as e:
                    print(f"Base64 encoding failed: {e}")
                
                with open(filepath, "wb") as f:
                    if isinstance(image_data, bytes):
                        f.write(image_data)
                    else:
                        f.write(base64.b64decode(image_data))
                
                print(f"Image file saved at: {os.path.abspath(filepath)}")
                print(f"Image URL will be: {correct_image_url}")
                
                if os.path.exists(filepath):
                    print(f"✓ Image file exists on disk")
                    file_size = os.path.getsize(filepath)
                    print(f"  File size: {file_size} bytes")
                else:
                    print(f"✗ WARNING: Image file does not exist on disk")
                
                print(f"Image saved at: {filepath}, serving at URL: {correct_image_url}")
                
                save_history_entry(
                    entry_type="generate",
                    prompt=prompt,
                    image_path=correct_image_url,
                    response_text=response_text
                )
                
                data_url = None
                if base64_encoded:
                    data_url = f"data:image/png;base64,{base64_encoded}"
                
                return {
                    "success": True,
                    "message": response_text,
                    "image_url": correct_image_url,
                    "data_url": data_url
                }
            except Exception as e:
                print(f"Error processing image data: {e}")
                with open(filepath, "wb") as f:
                    if isinstance(image_data, bytes):
                        f.write(image_data)
                
                return {
                    "success": True,
                    "message": f"{response_text}\n(Image saved, but could not create data URL)",
                    "image_url": correct_image_url
                }
        else:
            print("No image data found in the response")
            return JSONResponse(
                status_code=500,
                content={"success": False, "message": "No image was generated"}
            )
            
    except Exception as e:
        import traceback
        print(f"Error generating image: {str(e)}")
        print(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Error generating image: {str(e)}"}
        )

@app.get("/test-image-serving")
async def test_image_serving():
    images = []
    for filename in os.listdir(TEMP_DIR):
        if filename.endswith((".png", ".jpg", ".jpeg")):
            image_path = os.path.join(TEMP_DIR, filename)
            image_url = f"/images/{filename}"
            images.append({
                "filename": filename,
                "full_path": os.path.abspath(image_path),
                "url": image_url,
                "size": os.path.getsize(image_path) if os.path.exists(image_path) else 0
            })
    
    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Image Serving Test</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; }
            .image-container { margin: 10px 0; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
            img { max-width: 300px; max-height: 300px; }
            .path { font-family: monospace; background: #f5f5f5; padding: 5px; margin: 5px 0; }
            .success { color: green; }
            .error { color: red; }
        </style>
    </head>
    <body>
        <h1>Image Serving Test</h1>
        <p>This page tests if the server can properly serve images from the temp_images directory.</p>
    """
    
    if not images:
        html_content += "<p class='error'>No images found in the temp_images directory.</p>"
    else:
        html_content += f"<p>Found {len(images)} images:</p>"
        for image in images:
            html_content += f"""
            <div class='image-container'>
                <h3>{image['filename']}</h3>
                <p>File size: {image['size']} bytes</p>
                <div class='path'>Full path: {image['full_path']}</div>
                <div class='path'>URL path: {image['url']}</div>
                <p>Image display test:</p>
                <img src="{image['url']}" alt="{image['filename']}">
                <p class='loader-status' id="status-{image['filename']}">Loading...</p>
            </div>
            """
    
    html_content += """
    <script>
        document.querySelectorAll('img').forEach(img => {
            img.onload = function() {
                const filename = this.getAttribute('alt');
                document.getElementById('status-' + filename).textContent = '✓ Image loaded successfully';
                document.getElementById('status-' + filename).className = 'loader-status success';
            };
            img.onerror = function() {
                const filename = this.getAttribute('alt');
                document.getElementById('status-' + filename).textContent = '✗ Failed to load image';
                document.getElementById('status-' + filename).className = 'loader-status error';
            };
        });
    </script>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html_content)

@app.post("/edit-image/")
async def edit_image(
    prompt: str = Form(...),
    image: UploadFile = File(...)
):
    try:
        print(f"Editing image with prompt: {prompt}")
        temp_image_path_filename = f"temp_{uuid.uuid4()}.png"
        temp_image_path = os.path.join(TEMP_DIR, temp_image_path_filename)
        with open(temp_image_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
        
        input_image_clean_filename = f"input_{uuid.uuid4()}.png"
        input_image_path_on_disk = os.path.join(TEMP_DIR, input_image_clean_filename)
        shutil.copy(temp_image_path, input_image_path_on_disk)
        correct_input_image_url = f"/images/{input_image_clean_filename}"
        
        pil_image = Image.open(temp_image_path)
        
        text_input = (prompt,)
        try:
            response = client.models.generate_content(
                model="gemini-2.0-flash-exp-image-generation",
                contents=[text_input, pil_image],
                config=types.GenerateContentConfig(
                    response_modalities=['TEXT', 'IMAGE']
                )
            )
            
            print(f"API Response received: {response}")
            
            if not hasattr(response, 'candidates') or not response.candidates:
                raise ValueError("API response missing candidates")
                
            if not hasattr(response.candidates[0], 'content') or not response.candidates[0].content:
                raise ValueError("API response missing content in first candidate")
                
            if not hasattr(response.candidates[0].content, 'parts') or not response.candidates[0].content.parts:
                raise ValueError("API response missing parts in content")
            
            image_data = None
            response_text = ""
            
            print(f"Edit response received, processing parts...")
            for part in response.candidates[0].content.parts:
                if part.text is not None:
                    response_text += part.text
                elif part.inline_data is not None:
                    image_data = part.inline_data.data
            
        except Exception as api_error:
            print(f"Gemini API error: {str(api_error)}")
            try:
                print("Trying alternative model...")
                response = client.models.generate_content(
                    model="gemini-1.5-flash-latest",
                    contents=[
                        {"text": f"I want to edit this image. {prompt}"}
                    ],
                    config=types.GenerateContentConfig(
                        response_modalities=['TEXT']
                    )
                )
                
                error_message = "Sorry, image editing is currently unavailable. Please try again later."
                if hasattr(response, 'candidates') and response.candidates and hasattr(response.candidates[0], 'content'):
                    error_message = response.candidates[0].content.parts[0].text
                
                error_clean_filename = f"error_{uuid.uuid4()}.png"
                orig_filepath = os.path.join(TEMP_DIR, error_clean_filename)
                shutil.copy(temp_image_path, orig_filepath)
                
                correct_error_image_url = f"/images/{error_clean_filename}"
                
                return {
                    "success": False,
                    "message": f"Error editing image: {error_message}",
                    "image_url": correct_error_image_url
                }
            except Exception as fallback_error:
                print(f"Fallback API also failed: {str(fallback_error)}")
                pass
                
            if os.path.exists(temp_image_path):
                os.remove(temp_image_path)
                
            return JSONResponse(
                status_code=500,
                content={"success": False, "message": f"Error using AI to edit image: {str(api_error)}"}
            )
        
        if os.path.exists(temp_image_path):
            os.remove(temp_image_path)
        
        if image_data:
            output_clean_filename = f"{uuid.uuid4()}.png"
            filepath = os.path.join(TEMP_DIR, output_clean_filename)
            correct_output_image_url = f"/images/{output_clean_filename}"

            try:
                base64_encoded = None
                try:
                    if isinstance(image_data, bytes):
                        try:
                            base64.b64decode(image_data, validate=True)
                            base64_encoded = image_data.decode('utf-8')
                        except:
                            base64_encoded = base64.b64encode(image_data).decode('utf-8')
                except Exception as e:
                    print(f"Base64 encoding failed: {e}")
                
                with open(filepath, "wb") as f:
                    if isinstance(image_data, bytes):
                        f.write(image_data)
                    else:
                        f.write(base64.b64decode(image_data))
                
                data_url = None
                if base64_encoded:
                    data_url = f"data:image/png;base64,{base64_encoded}"
                
                print(f"Edited image saved at: {filepath}, serving at URL: {correct_output_image_url}")
                
                save_history_entry(
                    entry_type="edit",
                    prompt=prompt,
                    image_path=correct_output_image_url,
                    input_image_path=correct_input_image_url,
                    response_text=response_text
                )
                
                return {
                    "success": True,
                    "message": response_text,
                    "image_url": correct_output_image_url,
                    "data_url": data_url
                }
            except Exception as e:
                print(f"Error processing image data: {e}")
                with open(filepath, "wb") as f:
                    if isinstance(image_data, bytes):
                        f.write(image_data)
                
                return {
                    "success": True,
                    "message": f"{response_text}\n(Image saved, but could not create data URL)",
                    "image_url": correct_output_image_url
                }
        else:
            print("No image data found in the edit response")
            return JSONResponse(
                status_code=500,
                content={"success": False, "message": "No image was generated from edit"}
            )
            
    except Exception as e:
        import traceback
        print(f"Error editing image: {str(e)}")
        print(traceback.format_exc())
        
        try:
            if 'temp_image_path' in locals() and os.path.exists(temp_image_path):
                os.remove(temp_image_path)
        except:
            pass
            
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Error editing image: {str(e)}"}
        )

@app.post("/chat-with-image/")
async def chat_with_image(
    prompt: str = Form(...),
    image_url: str = Form(...)
):
    try:
        print(f"Chatting about image with prompt: {prompt}")
        
        image_path = image_url.replace("/images/", "")
        image_path = os.path.join(TEMP_DIR, image_path)
        
        if not os.path.exists(image_path):
            return JSONResponse(
                status_code=404,
                content={"success": False, "message": "Image not found"}
            )
        
        pil_image = Image.open(image_path)
        
        try:
            response = client.models.generate_content(
                model="gemini-1.5-flash-latest",
                contents=[
                    {"text": f"Based on this image, {prompt}"},
                    pil_image
                ]
            )
            
            response_text = ""
            if hasattr(response, 'candidates') and response.candidates:
                for part in response.candidates[0].content.parts:
                    if part.text is not None:
                        response_text += part.text
            
            save_history_entry(
                entry_type="chat",
                prompt=prompt,
                image_path=image_url,
                response_text=response_text
            )
            
            return {
                "success": True,
                "message": response_text
            }
            
        except Exception as api_error:
            print(f"Gemini API error: {str(api_error)}")
            return JSONResponse(
                status_code=500,
                content={"success": False, "message": f"Error chatting about image: {str(api_error)}"}
            )
            
    except Exception as e:
        import traceback
        print(f"Error chatting about image: {str(e)}")
        print(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Error: {str(e)}"}
        )

@app.get("/get-history")
async def get_history():
    try:
        image_history = []
        for filename in os.listdir(TEMP_DIR):
            if filename.endswith((".png", ".jpg", ".jpeg")):
                image_history.append({
                    "url": f"/images/{filename}",
                    "timestamp": os.path.getctime(os.path.join(TEMP_DIR, filename)),
                    "filename": filename
                })
        
        chat_history = []
        if os.path.exists(HISTORY_DIR):
            for filename in os.listdir(HISTORY_DIR):
                if filename.endswith(".json"):
                    try:
                        with open(os.path.join(HISTORY_DIR, filename), "r") as f:
                            import json
                            chat_data = json.load(f)
                            chat_history.append(chat_data)
                    except Exception as e:
                        print(f"Error reading chat history file {filename}: {str(e)}")
        
        return {
            "success": True,
            "image_history": sorted(image_history, key=lambda x: x["timestamp"], reverse=True),
            "chat_history": sorted(chat_history, key=lambda x: x["timestamp"], reverse=True) if chat_history else []
        }
    except Exception as e:
        import traceback
        print(f"Error getting history: {str(e)}")
        print(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Error getting history: {str(e)}"}
        )

@app.get("/get-full-history")
async def get_full_history():
    try:
        history = []
        
        if os.path.exists(PROMPTS_DIR):
            for filename in os.listdir(PROMPTS_DIR):
                if filename.endswith(".json"):
                    try:
                        with open(os.path.join(PROMPTS_DIR, filename), "r") as f:
                            history.append(json.load(f))
                    except Exception as e:
                        print(f"Error reading history file {filename}: {str(e)}")
        
        history.sort(key=lambda x: x.get("created_at", 0), reverse=True)
        
        return {
            "success": True,
            "history": history
        }
    except Exception as e:
        import traceback
        print(f"Error getting full history: {str(e)}")
        print(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Error getting history: {str(e)}"}
        )

@app.get("/")
async def root():
    if os.path.exists("static/index.html"):
        print("index.html found in static directory")
    else:
        print("WARNING: index.html not found in static directory")
        
    return FileResponse("static/index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)