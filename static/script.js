// static/script.js
// Helper function to fix image URLs
function fixImageUrl(imageUrlFromServer, apiBase = 'http://127.0.0.1:8000') {
    if (!imageUrlFromServer) {
        console.warn("[fixImageUrl] Called with null or empty imageUrlFromServer");
        return '';
    }

    console.log("[fixImageUrl] Initial URL from server/history item:", imageUrlFromServer);

    if (imageUrlFromServer.startsWith('data:')) {
        console.log("[fixImageUrl] Is data URL, returning as is:", imageUrlFromServer);
        return imageUrlFromServer;
    }

    let fixedUrl = imageUrlFromServer;

    if (fixedUrl.startsWith('http')) {
        if (fixedUrl.includes('localhost') && fixedUrl.includes('/temp_images/')) {
            fixedUrl = fixedUrl.replace('/temp_images/', '/images/');
            console.log("[fixImageUrl] Corrected full localhost URL from /temp_images/ to /images/ prefix:", fixedUrl);
        } else if (fixedUrl.includes(apiBase) && !fixedUrl.includes('/images/')) {
            const pathPart = fixedUrl.substring(apiBase.length);
            if (pathPart.startsWith('/') && !pathPart.startsWith('/images/')) {
                fixedUrl = apiBase + '/images' + pathPart;
                console.log("[fixImageUrl] Added /images/ to full API base URL:", fixedUrl);
            }
        }
        console.log("[fixImageUrl] Returning HTTP/HTTPS URL (possibly corrected):", fixedUrl);
        return fixedUrl;
    }

    let pathPart = fixedUrl;
    while (pathPart.startsWith('/')) {
        pathPart = pathPart.substring(1);
    }

    if (pathPart.startsWith('temp_images/')) {
        pathPart = pathPart.substring('temp_images/'.length);
        console.log(`[fixImageUrl] Removed 'temp_images/' prefix from relative path, now:`, pathPart);
    }

    if (!pathPart.startsWith('images/')) {
        fixedUrl = '/images/' + pathPart;
    } else {
        fixedUrl = '/' + pathPart;
    }
    console.log("[fixImageUrl] Constructed relative path with /images/ prefix:", fixedUrl);

    if (!fixedUrl.startsWith('http') && !fixedUrl.startsWith('data:')) {
        fixedUrl = apiBase + fixedUrl;
        console.log("[fixImageUrl] Prepended API base to relative path:", fixedUrl);
    }

    console.log("[fixImageUrl] Final fixed imagePath:", fixedUrl);
    return fixedUrl;
}

