// Helper function to fix image URLs
function fixImagePath(imageUrl) {
    if (!imageUrl) {
        console.warn("[fixImagePath] Called with null or empty imageUrl");
        return ''; 
    }
    
    console.log("[fixImagePath] Initial URL:", imageUrl);
    
    if (imageUrl.startsWith('data:')) {
        console.log("[fixImagePath] Is data URL, returning as is:", imageUrl);
        return imageUrl;
    }
    
    let fixedUrl = imageUrl;

    // If it's a full HTTP/HTTPS URL
    if (fixedUrl.startsWith('http')) {
        if (fixedUrl.includes('localhost') || fixedUrl.includes('127.0.0.1')) { // Check for localhost or 127.0.0.1
            // If it's a local URL pointing to /temp_images/, correct it to /images/
            if (fixedUrl.includes('/temp_images/')) {
                fixedUrl = fixedUrl.replace('/temp_images/', '/images/');
                console.log("[fixImagePath] Corrected full local URL from /temp_images/ to /images/ prefix:", fixedUrl);
            }
            // If it's a local URL that already has /images/images/, correct it
            if (fixedUrl.match(/\/images\/images\//)) {
                fixedUrl = fixedUrl.replace(/\/images\/images\//, '/images/');
                console.log("[fixImagePath] Corrected full local URL from /images/images/ to /images/ prefix:", fixedUrl);
            }
        }
        // For other full HTTP/HTTPS URLs, or already corrected local URLs, return them.
        console.log("[fixImagePath] Returning HTTP/HTTPS URL (possibly corrected):", fixedUrl);
        return fixedUrl;
    }
    
    // For relative paths (e.g., "/images/filename.png", "filename.png", "/filename.png", "images/filename.png")
    let pathPart = fixedUrl;
    
    // Remove all leading slashes to normalize
    while (pathPart.startsWith('/')) {
        pathPart = pathPart.substring(1);
    }

    // If the path part mistakenly starts with "temp_images/", remove it.
    if (pathPart.startsWith('temp_images/')) {
         pathPart = pathPart.substring('temp_images/'.length);
         console.log(`[fixImagePath] Removed 'temp_images/' prefix from relative path, now:`, pathPart);
    }
    
    // Ensure the final relative path starts with a single "/images/"
    if (pathPart.startsWith('images/')) {
        // It already has "images/" prefix, just ensure it starts with a single slash
        fixedUrl = '/' + pathPart;
    } else {
        // It's missing "images/" prefix (e.g., "filename.png"), so prepend "/images/"
        fixedUrl = '/images/' + pathPart;
    }
    console.log("[fixImagePath] Constructed relative path with /images/ prefix:", fixedUrl);
    
    // This part is mainly for local testing if index.html is opened directly via file://
    // If not file://, getApiBaseUrl() returns '', so fixedUrl remains a relative path like /images/filename.png
    // which is correct for img src when served by the server.
    const apiBase = getApiBaseUrl(); 
    if (apiBase && !fixedUrl.startsWith('http')) { // apiBase will be http://localhost:8000 for file://
        fixedUrl = apiBase + fixedUrl;
        console.log("[fixImagePath] Added server prefix for file:// protocol:", fixedUrl);
    }
    
    console.log("[fixImagePath] Final fixed imagePath:", fixedUrl);
    return fixedUrl;
}

document.addEventListener('DOMContentLoaded', function() {
    // Get the base URL for API calls
    const API_BASE_URL = getApiBaseUrl();
    console.log("Using API base URL:", API_BASE_URL);

    // Initialize tab navigation
    initTabNavigation();
    
    // Initialize form handlers
    initImageGeneration();
    initImageEditing();
    initChatWithImage();
    initHistoryView();
    
    // Initialize modal functionality
    initModal();
    
    // Load history on page load
    loadHistory();
    
    // Log that the frontend is loaded properly
    console.log("Frontend loaded successfully!");
});

// Function to determine the base URL for API calls
function getApiBaseUrl() {
    // If the page is served from the FastAPI server, use relative URLs
    if (window.location.protocol !== 'file:') {
        return '';
    }
    
    // For local file access, use explicit localhost URL
    return 'http://localhost:8000';
}

// Tab Navigation
function initTabNavigation() {
    const tabLinks = document.querySelectorAll('nav a');
    const historyTabButtons = document.querySelectorAll('.tab-btn[data-history-tab]');
    
    // Main tabs
    tabLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all tabs
            tabLinks.forEach(l => l.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked tab
            this.classList.add('active');
            const tabId = this.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');

            // If the history tab is clicked, refresh its content
            if (tabId === 'history') {
                console.log("History tab clicked, loading history...");
                loadHistory();
            }
        });
    });
    
    // History subtabs
    historyTabButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            historyTabButtons.forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.history-tab-content').forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
            const tabId = this.getAttribute('data-history-tab');
            document.getElementById(`${tabId}-history`).classList.add('active');
        });
    });
}

