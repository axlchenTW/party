// matrix.js - 版本 Matrix V1.5.2
// 1. 修復 Modal 關閉後，背景動畫改為「重新初始化」以確保滿版流動效果。
// 2. 修復 Modal 右上角關閉按鈕可能消失的問題。
// 3. 保持循序流水圖片邏輯，確保加速不重置（原地加速）。

// --- 常數設定 ---
const BASE_PATH = 'optimized/'; 
const SHUFFLE_DURATION_MS = 5000; 
const RESULT_HOLD_MS = 1500; 

const DENSITY_RATIO = 0.00004; 
const MIN_THUMB_SIZE = 160;   
const MAX_THUMB_SIZE = 360;  
const IDLE_MIN_DURATION = 15000; 
const IDLE_MAX_DURATION = 30000; 

const SHUFFLE_SPEED_FACTOR = 0.08; 
const STOP_DURATION = 99999999; 

// --- 狀態變數 ---
const button = document.getElementById('randomizeButton');
const matrixContainer = document.getElementById('matrixContainer');
const thumbnailArea = document.getElementById('thumbnailArea'); 
const spinner = document.getElementById('loadingSpinner');
const modal = document.getElementById('modal');
const modalContent = document.getElementById('modalContent');
const modalImage = document.getElementById('modalImage');
const modalCaption = document.getElementById('modalCaption');
const closeButton = document.querySelector('.close');
// --- 常數與變數 (新增音效控制) ---
const shuffleSound = document.getElementById('shuffleSound');
const winSound = document.getElementById('winSound');

let availableIndices = []; 
let totalImages = 0;
let isShuffling = false; 
let runningAnimations = []; 
let imagePointer = 0; 

// ----------------------------------------------------
// I. 圖片生成邏輯
// ----------------------------------------------------

function assignSequentialImage(item) {
    const fileName = imageFiles[imagePointer];
    const img = item.querySelector('.floating-image');
    if (img) {
        img.src = BASE_PATH + fileName;
        img.alt = fileName;
        img.style.transform = `rotate(${Math.random() * 10 - 5}deg)`;
    }
    imagePointer = (imagePointer + 1) % totalImages;
}

function createFloatingImage(isInitial = false) {
    const item = document.createElement('div');
    item.className = 'floating-item';
    const size = MIN_THUMB_SIZE + Math.random() * (MAX_THUMB_SIZE - MIN_THUMB_SIZE);
    
    item.style.width = `${size}px`;
    item.style.height = `${size}px`;
    item.style.left = `${Math.random() * 100}vw`; 
    
    const img = document.createElement('img');
    img.className = 'floating-image';
    item.appendChild(img);
    matrixContainer.appendChild(item);

    assignSequentialImage(item);

    const duration = IDLE_MIN_DURATION + Math.random() * (IDLE_MAX_DURATION - IDLE_MIN_DURATION);
    // 🚨 關鍵：isInitial=true 時，delay 會讓圖片分散在畫面各處
    const delay = isInitial ? (Math.random() * duration * -1) : 0;

    item.style.animationDuration = `${duration}ms`;
    item.style.animationDelay = `${delay}ms`;
    item.style.animationName = 'flowUp';
    item.style.animationTimingFunction = 'linear';
    item.style.animationPlayState = 'running';
    
    item.addEventListener('animationend', () => recycleItem(item));
    return item;
}

function recycleItem(item) {
    assignSequentialImage(item);
    item.style.left = `${Math.random() * 100}vw`;
    
    const baseDuration = IDLE_MIN_DURATION + Math.random() * (IDLE_MAX_DURATION - IDLE_MIN_DURATION);
    const finalDuration = isShuffling ? (baseDuration * SHUFFLE_SPEED_FACTOR) : baseDuration;

    item.style.animationName = 'none';
    void item.offsetWidth;
    item.style.animationName = 'flowUp';
    item.style.animationDuration = `${finalDuration}ms`;
    item.style.animationDelay = '0ms';
    item.style.animationPlayState = 'running';
}

function startMatrixAnimation() {
    // 每次啟動前先清空，確保全新滿版
    matrixContainer.innerHTML = '';
    runningAnimations = [];
    
    const screenArea = window.innerWidth * window.innerHeight;
    const maxItems = Math.max(25, Math.floor(screenArea * DENSITY_RATIO)); 
    
    for (let i = 0; i < maxItems; i++) {
        runningAnimations.push(createFloatingImage(true));
    }
}

// ----------------------------------------------------
// II. 核心變速 Method (用於 GO 加速)
// ----------------------------------------------------

