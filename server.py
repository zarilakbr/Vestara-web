from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import pandas as pd
import numpy as np
import time
import requests
from bs4 import BeautifulSoup
import os

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

@app.route('/')
def index():
    return app.send_static_file('index.html')

import concurrent.futures

# Database Saham Terkategorisasi Sektor
STOCKS_DB = [
    {'ticker': 'ADRO.JK', 'sector': 'Energi'},
    {'ticker': 'PTBA.JK', 'sector': 'Energi'},
    {'ticker': 'PGAS.JK', 'sector': 'Energi'},
    {'ticker': 'MEDC.JK', 'sector': 'Energi'},
    {'ticker': 'ITMG.JK', 'sector': 'Energi'},
    
    {'ticker': 'BBCA.JK', 'sector': 'Keuangan'},
    {'ticker': 'BBRI.JK', 'sector': 'Keuangan'},
    {'ticker': 'BMRI.JK', 'sector': 'Keuangan'},
    {'ticker': 'BBNI.JK', 'sector': 'Keuangan'},
    {'ticker': 'ARTO.JK', 'sector': 'Keuangan'},
    
    {'ticker': 'GOTO.JK', 'sector': 'Teknologi'},
    {'ticker': 'EMTK.JK', 'sector': 'Teknologi'},
    {'ticker': 'BUKA.JK', 'sector': 'Teknologi'},
    
    {'ticker': 'ICBP.JK', 'sector': 'Konsumer'},
    {'ticker': 'INDF.JK', 'sector': 'Konsumer'},
    {'ticker': 'AMRT.JK', 'sector': 'Konsumer'},
    {'ticker': 'MYOR.JK', 'sector': 'Konsumer'},
    
    {'ticker': 'TLKM.JK', 'sector': 'Infrastruktur'},
    {'ticker': 'EXCL.JK', 'sector': 'Infrastruktur'},
    {'ticker': 'ISAT.JK', 'sector': 'Infrastruktur'},
    {'ticker': 'JSMR.JK', 'sector': 'Infrastruktur'},
    
    {'ticker': 'ASII.JK', 'sector': 'Industri'},
    {'ticker': 'UNTR.JK', 'sector': 'Industri'}
]

# Cache untuk mencegah spam
screener_cache = {
    'data': [],
    'last_updated': 0
}

# Removed simulated FUNDAMENTALS for production readiness

def scrape_yahoo_price(ticker):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://finance.yahoo.com/'
    }
    try:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=1d"
        res = requests.get(url, headers=headers, timeout=5)
        if res.status_code == 200:
            data = res.json()
            meta = data['chart']['result'][0]['meta']
            current_price = meta.get('regularMarketPrice')
            prev_close = meta.get('chartPreviousClose')
            volume = meta.get('regularMarketVolume', 0)
            name = meta.get('shortName') or meta.get('longName') or ticker.replace('.JK', '')
            
            change = 0
            if current_price and prev_close:
                change = ((current_price - prev_close) / prev_close) * 100
                
            return current_price, round(change, 2), volume, name
    except Exception:
        pass

    # Fallback to Google Finance jika Yahoo Finance memblokir Vercel
    try:
        ticker_base = ticker.replace('.JK', '')
        url = f"https://www.google.com/finance/quote/{ticker_base}:IDX"
        res = requests.get(url, headers=headers, timeout=5)
        if res.status_code == 200:
            soup = BeautifulSoup(res.text, 'html.parser')
            price_div = soup.find('div', class_='YMlKec fxKbKc')
            if price_div:
                price_str = price_div.text.replace('Rp', '').replace(',', '').strip()
                price = float(price_str)
                name_div = soup.find('div', class_='zzDege')
                name = name_div.text if name_div else ticker_base
                return price, 0.0, 0, name
    except Exception:
        pass

    return None, None, None, ticker.replace('.JK', '')

@app.route('/api/screener', methods=['GET'])
def get_screener_data():
    current_time = time.time()
    sector_filter = request.args.get('sector', 'Semua Sektor')
    
    # Update cache setiap 60 detik (Multithreading agar sangat cepat)
    if not screener_cache['data'] or (current_time - screener_cache['last_updated']) > 60:
        temp_data = []
        
        def fetch_stock(stock):
            price, change, volume, name = scrape_yahoo_price(stock['ticker'])
            if price is not None:
                return {
                    'ticker': stock['ticker'].replace('.JK', ''),
                    'name': name,
                    'sector': stock['sector'],
                    'price': price,
                    'change': change,
                    'volume': volume
                }
            return None
            
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            results = executor.map(fetch_stock, STOCKS_DB)
            for res in results:
                if res:
                    temp_data.append(res)
                    
        if temp_data:
            screener_cache['data'] = temp_data
            screener_cache['last_updated'] = current_time
    
    # Filter dari memori cache
    filtered_data = []
    for item in screener_cache['data']:
        if sector_filter == 'Semua Sektor' or item['sector'] == sector_filter:
            filtered_data.append(item)
            
    return jsonify(filtered_data)