// Image Generation
function initImageGeneration() {
    const generateForm = document.getElementById('generate-form');
    const resultContainer = document.getElementById('generate-result');
    const loader = resultContainer.querySelector('.loader');
    const resultContent = resultContainer.querySelector('.result-content');
    const generatedImage = document.getElementById('generated-image');
    const generatedText = document.getElementById('generated-text');
    
    const chatAboutGeneratedBtn = document.getElementById('chat-about-generated');
    if (chatAboutGeneratedBtn) {
        const chatTabNavLink = document.querySelector('nav a[data-tab="chat"]');
        const chatSectionExists = document.getElementById('chat');
        if (!chatTabNavLink || !chatSectionExists) {
            chatAboutGeneratedBtn.style.display = 'none'; // Hide if chat functionality is disabled
        } else {
            chatAboutGeneratedBtn.addEventListener('click', function() {
                chatTabNavLink.click();
                const imgSrc = document.getElementById('generated-image').src;
                const chatImagePreview = document.getElementById('chat-image-preview');
                if (chatImagePreview) {
                    chatImagePreview.innerHTML = `<img src="${imgSrc}" alt="Chat Image">`;
                    chatImagePreview.dataset.imageUrl = imgSrc;
                } else {
                    console.warn("Chat image preview element not found when trying to set image from generated.");
                }
            });
        }
    }
    
    // Handle edit generated image
    document.getElementById('edit-generated').addEventListener('click', function() {
        // Switch to edit tab
        document.querySelector('nav a[data-tab="edit"]').click();
        
        // Convert the generated image to a File object
        fetch(document.getElementById('generated-image').src)
            .then(res => res.blob())
            .then(blob => {
                const file = new File([blob], "generated-image.png", {type: "image/png"});
                
                // Create a new DataTransfer object
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                
                // Set the file to the input
                const fileInput = document.getElementById('edit-image-upload');
                fileInput.files = dataTransfer.files;
                
                // Trigger change event
                const event = new Event('change');
                fileInput.dispatchEvent(event);
            });
    });
    
    // Handle download generated image
    document.getElementById('download-generated').addEventListener('click', function() {
        // Create a temporary link and trigger download
        const link = document.createElement('a');
        link.href = document.getElementById('generated-image').src;
        link.download = 'generated-image.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
    
    // Handle form submission
    generateForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const prompt = document.getElementById('generate-prompt').value.trim();
        if (!prompt) {
            alert('Please enter a prompt');
            return;
        }
        
        // Show loader, hide result
        loader.style.display = 'block';
        resultContent.style.display = 'none';
        
        // Create form data
        const formData = new FormData();
        formData.append('prompt', prompt);
        
        // Send request to server with absolute URL
        fetch(getApiBaseUrl() + '/generate-image/', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log("Original image URL from server:", data.image_url);
                // Fix the image path
                const correctedImageUrl = fixImagePath(data.image_url);
                
                // Use the corrected URL
                generatedImage.src = correctedImageUrl;
                generatedImage.setAttribute('data-original-url', data.image_url);
                generatedText.textContent = data.message;
                
                // Hide loader, show result
                loader.style.display = 'none';
                resultContent.style.display = 'block';
                
                // Refresh history after generating a new image
                loadHistory();
            } else {
                alert('Error: ' + data.message);
                loader.style.display = 'none';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred. Please try again.');
            loader.style.display = 'none';
        });
    });
}

