// Toast Notification System
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'info';
    if(type === 'success') icon = 'check_circle';
    if(type === 'error') icon = 'error';

    toast.innerHTML = `
        <span class="material-symbols-outlined">${icon}</span>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-hide');
        toast.addEventListener('animationend', () => toast.remove());
    }, 3500);
}

// Autocomplete System
function setupAutocomplete(inputId, callback) {
    const input = document.getElementById(inputId);
    if(!input) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'autocomplete-wrapper';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const suggestionsBox = document.createElement('div');
    suggestionsBox.className = 'autocomplete-suggestions';
    wrapper.appendChild(suggestionsBox);

    let debounceTimer;
    
    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const q = input.value.trim();
        
        if(q.length < 2) {
            suggestionsBox.style.display = 'none';
            return;
        }
        
        debounceTimer = setTimeout(async () => {
            try {
                const res = await fetch(`${API_BASE}/search?q=${q}`);
                const data = await res.json();
                
                if(data.length > 0) {
                    suggestionsBox.innerHTML = '';
                    data.forEach(item => {
                        const div = document.createElement('div');
                        div.className = 'suggestion-item';
                        div.innerHTML = `
                            <span class="suggestion-name">${item.name}</span>
                            <span class="suggestion-ticker">${item.ticker}</span>
                        `;
                        div.addEventListener('click', () => {
                            input.value = item.ticker;
                            suggestionsBox.style.display = 'none';
                            if(callback) callback(item.ticker);
                        });
                        suggestionsBox.appendChild(div);
                    });
                    suggestionsBox.style.display = 'flex';
                } else {
                    suggestionsBox.style.display = 'none';
                }
            } catch(e) {
                console.error(e);
            }
        }, 300);
    });

    document.addEventListener('click', (e) => {
        if(!wrapper.contains(e.target)) {
            suggestionsBox.style.display = 'none';
        }
    });
}

// Utility functions
const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
};

const formatPercent = (value) => {
    return (value > 0 ? '+' : '') + value.toFixed(2) + '%';
};

// Global variables for charts
let portfolioChartInstance = null;
let predictionChartInstance = null;
let API_BASE = 'http://127.0.0.1:5000/api';
if ((window.location.hostname !== '127.0.0.1' && window.location.hostname !== 'localhost' && window.location.protocol !== 'file:') || window.location.port === '5000') {
    API_BASE = '/api';
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    // Check Login Security
    const token = localStorage.getItem('investools_token');
    if(token) {
        document.getElementById('login-overlay').style.display = 'none';
        initializeApp();
    } else {
        const btnLogin = document.getElementById('btn-login');
        if(btnLogin) {
            btnLogin.addEventListener('click', async () => {
                const u = document.getElementById('login-username').value;
                const p = document.getElementById('login-password').value;
                
                btnLogin.innerText = "Memverifikasi...";
                try {
                    const res = await fetch(`${API_BASE}/login`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({username: u, password: p})
                    });
                    const data = await res.json();
                    if(data.success) {
                        localStorage.setItem('investools_token', data.token);
                        document.getElementById('login-overlay').style.display = 'none';
                        showToast('Login Berhasil!', 'success');
                        initializeApp();
                    } else {
                        showToast(data.message, 'error');
                    }
                } catch(e) {
                    showToast('Gagal terhubung ke server', 'error');
                } finally {
                    btnLogin.innerText = "Login & Akses Platform";
                }
            });
        }
    }
});

function initializeApp() {
    initNavigation();
    initTradingView();
    initSmartWatchlist();
    initScreener();
    initValuation();
    initPrediction();
    // Init IHSG and Clock
    fetchIHSG();
    setInterval(fetchIHSG, 60000); // Update IHSG setiap 1 menit
    
    setInterval(updateClock, 1000);
    updateClock();
    
    // Init Autocomplete
    setupAutocomplete('global-search', () => {
        const input = document.getElementById('global-search');
        input.dispatchEvent(new KeyboardEvent('keypress', {'key': 'Enter'}));
    });
    setupAutocomplete('sw-input', () => {
        const btn = document.getElementById('btn-add-sw');
        if(btn) btn.click();
    });
    setupAutocomplete('val-ticker', () => {
        const btn = document.getElementById('btn-fetch-price');
        if(btn) btn.click();
    });
    setupAutocomplete('pred-ticker', () => {
        const btn = document.getElementById('btn-predict');
        if(btn) btn.click();
    });
    
    // Logout Logic
    const btnLogout = document.getElementById('btn-logout');
    if(btnLogout) {
        btnLogout.addEventListener('click', () => {
            localStorage.removeItem('investools_token');
            location.reload();
        });
    }

    // Mobile Hamburger Menu Logic
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebarContent = document.getElementById('sidebar-content');
    if (mobileMenuBtn && sidebarContent) {
        mobileMenuBtn.addEventListener('click', (e) => {
            e.preventDefault();
            sidebarContent.classList.toggle('show');
        });
        
        // Tutup jika klik menu navigasi
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                sidebarContent.classList.remove('show');
            });
        });
        
        // Tutup jika klik di luar area
        document.addEventListener('click', (e) => {
            if(!mobileMenuBtn.contains(e.target) && !sidebarContent.contains(e.target)) {
                sidebarContent.classList.remove('show');
            }
        });
    }

    // Theme Toggle Logic
    const themeBtn = document.getElementById('btn-theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    
    if(localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-theme');
        if(themeIcon) themeIcon.innerText = 'dark_mode';
    }
    
    if(themeBtn) {
        themeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            document.body.classList.toggle('light-theme');
            const isLight = document.body.classList.contains('light-theme');
            localStorage.setItem('theme', isLight ? 'light' : 'dark');
            if(themeIcon) themeIcon.innerText = isLight ? 'dark_mode' : 'light_mode';
            
            // Reload TradingView with new theme
            const tvContainer = document.getElementById('tv-chart-container');
            const currentTicker = tvContainer ? (tvContainer.getAttribute('data-current-ticker') || 'IDX:COMPOSITE') : 'IDX:COMPOSITE';
            updateTradingView(currentTicker);
            
            showToast(`Berganti ke ${isLight ? 'Light Mode' : 'Dark Mode'}`, 'info');
        });
    }
    setupAutocomplete('screener-search', async (ticker) => {
        try {
            showToast(`Menarik data ${ticker}...`, 'info');
            const res = await fetch(`${API_BASE}/price?ticker=${ticker}`);
            if(!res.ok) throw new Error();
            const data = await res.json();
            if(data.error) throw new Error(data.error);
            
            const exists = screenerData.find(s => s.ticker === data.ticker);
            if(!exists) {
                screenerData.unshift({
                    ticker: data.ticker,
                    name: data.name,
                    sector: 'Pencarian Kustom',
                    price: data.current_price,
                    change: data.change,
                    volume: data.volume
                });
            }
            document.getElementById('screener-search').value = '';
            renderScreenerTable(screenerData);
            showToast(`${ticker} ditambahkan ke tabel!`, 'success');
        } catch(e) {
            showToast('Gagal menarik data saham tersebut', 'error');
        }
    });
}

// Navigation Logic
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const panels = document.querySelectorAll('.panel');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            navItems.forEach(nav => nav.classList.remove('active'));
            panels.forEach(panel => panel.classList.remove('active'));
            
            item.classList.add('active');
            const targetId = item.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
            
            // No more portfolio chart
            if(targetId === 'prediction' && predictionChartInstance) {
                predictionChartInstance.update();
            }
        });
    });
}

// Chart.js Default Config
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = 'rgba(255,255,255,0.05)';
Chart.defaults.font.family = "'Inter', sans-serif";

// TradingView Widget Injection
function initTradingView() {
    const container = document.getElementById('tv-chart-container');
    if (!container) return;
    container.innerHTML = '';
    
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/tv.js';
    script.onload = () => {
        new TradingView.widget({
            "autosize": true,
            "symbol": "IDX:COMPOSITE",
            "interval": "D",
            "timezone": "Asia/Jakarta",
            "theme": "dark",
            "style": "1",
            "locale": "id",
            "enable_publishing": false,
            "backgroundColor": "#141414",
            "gridColor": "#1f1f1f",
            "hide_top_toolbar": false,
            "hide_legend": false,
            "save_image": false,
            "container_id": "tv-chart-container"
        });
    };
    container.appendChild(script);
}

// Smart Watchlist Logic
let smartWatchlist = ['BBCA', 'BBRI', 'TLKM', 'BMRI', 'AAPL'];

async function renderSmartWatchlist() {
    const tbody = document.getElementById('sw-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">Memuat Harga...</td></tr>';
    
    let html = '';
    for (const ticker of smartWatchlist) {
        try {
            const response = await fetch(`${API_BASE}/price?ticker=${ticker}`);
            if (response.ok) {
                const data = await response.json();
                
                const isIDR = ticker.length === 4;
                const formatVal = (val) => isIDR ? formatCurrency(val) : `$${val.toFixed(2)}`;
                
                const isPos = data.change > 0;
                const changeClass = isPos ? 'positive' : 'negative';
                const changeStr = (isPos ? '+' : '') + data.change + '%';
                
                html += `
                    <tr>
                        <td class="ticker-cell" onclick="updateTradingView('${ticker}')" style="cursor:pointer;" title="Klik untuk lihat chart">${data.ticker}</td>
                        <td style="font-size: 14px; color: var(--text-muted);">${data.name || '-'}</td>
                        <td style="font-weight:600; color:${isPos ? '#10b981' : 'var(--danger)'};">${formatVal(data.current_price)}</td>
                        <td><span class="badge ${changeClass}">${changeStr}</span></td>
                        <td style="color:var(--text-muted)">${data.volume}</td>
                        <td><button class="action-btn" onclick="removeSW('${ticker}')" style="background:rgba(239,68,68,0.1); color:var(--danger)">Hapus</button></td>
                    </tr>
                `;
            }
        } catch(e) {
            console.error(e);
        }
    }
    
    tbody.innerHTML = html || '<tr><td colspan="6" style="text-align:center;">Data kosong</td></tr>';
}

function initSmartWatchlist() {
    renderSmartWatchlist();
    setInterval(renderSmartWatchlist, 60000); // Update harga watchlist setiap 1 menit
    
    const input = document.getElementById('sw-input');
    const btn = document.getElementById('btn-add-sw');
    
    const addAction = () => {
        const val = input.value.trim().toUpperCase();
        if(val) {
            if(!smartWatchlist.includes(val)) {
                smartWatchlist.push(val);
                renderSmartWatchlist();
            }
            input.value = '';
            updateTradingView(val);
        }
    };
    
    if(btn) btn.addEventListener('click', addAction);
    if(input) input.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') addAction();
    });

    // Global Search (Bagian atas layar)
    const globalSearch = document.getElementById('global-search');
    if(globalSearch) {
        globalSearch.addEventListener('keypress', (e) => {
            if(e.key === 'Enter') {
                const val = globalSearch.value.trim().toUpperCase();
                if(val) {
                    if(!smartWatchlist.includes(val)) {
                        smartWatchlist.push(val);
                        renderSmartWatchlist();
                    }
                    globalSearch.value = '';
                    // Otomatis pindah ke dashboard
                    document.querySelector('.nav-item[data-target="dashboard"]').click();
                    updateTradingView(val);
                }
            }
        });
    }
}

window.removeSW = function(ticker) {
    smartWatchlist = smartWatchlist.filter(t => t !== ticker);
    renderSmartWatchlist();
}

window.addToWatchlist = function(ticker) {
    if(!smartWatchlist.includes(ticker)) {
        smartWatchlist.push(ticker);
        renderSmartWatchlist();
        showToast(`${ticker} berhasil ditambahkan ke Smart Watchlist di Dashboard!`, 'success');
    } else {
        showToast(`${ticker} sudah ada di Smart Watchlist!`, 'info');
    }
}

window.updateTradingView = function(ticker) {
    // Simpan ticker saat ini agar tidak hilang saat ganti tema
    const tvContainer = document.getElementById('tv-chart-container');
    if (tvContainer) tvContainer.setAttribute('data-current-ticker', ticker);

    // TradingView butuh format "IDX:BBCA", sementara YahooFinance pakai "BBCA.JK"
    let symbol = ticker;
    if (ticker.includes('.JK')) {
        symbol = `IDX:${ticker.replace('.JK', '')}`;
    } else if (ticker.toUpperCase() === 'IHSG' || ticker.toUpperCase() === '^JKSE') {
        symbol = 'IDX:COMPOSITE';
    } else if (ticker.length === 4 && !ticker.includes(':')) {
        symbol = `IDX:${ticker}`;
    }
    
    const isLight = document.body.classList.contains('light-theme');
    const tvTheme = isLight ? 'light' : 'dark';
    const bgColor = isLight ? '#ffffff' : '#020617';
    const gridColor = isLight ? '#f1f5f9' : '#0f172a';

    document.getElementById('tv-chart-container').innerHTML = '';
    new TradingView.widget({
        "autosize": true,
        "symbol": symbol,
        "interval": "D",
        "timezone": "Asia/Jakarta",
        "theme": tvTheme,
        "style": "1",
        "locale": "id",
        "enable_publishing": false,
        "backgroundColor": bgColor,
        "gridColor": gridColor,
        "hide_top_toolbar": false,
        "hide_legend": false,
        "save_image": false,
        "container_id": "tv-chart-container"
    });
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Screener Logic (Real-time from Backend)
let screenerData = [];
async function fetchScreenerData(sector = 'Semua Sektor') {
    try {
        const response = await fetch(`${API_BASE}/screener?sector=${encodeURIComponent(sector)}`);
        if (!response.ok) throw new Error('Network response was not ok');
        screenerData = await response.json();
        renderScreenerTable(screenerData);
    } catch (error) {
        console.error('Error fetching screener data:', error);
        document.getElementById('screener-body').innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--danger)">Gagal memuat data live. Pastikan server Python berjalan.</td></tr>';
    }
}

function renderScreenerTable(data) {
    const tbody = document.getElementById('screener-body');
    tbody.innerHTML = '';
    
    if(data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Data tidak ditemukan</td></tr>';
        return;
    }

    data.forEach(stock => {
        const isPos = stock.change > 0;
        const changeClass = isPos ? 'positive' : 'negative';
        const changeStr = (isPos ? '+' : '') + stock.change + '%';
        const priceStr = stock.ticker.length === 4 ? formatCurrency(stock.price) : `$${stock.price.toFixed(2)}`;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="ticker-cell" onclick="updateTradingView('${stock.ticker}')" style="cursor:pointer;" title="Lihat Chart">${stock.ticker}</td>
            <td>${stock.name}</td>
            <td style="font-weight:bold; color:${isPos ? '#10b981' : 'var(--danger)'};">${priceStr}</td>
            <td><span class="badge ${changeClass}">${changeStr}</span></td>
            <td>${stock.volume.toLocaleString()}</td>
            <td><button class="action-btn" onclick="addToWatchlist('${stock.ticker}')" style="background:rgba(59,130,246,0.1); color:var(--primary); font-weight:600; padding:4px 8px; border-radius:4px;">+ Watchlist</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function initScreener() {
    document.getElementById('screener-body').innerHTML = '<tr><td colspan="6" style="text-align:center">Memuat Live Data dari Yahoo Finance...</td></tr>';
    
    const filterSelect = document.getElementById('screener-filter');
    const getCurrentSector = () => filterSelect ? filterSelect.value : 'Semua Sektor';
    
    fetchScreenerData(getCurrentSector());
    
    if (filterSelect) {
        filterSelect.addEventListener('change', () => {
            document.getElementById('screener-body').innerHTML = '<tr><td colspan="6" style="text-align:center">Memfilter sektor...</td></tr>';
            fetchScreenerData(getCurrentSector());
            showToast(`Menampilkan sektor: ${getCurrentSector()}`, 'info');
        });
    }

    setInterval(() => fetchScreenerData(getCurrentSector()), 60000);
}

// Valuation Logic
function initValuation() {
    const btnFetch = document.getElementById('btn-fetch-price');
    const btnCalc = document.getElementById('btn-calculate');
    
    if(btnFetch) {
        btnFetch.addEventListener('click', async () => {
            const ticker = document.getElementById('val-ticker').value.trim().toUpperCase();
            if(!ticker) {
                showToast('Masukkan kode saham untuk ditarik harganya!', 'error');
                return;
            }
            btnFetch.innerText = "...";
            try {
                const response = await fetch(`${API_BASE}/price?ticker=${ticker}`);
                if(!response.ok) throw new Error('Harga tidak ditemukan');
                const data = await response.json();
                if(data.error) throw new Error(data.error);
                
                document.getElementById('val-price').value = data.current_price;
                showToast(`Harga ${data.name} berhasil ditarik: ${data.current_price}`, 'success');
            } catch(e) {
                showToast('Gagal menarik harga saham.', 'error');
            } finally {
                btnFetch.innerText = "Cari Harga";
            }
        });
    }

    if(btnCalc) {
        btnCalc.addEventListener('click', () => {
            const currentPrice = parseFloat(document.getElementById('val-price').value);
            const eps = parseFloat(document.getElementById('val-eps').value);
            const bvps = parseFloat(document.getElementById('val-bvps').value);
            const growth = parseFloat(document.getElementById('val-growth').value);
            
            if(isNaN(currentPrice) || isNaN(eps) || isNaN(bvps) || isNaN(growth)) {
                showToast('Mohon isi semua data keuangan dengan angka yang valid!', 'error');
                return;
            }

            let grahamValue = 0;
            if(eps > 0 && bvps > 0) {
                grahamValue = Math.sqrt(22.5 * eps * bvps);
            }
            
            const AAA_BOND_YIELD = 6.5;
            let dcfValue = 0;
            if(eps > 0) {
                dcfValue = (eps * (8.5 + 2 * growth) * 4.4) / AAA_BOND_YIELD;
            }
            
            const formatVal = (val) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(val);
            
            document.getElementById('res-graham').innerText = formatVal(grahamValue);
            document.getElementById('res-dcf').innerText = formatVal(dcfValue);
            
            updateStatus('status-graham', grahamValue, currentPrice);
            updateStatus('status-dcf', dcfValue, currentPrice);
        });
    }
}

function updateStatus(elementId, fairValue, currentPrice) {
    const el = document.getElementById(elementId);
    if(fairValue <= 0) {
        el.innerText = "Tidak dapat dihitung (EPS negatif)";
        el.className = "status-badge";
        return;
    }
    
    const margin = ((fairValue - currentPrice) / currentPrice) * 100;
    
    if(margin > 15) {
        el.innerText = `Undervalued (Diskon ${margin.toFixed(1)}%)`;
        el.className = "status-badge cheap";
    } else if (margin < -15) {
        el.innerText = `Overvalued (Mahal ${Math.abs(margin).toFixed(1)}%)`;
        el.className = "status-badge expensive";
    } else {
        el.innerText = `Fair Value (Wajar)`;
        el.className = "status-badge";
    }
}

// Prediction Logic (Now Technical Signal)
function initPrediction() {
    const btn = document.getElementById('btn-predict');
    
    btn.addEventListener('click', async () => {
        const ticker = document.getElementById('pred-ticker').value.trim().toUpperCase();
        if(!ticker) return;
        btn.innerText = "Menganalisis...";
        btn.disabled = true;
        
        try {
            const response = await fetch(`${API_BASE}/technical?ticker=${ticker}`);
            if(!response.ok) throw new Error('Gagal ambil data teknikal');
            const data = await response.json();
            if(data.error) throw new Error(data.error);
            
            const isIDR = ticker.length === 4;
            const formatVal = (val) => isIDR ? formatCurrency(val) : `$${val.toFixed(2)}`;
            
            const techGrid = document.getElementById('tech-results');
            
            let signalColor = 'var(--text-main)';
            let signalBg = 'var(--bg-card)';
            if(data.signal.includes('BUY')) { signalColor = '#10b981'; signalBg = 'rgba(16, 185, 129, 0.1)'; }
            else if(data.signal.includes('SELL')) { signalColor = 'var(--danger)'; signalBg = 'rgba(239, 68, 68, 0.1)'; }
            
            let smaColor = data.sma_status === 'BULLISH' ? '#10b981' : 'var(--danger)';
            let rsiColor = data.rsi_status === 'OVERBOUGHT' ? 'var(--danger)' : (data.rsi_status === 'OVERSOLD' ? '#10b981' : 'var(--text-main)');
            
            let smaExplanation = data.sma_status === 'BULLISH' 
                ? "Bagus. Rata-rata harga sedang bergerak naik ke atas (Uptrend)." 
                : "Hati-hati. Rata-rata harga sedang bergerak merosot turun (Downtrend).";
                
            let rsiText = "NORMAL (Wajar)";
            let rsiExplanation = "Aman. Harga masih bergerak dalam batas wajar, belum ada tanda kemahalan atau kemurahan.";
            if(data.rsi_status === 'OVERBOUGHT') {
                rsiText = "KEMAHALAN (Overbought)";
                rsiExplanation = "Bahaya. Orang-orang sudah terlalu banyak membeli. Harga sangat rawan anjlok tiba-tiba.";
            } else if (data.rsi_status === 'OVERSOLD') {
                rsiText = "KEMURAHAN (Oversold)";
                rsiExplanation = "Peluang. Orang-orang sudah terlalu banyak menjual ketakutan. Harga berpotensi besar untuk mantul naik.";
            }

            techGrid.innerHTML = `
                <div class="card result-card" style="border-left: 4px solid ${smaColor}">
                    <h3 style="color: var(--text-muted); font-size: 14px; margin-bottom: 8px;">Arah Pergerakan (Tren)</h3>
                    <h2 style="font-size: 24px; margin-bottom: 8px; color: ${smaColor}; font-weight:700;">${data.sma_status === 'BULLISH' ? 'SEDANG NAIK' : 'SEDANG TURUN'}</h2>
                    <p style="font-size: 14px; color: var(--text-muted); line-height: 1.5;">${smaExplanation}</p>
                    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed rgba(255,255,255,0.1);">
                        <p style="font-size: 12px; color: var(--text-muted);">Harga Asli: <strong style="color:var(--text-main)">${formatVal(data.current_price)}</strong></p>
                        <p style="font-size: 12px; color: var(--text-muted);">Harga Rata-rata: <strong style="color:var(--text-main)">${formatVal(data.sma_20)}</strong></p>
                    </div>
                </div>
                
                <div class="card result-card" style="border-left: 4px solid ${rsiColor}">
                    <h3 style="color: var(--text-muted); font-size: 14px; margin-bottom: 8px;">Titik Jenuh Harga</h3>
                    <h2 style="font-size: 24px; margin-bottom: 8px; color: ${rsiColor}; font-weight:700;">${rsiText}</h2>
                    <p style="font-size: 14px; color: var(--text-muted); line-height: 1.5;">${rsiExplanation}</p>
                    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed rgba(255,255,255,0.1);">
                        <p style="font-size: 12px; color: var(--text-muted);">Angka Sinyal: <strong style="color:var(--text-main)">${data.rsi_14}</strong> (Normal: 30 - 70)</p>
                    </div>
                </div>
                
                <div class="card result-card" style="background: ${signalBg}; border: 1px solid ${signalColor}; text-align: center; display: flex; flex-direction: column; justify-content: center; align-items:center;">
                    <h3 style="color: var(--text-muted); font-size: 14px; margin-bottom: 8px;">Saran Keputusan Otomatis</h3>
                    <h1 style="font-size: 32px; color: ${signalColor}; margin-bottom: 8px;">${data.signal}</h1>
                </div>
            `;
            
        } catch(e) {
            showToast('Gagal menganalisis saham ini. Pastikan kode saham benar.', 'error');
            console.error(e);
        } finally {
            btn.innerText = "Analisis Otomatis";
            btn.disabled = false;
        }
    });
}

// IHSG Logic
async function fetchIHSG() {
    try {
        const response = await fetch(`${API_BASE}/ihsg`);
        if(!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        
        const priceStr = data.price ? data.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A';
        const changeStr = data.change !== undefined ? (data.change > 0 ? '+' : '') + data.change.toFixed(2) + '%' : '0%';
        const changeColor = data.change > 0 ? '#10b981' : '#ef4444';
        const badgeClass = data.change > 0 ? 'positive' : 'negative';
        
        // Update Header
        const elHeader = document.getElementById('ihsg-value');
        const elHeaderChange = document.getElementById('ihsg-change');
        if(elHeader) elHeader.innerText = priceStr;
        if(elHeaderChange) {
            elHeaderChange.innerText = changeStr;
            elHeaderChange.style.color = changeColor;
        }
        
        // Update Dashboard Card
        const elCard = document.getElementById('ihsg-value-card');
        const elCardChange = document.getElementById('ihsg-change-card');
        if(elCard) elCard.innerText = priceStr;
        if(elCardChange) {
            elCardChange.innerText = changeStr;
            elCardChange.className = `badge ${badgeClass}`;
        }
    } catch (error) {
        console.error('Error fetching IHSG:', error);
    }
}

// Realtime Clock Logic
function updateClock() {
    const clockEl = document.getElementById('clock-wib');
    const badgeEl = document.getElementById('market-badge');
    if(!clockEl) return;
    
    // Tarik waktu zona Asia/Jakarta
    const now = new Date();
    const jktDate = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Jakarta"}));
    
    const h = jktDate.getHours();
    const m = jktDate.getMinutes();
    const s = jktDate.getSeconds();
    
    const timeString = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')} WIB`;
    clockEl.innerText = timeString;
    
    // Logika buka bursa: Senin(1) s/d Jumat(5), jam 09:00 - 16:00
    const day = jktDate.getDay();
    let isMarketOpen = false;
    if(day >= 1 && day <= 5) {
        if(h >= 9 && h < 16) {
            isMarketOpen = true;
        }
    }
    
    if(badgeEl) {
        if(isMarketOpen) {
            badgeEl.innerText = "BURSA BUKA";
            badgeEl.style.backgroundColor = "rgba(16, 185, 129, 0.2)";
            badgeEl.style.color = "#10b981";
            badgeEl.style.borderColor = "#10b981";
        } else {
            badgeEl.innerText = "BURSA TUTUP";
            badgeEl.style.backgroundColor = "rgba(239, 68, 68, 0.2)";
            badgeEl.style.color = "#ef4444";
            badgeEl.style.borderColor = "rgba(239, 68, 68, 0.5)";
        }
    }
}
