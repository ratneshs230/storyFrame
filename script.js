// Character counter for textarea
const videoScriptTextarea = document.getElementById('video-script');
const charCount = document.getElementById('char-count');

if (videoScriptTextarea && charCount) {
    videoScriptTextarea.addEventListener('input', () => {
        charCount.textContent = videoScriptTextarea.value.length;
    });
}

// Helper to show errors
function showError(msg) {
    let errorDiv = document.getElementById('error-message');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'error-message';
        errorDiv.style.color = '#ff4444';
        errorDiv.style.marginTop = '1rem';
        errorDiv.style.textAlign = 'center';
        const btn = document.getElementById('submit-btn');
        if (btn) btn.parentNode.insertBefore(errorDiv, btn.nextSibling);
    }
    errorDiv.textContent = msg;
    errorDiv.style.display = 'block';
}

// Form submission handler
const form = document.getElementById('storyboard-form');
const submitBtn = document.getElementById('submit-btn');

if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Reset error
        const errorDiv = document.getElementById('error-message');
        if (errorDiv) errorDiv.style.display = 'none';

        // Get form values
        const videoScript = document.getElementById('video-script').value;
        const videoDuration = document.getElementById('video-duration').value;
        const numImages = document.getElementById('num-images').value;

        // Prepare data for webhook
        const data = {
            videoScript: videoScript,
            videoDuration: parseFloat(videoDuration),
            numImages: parseInt(numImages, 10)
        };

        // Store input data in sessionStorage
        sessionStorage.setItem('storyboardData', JSON.stringify(data));
        sessionStorage.removeItem('generatedImages');

        // Disable submit button
        submitBtn.disabled = true;
        const originalBtnText = submitBtn.querySelector('.btn-text').textContent;
        submitBtn.querySelector('.btn-text').textContent = 'Generating Storyboard...';

        try {
            console.log('Sending request to webhook...');
            // Send POST request to webhook
            const response = await fetch('/api/webhook', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            console.log('Response status:', response.status);

            if (response.ok) {
                // Try to parse response
                try {
                    const text = await response.text();
                    console.log('Raw webhook response:', text); // Log the raw response

                    let images = [];

                    // Parse JSON response
                    try {
                        const jsonData = JSON.parse(text);
                        console.log('Parsed JSON data:', jsonData);

                        if (jsonData.images && Array.isArray(jsonData.images)) {
                            // New format: {images: [{url, title}, ...]}
                            images = jsonData.images;
                        } else if (Array.isArray(jsonData)) {
                            images = jsonData;
                        }
                    } catch (e) {
                        console.log('JSON parse failed:', e);
                    }

                    console.log('Extracted images:', images);

                    if (images.length > 0) {
                        sessionStorage.setItem('generatedImages', JSON.stringify(images));
                    } else {
                        console.warn('No images extracted from response');
                    }
                } catch (e) {
                    console.error('Error parsing response:', e);
                }

                // Redirect to storyboard page
                window.location.href = 'storyboard.html';
            } else {
                const text = await response.text();
                throw new Error(`Webhook request failed: ${response.status} - ${text}`);
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            showError(`Error: ${error.message}`);
            submitBtn.disabled = false;
            submitBtn.querySelector('.btn-text').textContent = originalBtnText;
        }
    });
}