// Image Editing
function initImageEditing() {
    const editForm = document.getElementById('edit-form');
    const imageUpload = document.getElementById('edit-image-upload');
    const imagePreview = document.getElementById('edit-image-preview');
    const resultContainer = document.getElementById('edit-result');
    const loader = resultContainer.querySelector('.loader');
    const resultContent = resultContainer.querySelector('.result-content');
    const editedImage = document.getElementById('edited-image');
    const editedText = document.getElementById('edited-text');
    
    const chatAboutEditedBtn = document.getElementById('chat-about-edited');
    if (chatAboutEditedBtn) {
        const chatTabNavLink = document.querySelector('nav a[data-tab="chat"]');
        const chatSectionExists = document.getElementById('chat');
        if (!chatTabNavLink || !chatSectionExists) {
            chatAboutEditedBtn.style.display = 'none'; // Hide if chat functionality is disabled
        } else {
            chatAboutEditedBtn.addEventListener('click', function() {
                chatTabNavLink.click();
                const imgSrc = document.getElementById('edited-image').src;
                const chatImagePreview = document.getElementById('chat-image-preview');
                if (chatImagePreview) {
                    chatImagePreview.innerHTML = `<img src="${imgSrc}" alt="Chat Image">`;
                    chatImagePreview.dataset.imageUrl = imgSrc;
                } else {
                    console.warn("Chat image preview element not found when trying to set image from edited.");
                }
            });
        }
    }
    
    // Handle file upload preview
    imageUpload.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                imagePreview.innerHTML = `<img src="${e.target.result}" alt="Image to Edit">`;
            };
            
            reader.readAsDataURL(this.files[0]);
        }
    });
    
    // Handle download edited image
    document.getElementById('download-edited').addEventListener('click', function() {
        // Create a temporary link and trigger download
        const link = document.createElement('a');
        link.href = document.getElementById('edited-image').src;
        link.download = 'edited-image.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
    
    // Handle form submission
    editForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const prompt = document.getElementById('edit-prompt').value.trim();
        const imageFile = imageUpload.files[0];
        
        if (!prompt) {
            alert('Please enter editing instructions');
            return;
        }
        
        if (!imageFile) {
            alert('Please upload an image to edit');
            return;
        }
        
        // Show loader, hide result
        loader.style.display = 'block';
        resultContent.style.display = 'none';
        
        // Create form data
        const formData = new FormData();
        formData.append('prompt', prompt);
        formData.append('image', imageFile);
        
        // Send request to server with absolute URL
        fetch(getApiBaseUrl() + '/edit-image/', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log("Original edited image URL:", data.image_url);
                // Fix the image path
                const correctedImageUrl = fixImagePath(data.image_url);
                
                // Use the corrected URL
                editedImage.src = correctedImageUrl;
                editedImage.setAttribute('data-original-url', data.image_url);
                editedText.textContent = data.message;
                
                // Hide loader, show result
                loader.style.display = 'none';
                resultContent.style.display = 'block';
                
                // Refresh history after editing an image
                loadHistory();
            } else {
                alert('Error: ' + data.message);
                loader.style.display = 'none';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred. Please try again.');
            loader.style.display = 'none';
        });
    });
}

