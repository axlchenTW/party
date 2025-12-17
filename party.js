// party.js - 版本 v7.6 (起迄點正確，但動畫結束後有閃爍)

// 🚨 V6.5 修正：將變數定義放在這裡，避免 const 衝突
const BASE_PATH = 'optimized/'; 
const SHUFFLE_DURATION_MS = 3000; 
const TRANSITION_DURATION_MS = 500; // FLIP 動畫持續時間 (0.5s)

// 速度控制常數
const DISPLAY_HOLD_MS = 100;    
const FAST_INTERVAL_MS = 30;    
const SLOW_INTERVAL_MS = 300;   
const SLOWDOWN_START_MS = 1800; 
const RESULT_HOLD_MS = 800;    
const RESULT_FLASH_COUNT = 3;   
const RESULT_FLASH_INTERVAL = RESULT_HOLD_MS / (RESULT_FLASH_COUNT * 2); 

// 取得 DOM 元素
const button = document.getElementById('randomizeButton');
const thumbnailArea = document.getElementById('thumbnailArea');
const spinner = document.getElementById('loadingSpinner');
const modal = document.getElementById('modal');
const modalContent = document.getElementById('modalContent');
const modalContentWrapper = document.getElementById('modalContentWrapper'); 
const modalImage = document.getElementById('modalImage');
const modalCaption = document.getElementById('modalCaption');
const closeButton = document.querySelector('.close');

let lastIndex = -1;
let allThumbnails = []; 

// 追蹤已選和可選的圖片索引 
let availableIndices = []; 
let selectedIndices = []; 

// 載入計數器和 DOM
let loadedCount = 0;
let totalImages = 0;
const loadingOverlay = document.getElementById('loading-overlay');

// ----------------------------------------------------
// I. 最大邊長 K 的精確計算函數 
// ----------------------------------------------------
function calculateMaxK(W, H, N) {
    if (N <= 0 || W <= 0 || H <= 0) return 0;

    let low = 0;
    let high = Math.min(W, H); 
    let maxK = 0;
    const iterations = 100; 
    
    const gap = 6; 

    for (let i = 0; i < iterations; i++) {
        const midK = (low + high) / 2;

        if (midK <= 0.0001) { 
            break;
        }

        const countC = Math.floor((W + gap) / (midK + gap)); 

        if (countC === 0) { 
            high = midK;
            continue;
        }

        const requiredR = Math.ceil(N / countC);
        
        const H_required = requiredR * midK + (requiredR - 1) * gap;

        if (H_required <= H) {
            maxK = midK;
            low = midK; 
        } else {
            high = midK;
        }
    }
    
    return maxK;
}


// ----------------------------------------------------
// II. 調整 Grid 佈局函數
// ----------------------------------------------------
function adjustThumbnailGrid() {
    if (allThumbnails.length === 0) return;
    
    const headerHeight = document.getElementById('header').offsetHeight;
    const verticalPadding = 40; 
    const horizontalPadding = 40; 
    const safetyMargin = 0.95;  

    const W_full = window.innerWidth;
    const W_available = (W_full - horizontalPadding) * safetyMargin; 
    
    const H_available = (window.innerHeight - headerHeight - verticalPadding) * safetyMargin;
    
    const N = imageFiles.length; // 使用 imageFiles.length 而非 allThumbnails.length 確保總數正確
    
    const maxK = calculateMaxK(W_available, H_available, N);
    
    if (maxK > 0) {
        const gap = 6;
        
        const countC = Math.floor((W_available + gap) / (maxK + gap)); 
        
        thumbnailArea.style.gridTemplateColumns = `repeat(${countC}, ${maxK}px)`;
        
        thumbnailArea.style.justifyContent = 'center'; 
        
        thumbnailArea.style.maxHeight = `${window.innerHeight - headerHeight - verticalPadding}px`;
        thumbnailArea.style.overflowY = 'auto'; 

        thumbnailArea.style.gridGap = `${gap}px`;
    } 
}