document.addEventListener('DOMContentLoaded', function() {
    // Tab functionality
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `${tabId}-tab`) {
                    content.classList.add('active');
                }
            });
            
            if (tabId === 'history') {
                console.log("History tab activated, refreshing view");
                imageHistory.renderHistory();
            }
        });
    });
    
    // Image History Management
    const imageHistory = {
        items: [],
        
        init() {
            const savedHistory = localStorage.getItem('aiImageHistory');
            if (savedHistory) {
                try {
                    this.items = JSON.parse(savedHistory);
                } catch (e) {
                    console.error('Failed to parse history:', e);
                    this.items = [];
                }
            }
            
            this.renderHistory();
        },
        
        addItem(prompt, imageUrl, dataUrl, message, type = 'generated') {
            const item = {
                id: Date.now(),
                date: new Date().toISOString(),
                prompt,
                imageUrl,
                dataUrl,
                message,
                type
            };
            
            this.items.unshift(item);
            this.saveHistory();
            this.renderHistory();
            
            return item;
        },
        
        clearHistory() {
            this.items = [];
            this.saveHistory();
            this.renderHistory();
        },
        
        saveHistory() {
            localStorage.setItem('aiImageHistory', JSON.stringify(this.items));
        },
        
        renderHistory() {
            const historyGrid = document.getElementById('history-grid');
            const emptyMessage = document.getElementById('history-empty');
            const historyControls = document.getElementById('history-controls');
            
            if (!historyGrid || !emptyMessage || !historyControls) {
                console.error("History DOM elements not found. Cannot render history.");
                return;
            }
            
            historyGrid.innerHTML = '';
            
            if (this.items.length === 0) {
                emptyMessage.classList.remove('hidden');
                historyControls.classList.add('hidden');
                return;
            }
            
            emptyMessage.classList.add('hidden');
            historyControls.classList.remove('hidden');
            
            console.log(`[History] Rendering ${this.items.length} history items`);
            
            this.items.forEach(item => {
                const template = document.getElementById('history-item-template');
                if (!template) {
                    console.error("History item template not found!");
                    return;
                }
                const clone = document.importNode(template.content, true);
                
                const historyItemElement = clone.querySelector('.history-item');
                if (item.type === 'edited') {
                    historyItemElement.classList.add('edited');
                }
                
                const image = clone.querySelector('.history-image');
                const imageContainer = clone.querySelector('.history-image-container');
                
                const loader = document.createElement('div');
                loader.className = 'image-loader';
                imageContainer.appendChild(loader);
                
                let displayUrl;
                if (item.dataUrl) {
                    displayUrl = item.dataUrl;
                    image.classList.add('from-data-url');
                    console.log(`[History Item ${item.id}] Using dataUrl for image.`);
                } else {
                    displayUrl = fixImageUrl(item.imageUrl);
                    image.classList.add('from-server-url');
                    image.setAttribute('data-original-server-url', item.imageUrl);
                    console.log(`[History Item ${item.id}] Original server URL: "${item.imageUrl}", Fixed for display: "${displayUrl}"`);
                }
                
                if (!displayUrl.startsWith('data:')) {
                    const cacheBuster = new Date().getTime();
                    displayUrl = `${displayUrl}${displayUrl.includes('?') ? '&' : '?'}t=${cacheBuster}`;
                    console.log(`[History Item ${item.id}] URL with cache buster: "${displayUrl}"`);
                }
                
                image.src = displayUrl;
                
                image.onload = function() {
                    console.log(`[History Item ${item.id}] Image loaded successfully: ${item.prompt}`);
                    loader.remove();
                    imageContainer.classList.add('loaded');
                };
                
                image.onerror = function() {
                    console.error(`[History Item ${item.id}] Failed to load image: ${item.prompt}`, {
                        attemptedSrc: this.src,
                        originalItemImageUrl: item.imageUrl,
                        hadDataUrl: !!item.dataUrl
                    });
                    loader.remove();
                    imageContainer.classList.add('error');
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'image-error';
                    errorDiv.textContent = 'Image failed to load.';
                    const pathInfo = document.createElement('p');
                    pathInfo.style.fontSize = '10px';
                    pathInfo.style.wordBreak = 'break-all';
                    pathInfo.textContent = `Attempted: ${this.src}`;
                    errorDiv.appendChild(pathInfo);
                    imageContainer.appendChild(errorDiv);
                };
                
                clone.querySelector('.history-prompt').textContent = item.prompt;
                clone.querySelector('.history-date').textContent = new Date(item.date).toLocaleString();
                
                const editBtn = clone.querySelector('.use-in-edit-btn');
                editBtn.addEventListener('click', () => this.useForEdit(item));
                
                const copyBtn = clone.querySelector('.copy-prompt-btn');
                copyBtn.addEventListener('click', () => {
                    navigator.clipboard.writeText(item.prompt)
                        .then(() => alert('Prompt copied to clipboard!'))
                        .catch(err => console.error('Failed to copy prompt:', err));
                });
                
                historyGrid.appendChild(clone);
            });
        },
        
        useForEdit(item) {
            console.log("[History] Using history item for edit:", item);
            
            document.querySelector('.tab-btn[data-tab="edit"]').click();
            document.getElementById('edit-prompt').value = item.prompt;
            
            let sourceUrlForFetch = item.dataUrl || fixImageUrl(item.imageUrl);
            
            console.log("[History] Fetching image for edit from:", sourceUrlForFetch);
            
            const previewContainer = document.getElementById('preview-container');
            const imagePreview = document.getElementById('image-preview');
            imagePreview.src = '';
            previewContainer.classList.add('loading');
            document.getElementById('edit-btn').disabled = true;
            
            fetch(sourceUrlForFetch)
                .then(res => {
                    if (!res.ok) {
                        throw new Error(`Failed to fetch image: ${res.status} from ${sourceUrlForFetch}`);
                    }
                    console.log("[History] Image fetch successful, getting blob");
                    return res.blob();
                })
                .then(blob => {
                    console.log("[History] Image blob received:", blob.type, blob.size);
                    const file = new File([blob], "history-image.png", { type: blob.type || "image/png" });
                    
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    
                    const imageUpload = document.getElementById('image-upload');
                    imageUpload.files = dataTransfer.files;
                    
                    console.log("[History] Image file set, dispatching change event");
                    
                    const event = new Event('change');
                    imageUpload.dispatchEvent(event);
                    
                    document.getElementById('edit-btn').disabled = false;
                    previewContainer.classList.remove('loading');
                })
                .catch(error => {
                    console.error('[History] Error using history image for editing:', error);
                    alert('Failed to use image for editing. Try downloading and uploading manually.');
                    previewContainer.classList.remove('loading');
                    document.getElementById('edit-btn').disabled = true;
                });
        },
        
        sortHistory(order) {
            if (order === 'newest') {
                this.items.sort((a, b) => new Date(b.date) - new Date(a.date));
            } else {
                this.items.sort((a, b) => new Date(a.date) - new Date(b.date));
            }
            this.renderHistory();
        }
    };
    
    imageHistory.init();
    
    document.getElementById('sort-history').addEventListener('change', (e) => {
        imageHistory.sortHistory(e.target.value);
    });
    
    document.getElementById('clear-history-btn').addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all image history? This cannot be undone.')) {
            imageHistory.clearHistory();
        }
    });
    
    const generateBtn = document.getElementById('generate-btn');
    const generatePrompt = document.getElementById('generate-prompt');
    const generateSpinner = document.getElementById('generate-spinner');
    const generateError = document.getElementById('generate-error');
    const generateResult = document.getElementById('generate-result');
    const generatedImage = document.getElementById('generated-image');
    const generatedMessage = document.getElementById('generated-image-message');
    const useForEditBtn = document.getElementById('use-for-edit');
    
    generateBtn.addEventListener('click', async () => {
        if (!generatePrompt.value.trim()) {
            alert('Please enter a prompt to generate an image');
            return;
        }
        
        generateBtn.disabled = true;
        generateSpinner.classList.remove('hidden');
        generateError.classList.add('hidden');
        generateResult.classList.add('hidden');
        
        try {
            const formData = new FormData();
            formData.append('prompt', generatePrompt.value);
            
            const response = await fetch('http://127.0.0.1:8000/generate-image/', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Server did not return JSON. Check server logs for errors.');
            }
            
            const data = await response.json();
            console.log("Server response:", data);
            
            if (data.success) {
                if (data.data_url) {
                    console.log("Using data URL for image");
                    generatedImage.src = data.data_url;
                    
                    document.getElementById('debug-image-url').textContent = "Alternative URL (if image above is not visible)";
                    document.getElementById('debug-image-url').href = `http://127.0.0.1:8000${data.image_url}`;
                    document.getElementById('debug-section').classList.remove('hidden');
                } else {
                    let imageUrl = data.image_url;
                    imageUrl = imageUrl.trim().replace(/['"]/g, '');
                    
                    if (!imageUrl.startsWith('http')) {
                        imageUrl = `http://127.0.0.1:8000${imageUrl}`;
                    }
                    
                    const cacheBuster = new Date().getTime();
                    const finalUrl = encodeURI(`${imageUrl}?t=${cacheBuster}`);
                    console.log("Using regular URL for image:", finalUrl);
                    
                    document.getElementById('debug-image-url').textContent = finalUrl;
                    document.getElementById('debug-image-url').href = finalUrl;
                    document.getElementById('debug-section').classList.remove('hidden');
                    
                    generatedImage.src = finalUrl;
                }
                
                generateResult.classList.remove('hidden');
                generatedImage.style.display = 'block';
                
                generatedImage.onload = () => {
                    console.log("Image loaded successfully");
                };
                
                generatedImage.onerror = (e) => {
                    console.error("Error loading image:", e);
                    generateError.textContent = "Image couldn't be displayed. Try the direct link below or check server logs.";
                    generateError.classList.remove('hidden');
                };
                
                generatedMessage.textContent = data.message || '';
                
                imageHistory.addItem(
                    generatePrompt.value,
                    data.image_url,
                    data.data_url,
                    data.message
                );
            } else {
                throw new Error(data.message || 'Failed to generate image');
            }
        } catch (error) {
            generateError.textContent = error.message || 'An error occurred while generating the image';
            generateError.classList.remove('hidden');
            console.error('Generation error:', error);
        } finally {
            generateBtn.disabled = false;
            generateSpinner.classList.add('hidden');
        }
    });
    
    const imageUpload = document.getElementById('image-upload');
    const imagePreview = document.getElementById('image-preview');
    const previewContainer = document.getElementById('preview-container');
    const clearImageBtn = document.getElementById('clear-image');
    const editBtn = document.getElementById('edit-btn');
    
    imageUpload.addEventListener('change', event => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = e => {
                imagePreview.src = e.target.result;
                previewContainer.classList.remove('hidden');
                editBtn.disabled = false;
            };
            reader.readAsDataURL(file);
        }
    });
    
    clearImageBtn.addEventListener('click', () => {
        imageUpload.value = '';
        previewContainer.classList.add('hidden');
        editBtn.disabled = true;
    });
    
    useForEditBtn.addEventListener('click', () => {
        tabBtns.forEach(b => {
            if (b.getAttribute('data-tab') === 'edit') {
                b.click();
            }
        });
        
        let imageUrl = generatedImage.src;
        console.log("Fetching image for edit from:", imageUrl);
        
        fetch(imageUrl)
            .then(res => {
                if (!res.ok) {
                    throw new Error(`Failed to fetch image: ${res.status}`);
                }
                return res.blob();
            })
            .then(blob => {
                const file = new File([blob], "generated-image.png", { type: "image/png" });
                
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                imageUpload.files = dataTransfer.files;
                
                const event = new Event('change');
                imageUpload.dispatchEvent(event);
            })
            .catch(error => {
                console.error('Error using generated image:', error);
                alert('Failed to use generated image for editing');
            });
    });
    
    const editPrompt = document.getElementById('edit-prompt');
    const editSpinner = document.getElementById('edit-spinner');
    const editError = document.getElementById('edit-error');
    const editResult = document.getElementById('edit-result');
    const editedImage = document.getElementById('edited-image');
    const editedMessage = document.getElementById('edited-image-message');
    
    const viewInHistoryBtn = document.createElement('button');
    viewInHistoryBtn.id = 'view-in-history-btn';
    viewInHistoryBtn.className = 'secondary-btn';
    viewInHistoryBtn.textContent = 'View in History';
    viewInHistoryBtn.style.marginTop = '10px';
    viewInHistoryBtn.addEventListener('click', () => {
        document.querySelector('.tab-btn[data-tab="history"]').click();
        
        setTimeout(() => {
            const firstItem = document.querySelector('.history-item');
            if (firstItem) {
                firstItem.classList.add('highlight-item');
                setTimeout(() => firstItem.classList.remove('highlight-item'), 2000);
            }
        }, 100);
    });
    
    document.getElementById('edit-result').appendChild(viewInHistoryBtn);
    
    editBtn.addEventListener('click', async () => {
        if (!imageUpload.files[0]) {
            alert('Please upload an image to edit');
            return;
        }
        
        if (!editPrompt.value.trim()) {
            alert('Please enter a prompt to edit the image');
            return;
        }
        
        editBtn.disabled = true;
        editSpinner.classList.remove('hidden');
        editError.classList.add('hidden');
        editResult.classList.add('hidden');
        
        try {
            const formData = new FormData();
            formData.append('prompt', editPrompt.value);
            formData.append('image', imageUpload.files[0]);
            
            const response = await fetch('http://127.0.0.1:8000/edit-image/', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Server did not return JSON. Check server logs for errors.');
            }
            
            const data = await response.json();
            console.log("Edit server response:", data);
            
            if (data.success) {
                editError.classList.add('hidden');
                editError.textContent = '';
                
                let imgSrc = '';
                if (data.data_url) {
                    console.log("Using data URL for edited image");
                    imgSrc = data.data_url;
                    editedImage.src = data.data_url;
                } else {
                    let imageUrl = data.image_url;
                    imageUrl = imageUrl.trim().replace(/['"]/g, '');
                    
                    if (!imageUrl.startsWith('http')) {
                        imageUrl = `http://127.0.0.1:8000${imageUrl}`;
                    }
                    
                    const cacheBuster = new Date().getTime();
                    const finalUrl = encodeURI(`${imageUrl}?t=${cacheBuster}`);
                    console.log("Using regular URL for edited image:", finalUrl);
                    
                    imgSrc = finalUrl;
                    editedImage.src = finalUrl;
                }
                
                editedImage.onload = () => {
                    console.log("Edited image loaded successfully");
                    editError.classList.add('hidden');
                    editResult.classList.remove('hidden');
                    viewInHistoryBtn.classList.remove('hidden');
                };
                
                editedImage.onerror = (e) => {
                    console.error("Error loading edited image:", e);
                    const tempImg = new Image();
                    tempImg.onload = function() {
                        console.log("Temp image loaded successfully via alternate method");
                        editedImage.src = this.src;
                        editResult.classList.remove('hidden');
                    };
                    tempImg.onerror = function() {
                        console.error("Even temp image failed to load");
                        editError.textContent = "Image couldn't be displayed. Try the direct link below or check server logs.";
                        editError.classList.remove('hidden');
                    };
                    tempImg.src = imgSrc;
                };
                
                editResult.classList.remove('hidden');
                editedImage.style.display = 'block';
                
                document.getElementById('debug-edit-url').textContent = imgSrc;
                document.getElementById('debug-edit-url').href = imgSrc;
                document.getElementById('debug-edit-section').classList.remove('hidden');
                
                editedMessage.textContent = data.message || '';
                
                viewInHistoryBtn.classList.remove('hidden');
                
                const historyItem = imageHistory.addItem(
                    editPrompt.value,
                    data.image_url,
                    data.data_url,
                    data.message,
                    'edited'
                );
                
                console.log("Added to history, new count:", imageHistory.items.length);
                console.log("New history item:", historyItem);
                
                imageHistory.renderHistory();
            } else {
                throw new Error(data.message || 'Failed to edit image');
            }
        } catch (error) {
            editError.textContent = error.message || 'An error occurred while editing the image';
            editError.classList.remove('hidden');
            console.error('Edit error:', error);
        } finally {
            editBtn.disabled = false;
            editSpinner.classList.add('hidden');
        }
    });

    console.log("Image history loaded with", imageHistory.items.length, "items");
    
    try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
    } catch (e) {
        console.error("localStorage is not available:", e);
        alert("Warning: Your browser settings may prevent saving image history. Enable cookies/localStorage for this site to use history features.");
    }
});