// Chat with Image
function initChatWithImage() {
    const chatSection = document.getElementById('chat'); // Assuming your main chat section would have id="chat"
    const chatTabNavLink = document.querySelector('nav a[data-tab="chat"]'); // Check for the nav link

    // If the chat section or its nav link is not in the DOM, skip all chat initialization
    if (!chatTabNavLink || !chatSection) {
        console.warn("Chat section or tab link not found. Chat functionality will be disabled.");
        
        // Hide any buttons in other sections that might link to the (now absent) chat feature
        const hideButton = (id) => {
            const btn = document.getElementById(id);
            if (btn) btn.style.display = 'none';
        };
        hideButton('chat-about-generated');
        hideButton('chat-about-edited');
        hideButton('modal-chat');
        
        return; // Exit initialization
    }

    const chatImagePreview = document.getElementById('chat-image-preview');
    const chatImageUpload = document.getElementById('chat-image-upload');
    const chatMessages = document.getElementById('chat-messages');
    const chatPrompt = document.getElementById('chat-prompt');
    const sendChatBtn = document.getElementById('send-chat');
    const selectFromHistoryBtn = document.getElementById('chat-select-from-history');
    const uploadBtn = document.getElementById('chat-upload-btn');

    if (chatImageUpload) {
        chatImageUpload.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    if (chatImagePreview) {
                        chatImagePreview.innerHTML = `<img src="${e.target.result}" alt="Chat Image">`;
                        chatImagePreview.dataset.imageUrl = e.target.result;
                    }
                    if (chatMessages) {
                        chatMessages.innerHTML = '<div class="empty-state">Image ready. Start chatting!</div>';
                    }
                };
                reader.readAsDataURL(this.files[0]);
            }
        });
    }

    if (uploadBtn) {
        uploadBtn.addEventListener('click', function() {
            if (chatImageUpload) chatImageUpload.click();
        });
    }

    if (selectFromHistoryBtn) {
        selectFromHistoryBtn.addEventListener('click', function() {
            const mainNavHistoryLink = document.querySelector('nav a[data-tab="history"]');
            if (mainNavHistoryLink) mainNavHistoryLink.click();

            const historyImagesGrid = document.getElementById('history-images-grid');
            if (historyImagesGrid) {
                const notification = document.createElement('div');
                notification.className = 'notification';
                notification.textContent = 'Click on an image to select it for chat';
                notification.style.padding = '10px';
                notification.style.backgroundColor = '#ffc107';
                notification.style.borderRadius = '4px';
                notification.style.marginBottom = '16px';
                notification.style.textAlign = 'center';
                
                if (historyImagesGrid.parentNode) {
                     historyImagesGrid.parentNode.insertBefore(notification, historyImagesGrid);
                }
                historyImagesGrid.dataset.selectionMode = 'chat';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 5000);
            } else {
                console.warn("History images grid ('history-images-grid') not found for chat selection.");
            }
        });
    }

    if (sendChatBtn && chatPrompt) {
        sendChatBtn.addEventListener('click', sendChatMessage);
        chatPrompt.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });
    }
    
    function sendChatMessage() {
        if (!chatPrompt || !chatImagePreview || !chatMessages) {
            console.error("Cannot send chat message, essential chat elements are missing.");
            return;
        }

        const prompt = chatPrompt.value.trim();
        let imageUrl = chatImagePreview.dataset.imageUrl;
        
        imageUrl = fixImagePath(imageUrl); 
        
        if (!prompt) { alert('Please enter a message'); return; }
        if (!imageUrl) { alert('Please select an image first'); return; }
        
        chatPrompt.value = '';
        addMessage(prompt, 'user');
        
        const loadingElement = document.createElement('div');
        loadingElement.className = 'message ai-message loading';
        loadingElement.textContent = 'Thinking...';
        chatMessages.appendChild(loadingElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        const formData = new FormData();
        formData.append('prompt', prompt);
        formData.append('image_url', imageUrl);
        
        fetch(getApiBaseUrl() + '/chat-with-image/', { method: 'POST', body: formData })
            .then(response => response.json())
            .then(data => {
                if (loadingElement.parentNode === chatMessages) {
                    chatMessages.removeChild(loadingElement);
                }
                if (data.success) {
                    addMessage(data.message, 'ai');
                } else {
                    addMessage('Error: ' + data.message, 'ai');
                }
                loadHistory(); 
            })
            .catch(error => {
                if (loadingElement.parentNode === chatMessages) {
                    chatMessages.removeChild(loadingElement);
                }
                console.error('Error sending chat message:', error);
                addMessage('An error occurred. Please try again.', 'ai');
            });
    }
    
    function addMessage(text, sender) {
        if (!chatMessages) return; 
        if (chatMessages.querySelector('.empty-state')) {
            chatMessages.innerHTML = '';
        }
        const messageElement = document.createElement('div');
        messageElement.className = `message ${sender}-message`;
        messageElement.textContent = text;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// History View
function initHistoryView() {
    const refreshHistoryBtn = document.getElementById('refresh-history');
    
    // Handle refresh button click
    refreshHistoryBtn.addEventListener('click', loadHistory);
}

// Load history from server
function loadHistory() {
    console.log("Loading history...");
    fetch(getApiBaseUrl() + '/get-full-history')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("Received history data:", data);
            if (data.success) {
                const fullHistory = data.history || [];
                console.log("Processing fullHistory array:", fullHistory);
                
                const imagesGrid = document.getElementById('history-images-grid');
                imagesGrid.innerHTML = ''; 
                
                const imageEntries = fullHistory.filter(entry => 
                    (entry.type === 'generate' || entry.type === 'edit') && entry.image_path
                );
                console.log("Filtered image entries for history:", imageEntries);
                
                if (imageEntries.length === 0) {
                    imagesGrid.innerHTML = '<div class="empty-state">No images in history yet.</div>';
                } else {
                    imageEntries.forEach(entry => {
                        console.log("Processing history entry:", entry);
                        if (!entry.image_path) {
                            console.warn("History entry missing image_path:", entry);
                            return; 
                        }

                        const card = document.createElement('div');
                        card.className = 'image-card';
                        
                        const img = document.createElement('img');
                        let correctedHistoryImageUrl = fixImagePath(entry.image_path);
                        
                        // Add cache-busting parameter to non-data URLs
                        if (correctedHistoryImageUrl && !correctedHistoryImageUrl.startsWith('data:')) {
                            correctedHistoryImageUrl += (correctedHistoryImageUrl.includes('?') ? '&' : '?') + 'v=' + new Date().getTime();
                        }
                        
                        console.log(`History: Original URL from entry: "${entry.image_path}", Corrected & Cache-busted URL for <img> src: "${correctedHistoryImageUrl}"`);
                        img.src = correctedHistoryImageUrl;
                        img.alt = entry.prompt ? `Image for prompt: ${entry.prompt.substring(0,30)}...` : 'History Image';
                        
                        const info = document.createElement('div'); // Define info div earlier to use in onerror
                        info.className = 'image-info';

                        img.onload = function() {
                            console.log("History image loaded successfully:", this.src);
                            // You could remove a loading spinner here if you add one per card
                        };
                        img.onerror = function() {
                            console.error("Failed to load history image. Attempted src:", this.src, "| Original path from history entry:", entry.image_path);
                            this.alt = `Failed to load: ${entry.image_path}`;
                            // Display the failed URL on the card for debugging
                            const errorInfo = document.createElement('p');
                            errorInfo.style.color = 'red';
                            errorInfo.style.fontSize = '10px';
                            errorInfo.style.wordBreak = 'break-all';
                            errorInfo.style.marginTop = '5px';
                            errorInfo.textContent = `Error loading image. Attempted: ${this.src}`;
                            // Prepend error info to the card so it's visible
                            if (card.firstChild) {
                                card.insertBefore(errorInfo, card.firstChild);
                            } else {
                                card.appendChild(errorInfo);
                            }
                        };
                        
                        const promptText = document.createElement('div');
                        promptText.className = 'prompt-text';
                        promptText.textContent = entry.prompt ? (entry.prompt.length > 50 ? 
                                            entry.prompt.substring(0, 50) + '...' : 
                                            entry.prompt) : "No prompt";
                        
                        const timestamp = document.createElement('div');
                        timestamp.className = 'timestamp';
                        const date = new Date(entry.timestamp || (entry.created_at * 1000));
                        timestamp.textContent = date.toLocaleString();
                        
                        info.appendChild(promptText);
                        info.appendChild(timestamp);
                        card.appendChild(img);
                        card.appendChild(info);
                        
                        card.dataset.imageUrl = correctedHistoryImageUrl;
                        card.dataset.originalUrl = entry.image_path;
                        card.dataset.prompt = entry.prompt || "";
                        card.dataset.responseText = entry.response_text || "";
                        card.dataset.timestamp = entry.timestamp;
                        card.dataset.type = entry.type;
                        if (entry.input_image_path) {
                            card.dataset.inputImagePath = fixImagePath(entry.input_image_path);
                        }
                        
                        card.addEventListener('click', function() {
                            openDetailedImageModal(this.dataset);
                        });
                        
                        imagesGrid.appendChild(card);
                    });
                }
            } else {
                console.error('Error loading history from API:', data.message);
                const imagesGrid = document.getElementById('history-images-grid');
                imagesGrid.innerHTML = `<div class="empty-state">Error loading history: ${data.message}</div>`;
            }
        })
        .catch(error => {
            console.error('Network or JSON parsing error loading history:', error);
            const imagesGrid = document.getElementById('history-images-grid');
            imagesGrid.innerHTML = `<div class="empty-state">Network error loading history: ${error.message}</div>`;
        });
}