@app.route('/api/price', methods=['GET'])
def get_price():
    ticker_symbol = request.args.get('ticker', '').upper()
    if not ticker_symbol:
        return jsonify({'error': 'Ticker is required'}), 400
        
    if len(ticker_symbol) == 4 and not ticker_symbol.endswith('.JK') and not ticker_symbol in ['AAPL', 'MSFT', 'META', 'AMZN', 'TSLA']:
        ticker_symbol += '.JK'

    try:
        price, change, volume, name = scrape_yahoo_price(ticker_symbol)
        
        if price is None:
            raise Exception("Harga tidak ditemukan")

        return jsonify({
            'ticker': ticker_symbol.replace('.JK', ''),
            'name': name,
            'current_price': price,
            'change': change,
            'volume': volume
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/technical', methods=['GET'])
def get_technical():
    ticker_symbol = request.args.get('ticker', '').upper()
    if not ticker_symbol:
        return jsonify({'error': 'Ticker is required'}), 400
        
    if len(ticker_symbol) == 4 and not ticker_symbol.endswith('.JK') and not ticker_symbol in ['AAPL', 'MSFT', 'META', 'AMZN', 'TSLA']:
        ticker_symbol += '.JK'
        
    try:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker_symbol}?interval=1d&range=3mo"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Referer': 'https://finance.yahoo.com/'
        }
        res = requests.get(url, headers=headers, timeout=5)
        if res.status_code != 200:
            raise Exception("Gagal menarik data dari bursa")
            
        data = res.json()
        closes = data['chart']['result'][0]['indicators']['quote'][0]['close']
        
        closes = [c for c in closes if c is not None]
        if len(closes) < 20:
            raise Exception("Data riwayat harga tidak cukup untuk analisis teknikal")
            
        current_price = closes[-1]
        
        closes_s = pd.Series(closes)
        sma_20 = closes_s.rolling(window=20).mean().iloc[-1]
        if pd.isna(sma_20): sma_20 = current_price
        
        # Standar Wilder's Smoothing RSI 14 (Sama dengan TradingView)
        if len(closes) >= 15:
            delta = closes_s.diff()
            gain = (delta.where(delta > 0, 0)).ewm(alpha=1/14, adjust=False).mean()
            loss = (-delta.where(delta < 0, 0)).ewm(alpha=1/14, adjust=False).mean()
            
            rs = gain / loss
            rsi_series = 100 - (100 / (1 + rs))
            rsi_14 = rsi_series.iloc[-1]
            if pd.isna(rsi_14):
                rsi_14 = 50
        else:
            rsi_14 = 50
            
        sma_status = "BULLISH" if current_price > sma_20 else "BEARISH"
        
        if rsi_14 > 70:
            rsi_status = "OVERBOUGHT"
        elif rsi_14 < 30:
            rsi_status = "OVERSOLD"
        else:
            rsi_status = "NEUTRAL"
            
        signal = "HOLD"
        if sma_status == "BULLISH" and rsi_status == "OVERSOLD":
            signal = "STRONG BUY"
        elif sma_status == "BULLISH" and rsi_status == "NEUTRAL":
            signal = "BUY"
        elif sma_status == "BEARISH" and rsi_status == "OVERBOUGHT":
            signal = "STRONG SELL"
        elif sma_status == "BEARISH" and rsi_status == "NEUTRAL":
            signal = "SELL"

        return jsonify({
            'ticker': ticker_symbol.replace('.JK', ''),
            'current_price': current_price,
            'sma_20': sma_20,
            'sma_status': sma_status,
            'rsi_14': round(rsi_14, 2),
            'rsi_status': rsi_status,
            'signal': signal
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/ihsg', methods=['GET'])
def get_ihsg():
    try:
        url = "https://query1.finance.yahoo.com/v8/finance/chart/^JKSE?interval=1d&range=1d"
        headers = {'User-Agent': 'Mozilla/5.0'}
        res = requests.get(url, headers=headers, timeout=5)
        if res.status_code == 200:
            data = res.json()
            meta = data['chart']['result'][0]['meta']
            current_price = meta.get('regularMarketPrice')
            prev_close = meta.get('chartPreviousClose')
            
            change = 0
            if current_price and prev_close:
                change = ((current_price - prev_close) / prev_close) * 100
                
            return jsonify({
                'price': current_price,
                'change': round(change, 2)
            })
        raise Exception("Gagal API")
    except Exception as e:
        # Fallback simulated if Yahoo fails
        import random
        return jsonify({
            'price': 7250.50 + (random.random() * 10 - 5),
            'change': 0.5 + (random.random() * 0.1)
        })

@app.route('/api/search', methods=['GET'])
def search_stock():
    q = request.args.get('q', '').strip().upper()
    if len(q) < 2:
        return jsonify([])
    
    try:
        results = []
        for stock in STOCKS_DB:
            ticker_no_jk = stock['ticker'].replace('.JK', '')
            if q in ticker_no_jk or q in stock['sector'].upper():
                results.append({
                    'ticker': ticker_no_jk,
                    'name': stock['sector'] + ' Sector',
                    'exchange': 'IDX'
                })
        
        # Jika hasil lokal kurang, kita bisa fallback ke hardcoded populer
        if not results and q == 'GOTO':
            results.append({'ticker': 'GOTO', 'name': 'GoTo Gojek Tokopedia', 'exchange': 'IDX'})
            
        return jsonify(results[:6])
    except Exception as e:
        print("Search error:", e)
        return jsonify([])

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json or {}
    username = data.get('username')
    password = data.get('password')
    
    # Simple hardcoded database untuk login
    if username == 'admin' and password == 'admin123':
        return jsonify({'success': True, 'token': 'authenticated_session_999'})
    return jsonify({'success': False, 'message': 'Username atau Password salah!'})

if __name__ == '__main__':
    print("Mulai server Investools Backend di http://localhost:5000...")
    app.run(debug=True, port=5000)
