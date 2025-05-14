# Gemini Image Generator

A web application that uses Google's Gemini AI to generate, edit, and chat about images based on text prompts.

## 🌟 Features

- 🖼️ Generate images from text prompts
- ✏️ Edit existing images using text instructions
- 💬 Chat with AI about image content
- 📚 View history of generated images and conversations
- 📊 Comprehensive history tracking with prompts and responses

## 📋 Requirements

- Python 3.8+
- FastAPI
- Google Generative AI Python SDK
- Pillow (PIL Fork)
- python-dotenv
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Google Gemini API key

## 🚀 Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/gemini-image-generator.git
   cd gemini-image-generator
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   ```

3. Activate the virtual environment:
   - Windows:
     ```bash
     venv\Scripts\activate
     ```
   - macOS/Linux:
     ```bash
     source venv/bin/activate
     ```

4. Install the required packages:
   ```bash
   pip install requirements.txt
   ```

## ⚙️ Configuration

1. Create a `.env` file in the project root directory:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

2. Replace `your_api_key_here` with your Google Gemini API key. You can get one from [Google AI Studio](https://makersuite.google.com/app/apikey).

3. Make sure you have the required directory structure:
   ```
   project_root/
   ├── static/
   │   ├── css/
   │   ├── js/
   │   └── index.html
   ├── temp_images/
   ├── image_history/
   ├── prompt_history/
   ├── .env
   └── gem.py
   ```

   The application will create these directories automatically if they don't exist.

## 🏃‍♂️ Running the Application

1. Start the FastAPI server:
   ```bash
   uvicorn gem:app --reload --host 0.0.0.0 --port 8000
   ```

2. Open your html page

## 💡 Development Notes

- The application uses FastAPI for the backend API
- Images are stored temporarily in the `temp_images` directory
- History records are stored as JSON files in the `prompt_history` directory
- The frontend is built with vanilla HTML, CSS, and JavaScript