function updateAnimationSpeed(item, newDuration, isEaseOut = false) {
    const flowAnim = item.getAnimations().find(a => a.animationName === 'flowUp');
    if (flowAnim && flowAnim.currentTime !== null) {
        const oldDuration = parseFloat(item.style.animationDuration) || IDLE_MIN_DURATION;
        const currentFraction = (flowAnim.currentTime % oldDuration) / oldDuration;
        const newDelay = -(newDuration * currentFraction);
        
        item.style.animationDuration = `${newDuration}ms`;
        item.style.animationDelay = `${newDelay}ms`;
        item.style.animationTimingFunction = isEaseOut ? 'ease-out' : 'linear';
    }
}

// ----------------------------------------------------
// III. Modal 與 關閉邏輯
// ----------------------------------------------------

function displayRandomImage(finalIndex) { 
// 🔊 播放開獎驚喜音 (鏘鏘！)
    if (winSound) {
        winSound.currentTime = 0;
        winSound.play().catch(e => console.log("音效播放受阻，需使用者互動", e));
    }
        
    // 停止背景所有動作
    runningAnimations.forEach(item => { item.style.animationPlayState = 'paused'; });

    spinner.style.display = 'block';
    const fileName = imageFiles[finalIndex];
    modalImage.src = BASE_PATH + fileName; 
    
    // 🚨 關鍵：先把文字藏起來，並清空內容
    modalCaption.textContent = "猜猜我是誰 ~~";
//    modalCaption.style.opacity = "0"; 

    modalImage.onload = function() {
        spinner.style.display = 'none';
        modal.style.display = 'flex';
        document.body.classList.add('modal-open'); 
        
        const maxWidth = window.innerWidth * 0.9;
        const maxHeight = window.innerHeight * 0.8; 
        modalImage.style.maxWidth = `${maxWidth}px`;
        modalImage.style.maxHeight = `${maxHeight}px`;

        // 🚨 增加一個一次性的點擊事件來顯示名字
        const revealName = () => {
            modalCaption.textContent = `hello : ${fileName}`;
            modalCaption.style.opacity = "1";
            modalCaption.style.transition = "opacity 0.5s ease"; // 增加漸顯效果
            // 顯示名字後，點擊 Modal 才會觸發關閉（移除此監聽避免干擾關閉）
            modal.removeEventListener('click', revealName);
        };

        // 監聽 Modal 點擊來揭曉名字
        modal.addEventListener('click', revealName);
    };
}

function handleCloseModal() {
    modal.style.display = 'none';
    document.body.classList.remove('modal-open'); 
    button.disabled = false;
    isShuffling = false; 

    // 🚨 核心改動：不再原地恢復，而是重新 call startMatrixAnimation 產生滿版效果
    startMatrixAnimation();
}

// ----------------------------------------------------
// IV. 抽獎邏輯 (加速)
// ----------------------------------------------------

function startShuffleAndReveal() {
    if (availableIndices.length === 0) return;
    
    // 🔊 按下 GO，開始播放轉動音 (登登登...)
    if (shuffleSound) {
        shuffleSound.currentTime = 0;
        shuffleSound.play().catch(e => console.log("音效播放受阻", e));
    }

    isShuffling = true; 
    button.disabled = true;
    
    runningAnimations.forEach(item => {
        const currentDur = parseFloat(item.style.animationDuration) || IDLE_MIN_DURATION;
        updateAnimationSpeed(item, currentDur * SHUFFLE_SPEED_FACTOR);
    });
    
    const luckyIdx = Math.floor(Math.random() * availableIndices.length);
    const finalIndex = availableIndices[luckyIdx]; 
    
    setTimeout(() => {

        // 🔇 轉動加速時間結束，停止轉動音
        if (shuffleSound) shuffleSound.pause();

        runningAnimations.forEach(item => {
            updateAnimationSpeed(item, STOP_DURATION, true);
        });
        
        setTimeout(() => {
            availableIndices.splice(luckyIdx, 1);
            button.textContent = availableIndices.length === 0 ? '已抽完' : 'GO!';
            displayRandomImage(finalIndex);
        }, RESULT_HOLD_MS);
    }, SHUFFLE_DURATION_MS);
}

// --- 初始化 ---
function initApp() {
    if (typeof imageFiles === 'undefined') return;
    totalImages = imageFiles.length; 
    availableIndices = Array.from({ length: totalImages }, (_, i) => i);
    thumbnailArea.style.display = 'none'; 
    startMatrixAnimation(); 
    if (document.getElementById('loading-overlay')) {
        document.getElementById('loading-overlay').classList.add('loaded');
    }
}

closeButton.onclick = handleCloseModal;
window.onclick = (e) => { if (e.target == modal) handleCloseModal(); };
window.onload = initApp;
button.addEventListener('click', startShuffleAndReveal);