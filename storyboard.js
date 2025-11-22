// Get storyboard data from sessionStorage
const storyboardData = JSON.parse(sessionStorage.getItem('storyboardData') || '{}');
const preGeneratedImages = JSON.parse(sessionStorage.getItem('generatedImages') || 'null');

// Initialize allImages array for navigation
let allImages = [];

console.log('storyboardData:', storyboardData);
console.log('preGeneratedImages:', preGeneratedImages);

// Update info text
const infoElement = document.getElementById('storyboard-info');
if (storyboardData.numImages) {
    infoElement.textContent = `Generating ${storyboardData.numImages} frames for your ${storyboardData.videoDuration} minute video`;
}

// Display user prompt
const userPromptDiv = document.getElementById('user-prompt');
if (storyboardData.videoScript && userPromptDiv) {
    userPromptDiv.innerHTML = `<span class="user-prompt-label">Prompt</span>${storyboardData.videoScript}`;
}

// Main logic
if (preGeneratedImages && preGeneratedImages.length > 0) {
    // If images were passed from the form submission, display them immediately
    console.log('Displaying images:', preGeneratedImages);
    displayImages(preGeneratedImages);
} else {
    // If no images found, show error (since we don't have polling backend)
    const grid = document.getElementById('storyboard-grid');
    if (grid) {
        grid.innerHTML = '<p style="color: #ff4444; text-align: center; grid-column: 1/-1;">No images found. Please try generating again.</p>';
        grid.style.display = 'grid';
    }
    // Hide loading state if it exists
    const loadingState = document.getElementById('loading-state');
    if (loadingState) loadingState.style.display = 'none';
}

function displayImages(images) {
    const storyboardGrid = document.getElementById('storyboard-grid');
    const loadingState = document.getElementById('loading-state');

    if (!storyboardGrid) return;

    // Store images for navigation
    allImages = images;

    // Show grid and hide loading
    storyboardGrid.style.display = 'grid';
    storyboardGrid.innerHTML = '';
    if (loadingState) loadingState.style.display = 'none';

    images.forEach((image, index) => {
        // Handle both object format {url, title} and string format
        const imageUrl = typeof image === 'string' ? image : image.url;
        const imageTitle = typeof image === 'string' ? `Frame ${index + 1}` : (image.title || `Frame ${index + 1}`);

        console.log(`Image ${index + 1}:`, imageTitle, imageUrl);

        const frameDiv = document.createElement('div');
        frameDiv.className = 'storyboard-frame';
        frameDiv.style.animationDelay = (index * 0.1) + 's';

        frameDiv.innerHTML = `
            <img src="${imageUrl}" alt="${imageTitle}" class="frame-image" loading="lazy" onerror="console.error('Failed to load image:', '${imageUrl}')">
            <div class="frame-info">
                <p class="frame-title">${imageTitle}</p>
                <p class="frame-number">Frame ${index + 1} of ${images.length}</p>
            </div>
        `;

        // Add click handler for modal
        frameDiv.addEventListener('click', () => openModal(imageUrl, index + 1, imageTitle));

        storyboardGrid.appendChild(frameDiv);
    });
}

// Modal functionality
const modal = document.getElementById('image-modal');
const modalImage = document.getElementById('modal-image');
const closeModalBtn = document.getElementById('close-modal');
const exportBtn = document.getElementById('export-btn');
const exportMenu = document.getElementById('export-menu');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send');
const chatMessages = document.getElementById('chat-messages');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');

let currentImageUrl = '';
let currentFrameIndex = 0;
let currentTitle = '';

function openModal(imageUrl, frameIndex, title = '') {
    currentImageUrl = imageUrl;
    currentFrameIndex = frameIndex;
    currentTitle = title;
    modalImage.src = imageUrl;
    modalImage.alt = title;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    updateNavButtons();
}

function updateNavButtons() {
    prevBtn.disabled = currentFrameIndex <= 1;
    nextBtn.disabled = currentFrameIndex >= allImages.length;
}

function navigatePrev() {
    if (currentFrameIndex > 1) {
        currentFrameIndex--;
        const image = allImages[currentFrameIndex - 1];
        currentImageUrl = typeof image === 'string' ? image : image.url;
        currentTitle = typeof image === 'string' ? `Frame ${currentFrameIndex}` : (image.title || `Frame ${currentFrameIndex}`);
        modalImage.src = currentImageUrl;
        modalImage.alt = currentTitle;
        updateNavButtons();
    }
}

function navigateNext() {
    if (currentFrameIndex < allImages.length) {
        currentFrameIndex++;
        const image = allImages[currentFrameIndex - 1];
        currentImageUrl = typeof image === 'string' ? image : image.url;
        currentTitle = typeof image === 'string' ? `Frame ${currentFrameIndex}` : (image.title || `Frame ${currentFrameIndex}`);
        modalImage.src = currentImageUrl;
        modalImage.alt = currentTitle;
        updateNavButtons();
    }
}

// Navigation event listeners
prevBtn.addEventListener('click', navigatePrev);
nextBtn.addEventListener('click', navigateNext);

function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
    exportMenu.classList.remove('active');
}

// Close modal
closeModalBtn.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
    if (modal.classList.contains('active')) {
        if (e.key === 'ArrowLeft') navigatePrev();
        if (e.key === 'ArrowRight') navigateNext();
    }
});

// Export functionality
exportBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportMenu.classList.toggle('active');
});

document.addEventListener('click', (e) => {
    if (!exportBtn.contains(e.target)) {
        exportMenu.classList.remove('active');
    }
});

exportMenu.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', async () => {
        const format = btn.dataset.format;
        await exportImage(format);
        exportMenu.classList.remove('active');
    });
});

async function exportImage(format) {
    try {
        // Fetch the image
        const response = await fetch(currentImageUrl);
        const blob = await response.blob();

        // Create canvas to convert format
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            // Convert to desired format
            let mimeType = 'image/png';
            let extension = 'png';
            if (format === 'jpg') {
                mimeType = 'image/jpeg';
                extension = 'jpg';
            } else if (format === 'webp') {
                mimeType = 'image/webp';
                extension = 'webp';
            }

            canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `storyboard-frame-${currentFrameIndex}.${extension}`;
                a.click();
                URL.revokeObjectURL(url);
            }, mimeType, 0.95);
        };

        img.src = URL.createObjectURL(blob);
    } catch (error) {
        console.error('Export failed:', error);
        alert('Failed to export image. Please try again.');
    }
}

// Chat functionality
chatSendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    // Add user message
    addChatMessage(message, 'user');
    chatInput.value = '';

    // Simulate assistant response (placeholder for actual API integration)
    setTimeout(() => {
        addChatMessage('Refinement feature coming soon! Your request: "' + message + '" has been noted for Frame ' + currentFrameIndex + '.', 'assistant');
    }, 500);
}

function addChatMessage(text, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}`;
    messageDiv.textContent = text;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