// Enhanced modal function for detailed view
function openDetailedImageModal(data) {
    console.log("Opening detailed modal with data:", data);
    const modal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    const modalCaption = document.getElementById('modal-caption');
    const modalEditBtn = document.getElementById('modal-edit');

    modalImage.src = data.imageUrl; 
    modalImage.onerror = function() {
        console.error("Failed to load modal image:", data.imageUrl, "Original from dataset:", data.originalUrl);
        this.alt = `Failed to load: ${data.originalUrl || data.imageUrl}`;
    }
    
    let captionHTML = `<h3>${data.type === 'edit' ? 'Edited' : data.type === 'chat' ? 'Chat' : 'Generated'} Image Details</h3>`;
    captionHTML += `<p><strong>Prompt:</strong> ${data.prompt || "N/A"}</p>`;
    
    if (data.responseText) {
        captionHTML += `<p><strong>AI Response:</strong> ${data.responseText}</p>`;
    }
    
    captionHTML += `<p><small>Timestamp: ${new Date(data.timestamp).toLocaleString()}</small></p>`;
    
    if (data.type === 'edit' && data.inputImagePath) {
        captionHTML += `
            <div class="original-image-container">
                <h4>Original Image:</h4>
                <img src="${data.inputImagePath}" alt="Original Image for edit" style="max-height: 150px; margin-top: 10px; border: 1px solid #ccc;">
            </div>
        `;
    }
    
    modalCaption.innerHTML = captionHTML;
    
    modalEditBtn.style.display = (data.type === 'generate' || data.type === 'edit') ? 'inline-block' : 'none';
    
    modal.style.display = 'block';
}