// ----------------------------------------------------
// III. Modal 尺寸固定
// ----------------------------------------------------
function setModalFinalState() {
    // 這裡依賴 CSS 的 Flexbox (Modal) 和 translate(-50%, -50%) (ModalContent) 進行居中
    
    const maxContentW = window.innerWidth * 0.9;
    const maxContentH = window.innerHeight * 0.95; 

    const modalWrapperPadding = 20; 
    const captionMarginTop = 10; 

    modalContent.style.maxWidth = `${maxContentW}px`; 
    modalContent.style.maxHeight = `${maxContentH}px`;
    modalContent.style.width = 'fit-content'; 
    modalContent.style.height = 'fit-content'; 
    
    modalImage.style.width = 'auto'; 
    modalImage.style.height = 'auto'; 
    
    // 確保在計算 L 狀態前，沒有 transform
    modalContent.style.transition = 'none'; 
    modalContent.style.transform = 'none'; // 讓 Flexbox 決定位置
    
    modal.classList.add('transition-done'); 
    
    const captionHeight = modalCaption.offsetHeight; 
    const imageMaxH = maxContentH - modalWrapperPadding - captionMarginTop - captionHeight;
    const imageMaxW = maxContentW - modalWrapperPadding;

    const originalWidth = modalImage.naturalWidth;
    const originalHeight = modalImage.naturalHeight;

    const scaleFactorW = imageMaxW / originalWidth;
    const scaleFactorH = imageMaxH / originalHeight;

    const finalScale = Math.min(scaleFactorW, scaleFactorH); 

    const finalWidth = originalWidth * finalScale;
    const finalHeight = originalHeight * finalScale;

    modalImage.style.width = `${finalWidth}px`;
    modalImage.style.height = `${finalHeight}px`;

    const finalContentRect = modalContent.getBoundingClientRect();
    
    modal.classList.remove('transition-done'); 

    return finalContentRect;
}


// ----------------------------------------------------
// IV. 轉場動畫核心函數 (FLIP) - V7.6 原始邏輯
// ----------------------------------------------------
function performTransition(startIndex) {
    const startThumbnail = allThumbnails[startIndex];
    
    // 1. First State 捕捉準備 (F)
    startThumbnail.style.transition = 'none';
    startThumbnail.style.transform = 'none'; 
    void startThumbnail.offsetWidth; 

    const startRect = startThumbnail.getBoundingClientRect(); 

    modal.style.display = 'flex';
    modal.classList.add('pre-transition'); 
    document.body.classList.add('modal-open');
    
    // 2. Last State 計算 (L)
    const finalContentRect = setModalFinalState(); 
    
    startThumbnail.style.opacity = 0; 
        
    // 3. Invert 計算 (I)
    const scaleX = startRect.width / finalContentRect.width;
    const scaleY = startRect.height / finalContentRect.height;
    const translateX = startRect.left - finalContentRect.left;
    const translateY = startRect.top - finalContentRect.top;
    
    modalContent.style.transition = 'none'; 
    modalContent.style.transform = `translate(${translateX}px, ${translateY}px) scaleX(${scaleX}) scaleY(${scaleY})`;
    
    modalImage.style.borderRadius = '6px';
    
    void modalContent.offsetWidth; // 觸發重排 (Play)

    // 4. Play (P)
    requestAnimationFrame(() => {
        modalContent.style.transition = `transform ${TRANSITION_DURATION_MS}ms ease-in-out, border-radius ${TRANSITION_DURATION_MS}ms ease-in-out`;
        modalContent.style.transform = 'none'; // 恢復到最終居中位置
        
        modalImage.style.borderRadius = '8px';
        
        modal.classList.remove('pre-transition'); 
    });

    // V7.6 的問題點：這個 setTimeout 結束時強制設定 transform: none 造成閃爍
    setTimeout(() => {
        modal.classList.add('transition-done');
        
        // 🚨 造成閃爍的原因：強制設定 transform: none (雖然動畫應該已經完成)
        modalContent.style.transition = 'none'; 
        modalContent.style.transform = 'none'; 
        
        // 恢復縮圖的懸停過渡
        startThumbnail.style.transition = ''; 
    }, TRANSITION_DURATION_MS + 50); // 50ms 緩衝時間
}

