import os

if __name__ == '__main__':
    # Lấy cổng do Render cấp, nếu chạy local thì mặc định là 5000
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)