// Modal functionality
function initModal() {
    const modal = document.getElementById('image-modal');
    const closeBtn = document.querySelector('.close-modal');
    const modalImage = document.getElementById('modal-image');
    const modalChatBtn = document.getElementById('modal-chat');
    const modalEditBtn = document.getElementById('modal-edit');
    const modalDownloadBtn = document.getElementById('modal-download');
    
    const chatTabNavLink = document.querySelector('nav a[data-tab="chat"]');
    const chatSectionExists = document.getElementById('chat');
    if (!chatTabNavLink || !chatSectionExists) {
        modalChatBtn.style.display = 'none';
    } else {
        modalChatBtn.addEventListener('click', function() {
            chatTabNavLink.click();
            const imgSrc = modalImage.src;
            const chatImagePreview = document.getElementById('chat-image-preview');
            const chatMsgs = document.getElementById('chat-messages');

            if (chatImagePreview) {
                chatImagePreview.innerHTML = `<img src="${imgSrc}" alt="Chat Image">`;
                chatImagePreview.dataset.imageUrl = imgSrc;
            } else {
                console.warn("Chat image preview element not found when trying to set image from modal.");
            }
            if (chatMsgs) {
                chatMsgs.innerHTML = '<div class="empty-state">Image selected. Start chatting!</div>';
            }
            modal.style.display = 'none';
        });
    }

    closeBtn.addEventListener('click', function() {
        modal.style.display = 'none';
    });
    
    window.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    modalEditBtn.addEventListener('click', function() {
        document.querySelector('nav a[data-tab="edit"]').click();
        
        fetch(modalImage.src)
            .then(res => res.blob())
            .then(blob => {
                const file = new File([blob], "image-to-edit.png", {type: "image/png"});
                
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                
                const fileInput = document.getElementById('edit-image-upload');
                fileInput.files = dataTransfer.files;
                
                const event = new Event('change');
                fileInput.dispatchEvent(event);
                
                modal.style.display = 'none';
            });
    });
    
    modalDownloadBtn.addEventListener('click', function() {
        const link = document.createElement('a');
        link.href = modalImage.src;
        link.download = 'image.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}

// Function to open image modal
function openImageModal(imageUrl, caption = '') {
    const modal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    const modalCaption = document.getElementById('modal-caption');
    
    modalImage.src = fixImagePath(imageUrl);
    modalCaption.textContent = caption;
    
    modal.style.display = 'block';
}