function handleCloseModal(startIndex) {
    modal.classList.remove('transition-done');

    const startThumbnail = allThumbnails[startIndex];

    // First State 準備
    startThumbnail.style.transition = 'none';
    startThumbnail.style.transform = 'none'; 
    void startThumbnail.offsetWidth;

    const finalContentRect = setModalFinalState(); // Last State

    const startRect = startThumbnail.getBoundingClientRect(); // First State
    
    const scaleX = startRect.width / finalContentRect.width;
    const scaleY = startRect.height / finalContentRect.height;
    const translateX = startRect.left - finalContentRect.left;
    const translateY = startRect.top - finalContentRect.top;
    
    // Invert
    // 確保 Content 已經在最終狀態 (Last State) 上
    modalContent.style.transition = 'none';
    modalContent.style.transform = 'none';
    void modalContent.offsetWidth; 
    
    // Play (回到 First State)
    modalContent.style.transition = `transform ${TRANSITION_DURATION_MS}ms ease-in-out, border-radius ${TRANSITION_DURATION_MS}ms ease-in-out`;
    modalContent.style.transform = `translate(${translateX}px, ${translateY}px) scaleX(${scaleX}) scaleY(${scaleY})`;
    modalImage.style.borderRadius = '6px'; 
    
    modalContent.addEventListener('transitionend', function handler() {
        modalContent.removeEventListener('transitionend', handler);
        
        modal.style.display = 'none';
        document.body.classList.remove('modal-open'); 
        
        if (startThumbnail) {
            startThumbnail.style.opacity = 1;
            startThumbnail.style.transition = ''; 
        }

        // 重置 Modal 樣式
        modalContent.style.transition = 'none';
        modalContent.style.transform = 'none';
        modalImage.style.borderRadius = '8px';
        modal.classList.remove('pre-transition');

        if (availableIndices.length > 0) {
             button.disabled = false;
        }

        window.removeEventListener('resize', setModalFinalState); 
    });
}

// ----------------------------------------------------
// V. 載入、動畫與事件邏輯 (保持不變)
// ----------------------------------------------------

function checkLoadComplete() {
    loadedCount++;
    
    if (loadedCount === totalImages) {
        setTimeout(() => {
            adjustThumbnailGrid();
            if (loadingOverlay) {
                loadingOverlay.classList.add('loaded');
            }
        }, 50);
    }
}


function loadThumbnails() {
    thumbnailArea.innerHTML = ''; 
    allThumbnails = []; 
    loadedCount = 0; 
    
    if (typeof imageFiles === 'undefined' || imageFiles.length === 0) {
        thumbnailArea.innerHTML = '<p style="text-align: center; color: #d32f2f; font-size: 1.2em;">❌ 錯誤：imageFiles 陣列為空或未定義！</p>';
        if (loadingOverlay) {
            loadingOverlay.classList.add('loaded'); 
        }
        return;
    }
    
    availableIndices = Array.from({ length: imageFiles.length }, (_, i) => i);
    selectedIndices = [];
    button.textContent = 'GO!';
    button.disabled = false;
    
    totalImages = imageFiles.length; 

    imageFiles.forEach((fileName, index) => {
        const fullPath = BASE_PATH + fileName;
        
        const item = document.createElement('div');
        item.className = 'thumbnail-item';
        item.setAttribute('data-index', index); 
        item.onclick = (e) => showModal(fullPath, fileName, index, e); 
        
        const img = document.createElement('img');
        img.className = 'thumbnail-image';
        img.alt = fileName;
        
        img.onload = function() {
            img.classList.add('image-loaded'); 
            checkLoadComplete();
        };

        img.onerror = function() {
            img.classList.add('image-loaded');
            item.style.backgroundColor = '#FFDDEE'; 
            item.title = `載入失敗: ${fileName}`;
            checkLoadComplete();
        };

        img.src = fullPath; 

        if (img.complete) {
            img.classList.add('image-loaded');
            checkLoadComplete();
        }
        
        item.appendChild(img);
        thumbnailArea.appendChild(item);
        allThumbnails.push(item);
    });
    
    
    setTimeout(() => {
        if (loadedCount < totalImages) {
            loadedCount = totalImages; 
            
            adjustThumbnailGrid();
            if (loadingOverlay) {
                loadingOverlay.classList.add('loaded');
            }
        }
    }, 1000); 
}


function startShuffleAnimation() {
    if (imageFiles.length === 0) {
        alert('請先在 imageFiles 陣列中設定圖片檔名！');
        button.disabled = false;
        return;
    }
    
    if (availableIndices.length === 0) {
        alert('所有圖片都已被選中，無法再次抽獎！');
        button.disabled = true;
        return;
    }
    
    button.disabled = true;
    
    let lastShuffledIndex = -1;
    const finalIndex = getRandomImageIndex(); 
    
    const startTime = Date.now();

    allThumbnails.forEach(item => {
        const img = item.querySelector('.thumbnail-image');
        if (img) {
            if (!item.classList.contains('drawn-item')) {
                 img.classList.remove('image-loaded'); 
                 img.classList.add('dimmed-image'); 
                 img.style.opacity = ''; 
            }
            item.classList.remove('selected-item'); 
        }
    });


    function shuffleStep() {
        const elapsed = Date.now() - startTime;
        let baseInterval = FAST_INTERVAL_MS; 

        if (elapsed > SLOWDOWN_START_MS) {
            const timeSinceSlowdown = elapsed - SLOWDOWN_START_MS;
            const slowdownDuration = SHUFFLE_DURATION_MS - SLOWDOWN_START_MS;
            
            const factor = Math.min(1, timeSinceSlowdown / slowdownDuration); 
            
            baseInterval = FAST_INTERVAL_MS + factor * (SLOW_INTERVAL_MS - FAST_INTERVAL_MS);
        }
        
        const currentInterval = DISPLAY_HOLD_MS + baseInterval;

        if (lastShuffledIndex !== -1 && allThumbnails[lastShuffledIndex]) {
            const lastItem = allThumbnails[lastShuffledIndex];
            const lastImg = lastItem.querySelector('.thumbnail-image');

            lastItem.classList.remove('selected-item');
            
            if (lastImg) {
                if (!lastItem.classList.contains('drawn-item')) {
                    lastImg.classList.add('dimmed-image'); 
                    lastImg.style.opacity = ''; 
                }
            }
        }
        
        let randomIndex;
        if (elapsed < SHUFFLE_DURATION_MS - currentInterval) {
            const randomIndexInAvailable = Math.floor(Math.random() * availableIndices.length);
            randomIndex = availableIndices[randomIndexInAvailable];
            
        } else {
            randomIndex = finalIndex;
        }

        if (allThumbnails[randomIndex]) {
            const currentItem = allThumbnails[randomIndex];
            const currentImg = currentItem.querySelector('.thumbnail-image');

            currentItem.classList.add('selected-item');

            if (currentImg) {
                currentImg.classList.remove('dimmed-image'); 
                currentImg.style.opacity = 1.0; 
            }
        }
        lastShuffledIndex = randomIndex;

        if (elapsed < SHUFFLE_DURATION_MS - currentInterval) {
            setTimeout(shuffleStep, currentInterval);
        } else {
            startFinalFlash(finalIndex);
        }
    }
    
    shuffleStep();
}

function startFinalFlash(index) {
    const finalItem = allThumbnails[index];
    const finalImg = finalItem.querySelector('.thumbnail-image');
    let flashCount = 0;
    
    const finalFlashInterval = setInterval(() => {
        if (flashCount % 2 === 0) {
            finalItem.classList.add('selected-item');
            if (finalImg) {
                finalImg.classList.remove('dimmed-image'); 
                finalImg.style.opacity = 1.0; 
            }
        } 
        else {
            finalItem.classList.remove('selected-item');
            if (finalImg) {
                finalImg.classList.add('dimmed-image');
                finalImg.style.opacity = ''; 
            }
        }

        flashCount++;

        if (flashCount > RESULT_FLASH_COUNT * 2) {
            clearInterval(finalFlashInterval);
            endShuffleAndDisplay(index);
        }
    }, RESULT_FLASH_INTERVAL);
}

function endShuffleAndDisplay(finalIndex) {
    const finalItem = allThumbnails[finalIndex];
    const finalImg = finalItem.querySelector('.thumbnail-image');
    
    finalItem.classList.add('selected-item');
    if (finalImg) {
        finalImg.classList.remove('dimmed-image');
        finalImg.classList.add('image-loaded'); 
        finalImg.style.opacity = ''; 
    }
    
    finalItem.classList.add('drawn-item');
    
    const indexToRemove = availableIndices.indexOf(finalIndex);
    if (indexToRemove > -1) {
        availableIndices.splice(indexToRemove, 1);
        selectedIndices.push(finalIndex); 
    }
    
    allThumbnails.forEach((item, index) => {
        if (index !== finalIndex) {
            const img = item.querySelector('.thumbnail-image');
             if (img) {
                 if (!item.classList.contains('drawn-item')) {
                    img.classList.remove('dimmed-image'); 
                    img.classList.add('image-loaded'); 
                    img.style.opacity = ''; 
                 }
             }
             item.classList.remove('selected-item');
        }
    });
    
    if (availableIndices.length === 0) {
        button.textContent = '已抽完';
    }
    
    setTimeout(() => {
        finalItem.classList.remove('selected-item');
        const fullPath = BASE_PATH + imageFiles[finalIndex];
        
        displayRandomImage(finalIndex, fullPath); 
    }, RESULT_HOLD_MS);
}


function displayRandomImage(finalIndex, fullPath) {
    spinner.style.display = 'block';

    const fileName = imageFiles[finalIndex];
    
    modalImage.style.opacity = 0;
    
    modalImage.src = fullPath; 
    modalCaption.textContent = `抽獎結果: ${fileName}`;
    
    modalImage.onload = function() {
        spinner.style.display = 'none';
        
        performTransition(finalIndex); 
        
        modalImage.style.opacity = 1;
    };

    modalImage.onerror = function() {
        spinner.style.display = 'none';
        alert(`❌ 圖片載入失敗！\n請檢查檔名和路徑：${fullPath}`);
        button.disabled = false;
    };
}


function showModal(path, caption, index, event) {
    if (event && allThumbnails[index].classList.contains('drawn-item')) {
        return; 
    }
    
    button.disabled = true;

    modalImage.style.opacity = 0;

    modalImage.src = path;
    modalCaption.textContent = caption;
    
    modalImage.onload = () => {
        performTransition(index);
        
        modalImage.style.opacity = 1;
    };
}

function getRandomImageIndex() {
    if (availableIndices.length === 0) {
        return -1;
    }
    
    const randomIndexInAvailable = Math.floor(Math.random() * availableIndices.length);
    const finalImageIndex = availableIndices[randomIndexInAvailable];
    
    return finalImageIndex;
}

function getOpenedThumbnailIndex() {
    return Array.from(allThumbnails).findIndex(item => item.style.opacity === '0');
}

closeButton.onclick = function() {
    const openedThumbnailIndex = getOpenedThumbnailIndex();
    if (openedThumbnailIndex !== -1) {
        handleCloseModal(openedThumbnailIndex);
    }
}

window.onclick = function(event) {
    if (event.target == modal) {
        const openedThumbnailIndex = getOpenedThumbnailIndex();
        if (openedThumbnailIndex !== -1) {
            handleCloseModal(openedThumbnailIndex);
        }
    }
}

// --- 初始化與事件監聽 ---
window.onload = function() {
    const modalElement = document.getElementById('modal');
    if (modalElement && modalElement.style.display !== 'none') {
        modalElement.style.display = 'none';
    }
    
    loadThumbnails();
};

window.addEventListener('resize', adjustThumbnailGrid);
button.addEventListener('click', startShuffleAnimation);