# 📚 Bài 12: HTTP & Web API

## 🎯 Mục tiêu bài học

- Hiểu **HTTP** hoạt động thế nào: request, response, method, status code, header, JSON
- Gọi API bằng **`urllib`** (thư viện chuẩn) và hiểu vì sao người ta dùng **`requests`** / **`httpx`**
- Viết HTTP client "chuẩn production": **timeout**, **retry**, **session**, **xử lý lỗi**, **header xác thực**, **phân trang (pagination)**
- Viết test cho code gọi API **không cần internet** với `httpx.MockTransport`
- Xây dựng **Web API** với **FastAPI + Pydantic v2**: path/query params, validate request body, `response_model`, status code, `HTTPException`
- Dùng **dependency injection** (`Depends`), **router**, **middleware**, **CORS**, **background tasks**
- Tự động có tài liệu API tại `/docs`, viết test với **`TestClient`**
- Biết khi nào chọn **FastAPI**, **Flask** hay **Django**
- Xây 3 ứng dụng thực tế: **client tỷ giá/thời tiết**, **REST API quản lý sản phẩm**, **webhook receiver có xác thực chữ ký HMAC**

## 📖 1. HTTP là gì?

### Client - Server: như gọi món ở nhà hàng

> 🧠 **Ví dụ dễ hiểu**: Bạn (**client** - trình duyệt, app điện thoại, script Python) vào nhà hàng, đưa **phiếu gọi món** (**request**) cho bếp (**server**). Bếp trả lại **món ăn kèm hóa đơn** (**response**). **HTTP** chính là **quy ước viết phiếu gọi món** mà mọi nhà hàng trên thế giới đều hiểu: ghi món gì, bàn số mấy, ghi chú thêm ra sao.

Mỗi lần bạn mở một trang web hay app lấy dữ liệu, bên dưới là một (hoặc nhiều) cặp request/response như sau:

```text
──── REQUEST (client gửi) ─────────────────────────────
POST /api/orders?notify=true HTTP/1.1          ← Method + đường dẫn + query string
Host: shop.example.com                          ← Header: thông tin phụ
Content-Type: application/json
Authorization: Bearer eyJhbGciOi...
                                                ← Dòng trống ngăn header và body
{"product_id": 42, "quantity": 2}               ← Body: dữ liệu gửi kèm

──── RESPONSE (server trả về) ─────────────────────────
HTTP/1.1 201 Created                            ← Status code: kết quả xử lý
Content-Type: application/json
Location: /api/orders/1001

{"id": 1001, "status": "pending", "total": 500000}
```

**API (Application Programming Interface)** trên web = tập hợp các "món" mà server cho phép gọi, ví dụ `GET /api/products`, `POST /api/orders`. Khác với trang web trả về HTML cho người đọc, **Web API** trả về dữ liệu (thường là **JSON**) cho **chương trình** đọc.

### HTTP Methods - "Động từ"

| Method | Ý nghĩa | Ví dụ | Có body? |
| --- | --- | --- | --- |
| `GET` | **Lấy** dữ liệu (không thay đổi gì) | `GET /products/5` | ❌ |
| `POST` | **Tạo mới** | `POST /products` | ✅ |
| `PUT` | **Thay thế toàn bộ** | `PUT /products/5` | ✅ |
| `PATCH` | **Sửa một phần** | `PATCH /products/5` (chỉ đổi giá) | ✅ |
| `DELETE` | **Xóa** | `DELETE /products/5` | ❌ |

> 💡 Kiểu thiết kế API dùng **danh từ** cho đường dẫn (`/products`) + **method** làm động từ gọi là **REST**. Tránh kiểu `/getProducts`, `/deleteProduct?id=5`.

### Status code - "Kết quả xử lý"

| Nhóm | Ý nghĩa | Hay gặp |
| --- | --- | --- |
| **2xx** ✅ | Thành công | `200 OK`, `201 Created`, `204 No Content` |
| **3xx** ↪️ | Chuyển hướng | `301 Moved Permanently`, `304 Not Modified` |
| **4xx** 🙋 | **Lỗi phía client** (bạn gửi sai) | `400 Bad Request`, `401 Unauthorized` (chưa đăng nhập), `403 Forbidden` (không có quyền), `404 Not Found`, `409 Conflict`, `422 Unprocessable` (dữ liệu không hợp lệ), `429 Too Many Requests` |
| **5xx** 🔥 | **Lỗi phía server** | `500 Internal Server Error`, `502 Bad Gateway`, `503 Service Unavailable`, `504 Gateway Timeout` |

> 🧠 **Mẹo nhớ**: 4xx = "**lỗi của bạn**" (sửa request rồi gửi lại), 5xx = "**lỗi của tôi**" (server) - thường thử lại sau có thể được. Đây là cơ sở để quyết định **có nên retry hay không**.

### Header thường gặp

| Header | Ý nghĩa |
| --- | --- |
| `Content-Type: application/json` | Body là JSON |
| `Accept: application/json` | Client muốn nhận JSON |
| `Authorization: Bearer <token>` | Xác thực bằng token |
| `User-Agent` | Client là ai (trình duyệt, script...) |
| `Retry-After: 30` | Server bảo "30 giây nữa hãy thử lại" (đi kèm 429/503) |

### JSON - Ngôn ngữ chung

JSON là định dạng văn bản mà gần như mọi ngôn ngữ đều đọc được. Python chuyển đổi bằng module `json` (Bài 7):

```python
import json

order = {"id": 1001, "items": ["Áo", "Quần"], "paid": True, "note": None}
text = json.dumps(order, ensure_ascii=False)       # dict → chuỗi JSON (gửi đi)
print(text)
# Output: {"id": 1001, "items": ["Áo", "Quần"], "paid": true, "note": null}
print(json.loads(text)["items"][0])                 # chuỗi JSON → dict (nhận về)
# Output: Áo
```

## 📖 2. Server thử nghiệm trên máy bạn

Để mọi ví dụ trong bài **chạy được mà không cần internet** (và không phụ thuộc API bên ngoài có thể thay đổi), ta tự dựng một server HTTP mini bằng thư viện chuẩn `http.server`. Bạn chưa cần hiểu hết code này - chỉ cần **lưu thành file `demo_server.py`** cùng thư mục với các ví dụ.

```python
# file: demo_server.py
"""Server HTTP mini (chỉ dùng thư viện chuẩn) để thử các ví dụ KHÔNG cần internet.

Cách dùng:
    from demo_server import running_server
    with running_server() as base_url:     # ví dụ base_url = "http://127.0.0.1:54321"
        ...                                 # gọi base_url + "/api/..."
"""

import json
import threading
import time
from collections import Counter
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

TOKEN = "secret-token"
RATES = {"USD": 25_400, "EUR": 27_600, "JPY": 170}
WEATHER = {
    "hanoi": {"city": "Hà Nội", "temp": 31, "desc": "Nắng"},
    "hue": {"city": "Huế", "temp": 27, "desc": "Mưa rào"},
}
PRODUCTS = [{"id": i, "name": f"Sản phẩm {i}"} for i in range(1, 8)]
flaky_calls: Counter = Counter()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):          # Tắt log mặc định cho gọn
        pass

    def send_json(self, status: int, data) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        url = urlparse(self.path)
        query = {k: v[0] for k, v in parse_qs(url.query).items()}
        if url.path == "/api/rates":
            self.send_json(200, {"base": "VND", "rates": RATES})
        elif url.path.startswith("/api/weather/"):
            city = url.path.rsplit("/", 1)[-1]
            if city in WEATHER:
                self.send_json(200, WEATHER[city])
            else:
                self.send_json(404, {"error": f"Không có dữ liệu cho '{city}'"})
        elif url.path == "/api/products":                 # Có phân trang
            page, size = int(query.get("page", 1)), int(query.get("size", 3))
            start = (page - 1) * size
            has_next = start + size < len(PRODUCTS)
            self.send_json(200, {"items": PRODUCTS[start:start + size], "page": page,
                                 "next_page": page + 1 if has_next else None})
        elif url.path == "/api/me":                       # Cần token
            if self.headers.get("Authorization") != f"Bearer {TOKEN}":
                self.send_json(401, {"error": "Thiếu hoặc sai token"})
            else:
                self.send_json(200, {"user": "an", "role": "admin"})
        elif url.path == "/api/flaky":                    # Lỗi 503 hai lần đầu rồi mới OK
            key = query.get("key", "default")
            flaky_calls[key] += 1
            if flaky_calls[key] <= 2:
                self.send_json(503, {"error": "Server đang quá tải"})
            else:
                self.send_json(200, {"ok": True, "attempt": flaky_calls[key]})
        elif url.path == "/api/slow":                     # Phản hồi chậm
            time.sleep(float(query.get("seconds", 2)))
            self.send_json(200, {"ok": True})
        else:
            self.send_json(404, {"error": "Not found"})

    def do_POST(self):
        raw = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        if self.path != "/api/echo":
            self.send_json(404, {"error": "Not found"})
            return
        try:
            data = json.loads(raw or b"null")
        except json.JSONDecodeError:
            self.send_json(400, {"error": "Body không phải JSON hợp lệ"})
            return
        self.send_json(201, {"received": data,
                             "content_type": self.headers.get("Content-Type")})


@contextmanager
def running_server():
    """Chạy server ở luồng nền trên một port trống, tự tắt khi ra khỏi khối with."""
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)   # Port 0 = để hệ điều hành chọn
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        server.server_close()
```

> 💡 `127.0.0.1` (hay `localhost`) là địa chỉ **"chính máy mình"**. Request gửi tới đây không hề đi ra internet.

## 📖 3. `urllib` - HTTP bằng thư viện chuẩn

`urllib.request` có sẵn trong Python, không cần cài gì. Hữu ích cho script nhỏ, môi trường không được cài thư viện ngoài.

```python
import json
import urllib.error
import urllib.request
from urllib.parse import urlencode

from demo_server import running_server

with running_server() as base:
    # GET đơn giản - LUÔN đặt timeout
    with urllib.request.urlopen(f"{base}/api/rates", timeout=5) as resp:
        print(resp.status, resp.headers["Content-Type"])
        data = json.loads(resp.read().decode("utf-8"))    # Tự đọc bytes, tự decode, tự parse JSON
    print(data["rates"]["USD"])

    # Query string: dùng urlencode để escape ký tự đặc biệt
    print(f"{base}/api/products?" + urlencode({"page": 2, "size": 2, "q": "áo thun"}))

    # POST JSON: tự encode body và tự đặt header
    body = json.dumps({"name": "Áo"}).encode("utf-8")
    req = urllib.request.Request(
        f"{base}/api/echo", data=body, method="POST",
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        print(resp.status, json.loads(resp.read()))

    # Lỗi 4xx/5xx → urllib NÉM exception HTTPError
    try:
        urllib.request.urlopen(f"{base}/api/weather/sapa", timeout=5)
    except urllib.error.HTTPError as error:
        print("HTTPError:", error.code, json.loads(error.read()))
# Output:
# 200 application/json; charset=utf-8
# 25400
# http://127.0.0.1:PORT/api/products?page=2&size=2&q=%C3%A1o+thun
# 201 {'received': {'name': 'Áo'}, 'content_type': 'application/json'}
# HTTPError: 404 {'error': "Không có dữ liệu cho 'sapa'"}
```

> ℹ️ `PORT` là số port ngẫu nhiên, mỗi lần chạy một khác. Dòng đó trong output của bạn sẽ có số cụ thể, ví dụ `54321`.

Chạy được, nhưng khá **dài dòng**: tự encode/decode, tự đặt header, lỗi HTTP là exception, không có retry, không tái sử dụng kết nối... Đó là lý do cộng đồng tạo ra `requests` và `httpx`.

## 📖 4. `requests` - "HTTP for Humans"

### Cài đặt (trong venv)

```bash
# Tạo và kích hoạt venv (nhắc lại Bài 1)
python -m venv .venv
source .venv/bin/activate        # macOS/Linux
.venv\Scripts\activate           # Windows

python -m pip install requests httpx
```

### Cơ bản

```python
import requests

from demo_server import TOKEN, running_server

with running_server() as base:
    resp = requests.get(f"{base}/api/rates", timeout=5)
    print(resp.status_code, resp.ok)                  # ok = True nếu status < 400
    print(resp.json()["rates"]["EUR"])                # .json() tự parse

    # params: requests tự ghép và escape query string
    resp = requests.get(f"{base}/api/products", params={"page": 3, "size": 3}, timeout=5)
    print(resp.url.split("/", 3)[-1], "→", resp.json())

    # json=...: tự chuyển dict thành JSON + tự đặt Content-Type
    resp = requests.post(f"{base}/api/echo", json={"qty": 2}, timeout=5)
    print(resp.status_code, resp.json())

    # Header xác thực
    resp = requests.get(f"{base}/api/me", headers={"Authorization": f"Bearer {TOKEN}"}, timeout=5)
    print(resp.json())

    # Lỗi HTTP KHÔNG tự thành exception → phải kiểm tra, hoặc gọi raise_for_status()
    resp = requests.get(f"{base}/api/me", timeout=5)
    print(resp.status_code, resp.json())
    try:
        resp.raise_for_status()
    except requests.HTTPError as error:
        print("HTTPError:", error.response.status_code)
# Output:
# 200 True
# 27600
# api/products?page=3&size=3 → {'items': [{'id': 7, 'name': 'Sản phẩm 7'}], 'page': 3, 'next_page': None}
# 201 {'received': {'qty': 2}, 'content_type': 'application/json'}
# {'user': 'an', 'role': 'admin'}
# 401 {'error': 'Thiếu hoặc sai token'}
# HTTPError: 401
```

### Timeout - BẮT BUỘC phải có

Mặc định `requests` **chờ vô hạn**. Nếu server treo, chương trình của bạn treo theo mãi mãi.

> 🧠 **Ví dụ dễ hiểu**: Gọi điện cho tổng đài mà không ai nhấc máy - người bình thường sẽ cúp máy sau 30 giây. Code không có timeout thì **cầm máy chờ đến hết đời** ☎️.

```python
import requests

from demo_server import running_server

with running_server() as base:
    try:
        requests.get(f"{base}/api/slow", params={"seconds": 2}, timeout=0.5)
    except requests.Timeout:
        print("⏰ Quá 0.5 giây, bỏ cuộc!")

    # timeout=(connect, read): chờ kết nối tối đa 3s, chờ dữ liệu tối đa 10s
    resp = requests.get(f"{base}/api/slow", params={"seconds": 0.1}, timeout=(3, 10))
    print(resp.json())
# Output:
# ⏰ Quá 0.5 giây, bỏ cuộc!
# {'ok': True}
```

### Session - tái sử dụng kết nối và cấu hình chung

Mỗi `requests.get(...)` lẻ mở một kết nối TCP mới. `Session` **giữ kết nối** (nhanh hơn nhiều khi gọi liên tục cùng một server) và cho phép đặt **header chung** một lần.

### Retry - thử lại khi lỗi tạm thời

Mạng chập chờn, server quá tải (503) là chuyện hằng ngày. Chiến lược chuẩn: **thử lại vài lần, mỗi lần chờ lâu hơn** (exponential backoff: 0.1s → 0.2s → 0.4s...), và **chỉ retry lỗi tạm thời** (5xx, 429, lỗi kết nối) - **không** retry 400/401/404 vì gửi lại y hệt thì vẫn sai.

```python
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry          # urllib3 được cài kèm requests

from demo_server import TOKEN, running_server


def make_session(token: str) -> requests.Session:
    session = requests.Session()
    session.headers.update({                  # Header chung cho MỌI request của session
        "Authorization": f"Bearer {token}",
        "User-Agent": "shop-client/1.0",
    })
    retry = Retry(
        total=3,                              # Tối đa 3 lần thử lại
        backoff_factor=0.1,                   # Chờ tăng dần giữa các lần
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET", "PUT", "DELETE"],   # Không tự retry POST (có thể tạo trùng đơn!)
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    return session


with running_server() as base, make_session(TOKEN) as session:
    print(session.get(f"{base}/api/me", timeout=5).json())
    resp = session.get(f"{base}/api/flaky", params={"key": "demo"}, timeout=5)
    print(resp.status_code, resp.json())      # 2 lần đầu 503, lần thứ 3 thành công
# Output:
# {'user': 'an', 'role': 'admin'}
# 200 {'ok': True, 'attempt': 3}
```

> ⚠️ **Tại sao không retry POST?** Giả sử request "tạo đơn hàng" đã tới server và được xử lý, nhưng response bị mất trên đường về. Retry → **tạo 2 đơn**, khách bị trừ tiền 2 lần 😱. Các API thanh toán giải quyết bằng header **`Idempotency-Key`**: client gửi kèm một mã duy nhất (ví dụ `uuid4`), server thấy mã đã xử lý rồi thì trả kết quả cũ thay vì tạo mới.

### Xử lý lỗi đầy đủ

Các exception của `requests` đều kế thừa `requests.RequestException`:

```python
import requests

from demo_server import running_server


def fetch_weather(base: str, city: str) -> str:
    try:
        resp = requests.get(f"{base}/api/weather/{city}", timeout=3)
        resp.raise_for_status()
        data = resp.json()
    except requests.Timeout:
        return "⏰ Server phản hồi quá chậm"
    except requests.ConnectionError:
        return "🔌 Không kết nối được server"
    except requests.HTTPError as error:
        if error.response.status_code == 404:
            return f"🤷 Không có dữ liệu cho {city}"
        return f"❌ Lỗi server {error.response.status_code}"
    except ValueError:                        # Body không phải JSON
        return "❌ Dữ liệu trả về không hợp lệ"
    return f"🌤️ {data['city']}: {data['temp']}°C, {data['desc']}"


with running_server() as base:
    print(fetch_weather(base, "hanoi"))
    print(fetch_weather(base, "sapa"))
print(fetch_weather("http://127.0.0.1:9", "hue"))    # Port 9: không có server nào
# Output:
# 🌤️ Hà Nội: 31°C, Nắng
# 🤷 Không có dữ liệu cho sapa
# 🔌 Không kết nối được server
```

### Pagination - Lấy dữ liệu nhiều trang

API thường không trả 1 triệu bản ghi một lúc mà chia **trang**. Dùng **generator** (Bài 9) để người gọi chỉ việc `for` mà không cần biết có bao nhiêu trang:

```python
from collections.abc import Iterator

import requests

from demo_server import running_server


def iter_products(session: requests.Session, base: str, size: int = 3) -> Iterator[dict]:
    page = 1
    while page is not None:
        resp = session.get(f"{base}/api/products", params={"page": page, "size": size}, timeout=5)
        resp.raise_for_status()
        data = resp.json()
        print(f"   (đã tải trang {data['page']})")
        yield from data["items"]
        page = data["next_page"]              # None → hết trang → dừng vòng lặp


with running_server() as base, requests.Session() as session:
    names = [p["name"] for p in iter_products(session, base)]
    print(len(names), names[-1])
# Output:
#    (đã tải trang 1)
#    (đã tải trang 2)
#    (đã tải trang 3)
# 7 Sản phẩm 7
```

> 💡 Các kiểu phân trang hay gặp: **page/size** (như trên), **offset/limit**, và **cursor** (server trả về `next_cursor`; tốt nhất cho dữ liệu lớn, thay đổi liên tục). Dù kiểu nào, cách viết generator đều giống nhau.

## 📖 5. `httpx` - Thế hệ mới: sync + async, dễ test

`httpx` có API gần giống `requests` nhưng thêm: hỗ trợ **async** (Bài 9), HTTP/2, **timeout mặc định 5 giây** (an toàn hơn), và **`MockTransport`** giúp test mà không cần server nào.

```python
import asyncio

import httpx

from demo_server import running_server

with running_server() as base:
    # Client = tương đương Session của requests; base_url giúp viết đường dẫn ngắn
    with httpx.Client(base_url=base, timeout=5.0) as client:
        resp = client.get("/api/weather/hue")
        print(resp.status_code, resp.json())
        print(client.get("/api/weather/sapa").is_error)

    # Async: gọi nhiều API ĐỒNG THỜI thay vì lần lượt
    async def fetch_all(cities: list[str]) -> list[dict]:
        async with httpx.AsyncClient(base_url=base, timeout=5.0) as client:
            responses = await asyncio.gather(*(client.get(f"/api/weather/{c}") for c in cities))
            return [r.json() for r in responses]

    print(asyncio.run(fetch_all(["hanoi", "hue"])))
# Output:
# 200 {'city': 'Huế', 'temp': 27, 'desc': 'Mưa rào'}
# True
# [{'city': 'Hà Nội', 'temp': 31, 'desc': 'Nắng'}, {'city': 'Huế', 'temp': 27, 'desc': 'Mưa rào'}]
```

### `MockTransport` - Test code gọi API không cần mạng

> 🧠 **Ví dụ dễ hiểu**: Khi tập lái xe, bạn dùng **sa hình** 🚗 chứ không lao ngay ra quốc lộ. `MockTransport` là "sa hình": client tưởng đang nói chuyện với server thật, nhưng thực ra là **một hàm Python** do bạn viết, trả về đúng response bạn muốn - kể cả lỗi 500, JSON hỏng... những tình huống rất khó tạo ra với server thật.

```python
import httpx


def fake_api(request: httpx.Request) -> httpx.Response:
    """Hàm này đóng vai server: nhận Request, trả Response."""
    if request.url.path == "/v1/rates" and request.url.params.get("base") == "USD":
        return httpx.Response(200, json={"base": "USD", "rates": {"VND": 25400}})
    if request.url.path == "/v1/rates":
        return httpx.Response(400, json={"error": "base không hỗ trợ"})
    return httpx.Response(500, text="Internal Server Error")


client = httpx.Client(transport=httpx.MockTransport(fake_api), base_url="https://api.fake")
print(client.get("/v1/rates", params={"base": "USD"}).json())
print(client.get("/v1/rates", params={"base": "XYZ"}).status_code)
print(client.get("/v1/other").text)
# Output:
# {'base': 'USD', 'rates': {'VND': 25400}}
# 400
# Internal Server Error
```

### `requests` hay `httpx`?

| Tiêu chí | `requests` | `httpx` |
| --- | --- | --- |
| Độ phổ biến, tài liệu | ⭐ Rất lớn | Lớn, đang tăng nhanh |
| Async | ❌ | ✅ `AsyncClient` |
| Timeout mặc định | ❌ Không có (chờ mãi) | ✅ 5 giây |
| Test offline | Cần thư viện thêm (`responses`) | ✅ `MockTransport` có sẵn |
| Retry trạng thái 5xx | ✅ Qua `urllib3.Retry` | Tự viết (transport chỉ retry lỗi kết nối) |

> 💡 Dự án mới, nhất là dùng FastAPI/async → chọn **`httpx`**. Script đơn giản hoặc codebase đã dùng `requests` → cứ dùng `requests`.

## 📖 6. Xây dựng Web API với FastAPI

### Tại sao FastAPI?

Đến giờ ta là **client** gọi API của người khác. Giờ ta sẽ **làm server** - viết API cho app web/mobile gọi vào. **FastAPI** là framework hiện đại, rất phổ biến vì:

- Dùng **type hints** (Bài 4, 8) để **tự động kiểm tra dữ liệu** vào/ra
- **Tự sinh tài liệu API** tương tác tại `/docs`
- Nhanh, hỗ trợ async
- Viết ít code, dễ đọc

> 🧠 **Ví dụ dễ hiểu**: Nếu server là nhà hàng, thì FastAPI là **quản lý nhà hàng chu đáo** 🧑‍💼: tự kiểm tra phiếu gọi món có ghi đủ, đúng không (validation), tự in thực đơn đẹp cho khách xem (`/docs`), bạn (đầu bếp) chỉ cần tập trung nấu (logic nghiệp vụ).

### Cài đặt (trong venv)

```bash
python -m pip install "fastapi[standard]"      # Gồm fastapi, pydantic, uvicorn, httpx...
```

### Hello API

Tạo file `main.py`:

```python
# file: main.py
from fastapi import FastAPI

app = FastAPI(title="Shop API", version="1.0")


@app.get("/")                         # Khi có request GET tới "/" → gọi hàm này
def home():
    return {"message": "Xin chào từ FastAPI! 🚀"}   # dict tự chuyển thành JSON


@app.get("/health")
def health():
    return {"status": "ok"}
```

Chạy server phát triển (tự reload khi sửa code):

```bash
fastapi dev main.py
# hoặc: uvicorn main:app --reload
# INFO:     Uvicorn running on http://127.0.0.1:8000
```

Mở trình duyệt:

- `http://127.0.0.1:8000/` → `{"message":"Xin chào từ FastAPI! 🚀"}`
- `http://127.0.0.1:8000/docs` → **Swagger UI**: danh sách mọi endpoint, bấm "Try it out" để gọi thử ngay 🎉
- `http://127.0.0.1:8000/redoc` → tài liệu kiểu khác
- `http://127.0.0.1:8000/openapi.json` → đặc tả OpenAPI (máy đọc được, có thể dùng để tự sinh code client)

### Test không cần chạy server: `TestClient`

`TestClient` gọi thẳng vào app trong bộ nhớ, API giống hệt `httpx`. Từ đây, các ví dụ dùng `TestClient` để bạn chạy `python file.py` là thấy kết quả ngay:

```python
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)
resp = client.get("/")
print(resp.status_code, resp.json())
print(client.get("/khong-co").status_code)
print(sorted(client.get("/openapi.json").json()["paths"]))
# Output:
# 200 {'message': 'Xin chào từ FastAPI! 🚀'}
# 404
# ['/', '/health']
```

> ℹ️ Với các bản Starlette/FastAPI mới, khi import `TestClient` bạn có thể thấy dòng cảnh báo `StarletteDeprecationWarning: Using httpx with starlette.testclient is deprecated; install httpx2 instead` (in ra stderr). Đây chỉ là cảnh báo, kết quả không đổi; muốn tắt thì làm theo gợi ý: `python -m pip install httpx2`.

### Path parameters và Query parameters

- **Path param**: một phần của đường dẫn, xác định **tài nguyên nào**: `/products/42`
- **Query param**: sau dấu `?`, dùng để **lọc, sắp xếp, phân trang**: `/products?category=ao&limit=10`

FastAPI nhận biết qua chữ ký hàm: tham số có trong `{...}` của đường dẫn là path param, còn lại là query param. **Kiểu dữ liệu được kiểm tra và chuyển đổi tự động**:

```python
from enum import StrEnum
from typing import Annotated

from fastapi import FastAPI, Path, Query
from fastapi.testclient import TestClient

app = FastAPI()


class SortBy(StrEnum):
    PRICE = "price"
    NAME = "name"


@app.get("/products/{product_id}")
def get_product(product_id: Annotated[int, Path(ge=1)]):    # int và >= 1
    return {"product_id": product_id, "type": type(product_id).__name__}


@app.get("/products")
def list_products(
    category: str | None = None,                                  # Không bắt buộc
    min_price: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 10,              # 1..100
    sort: SortBy = SortBy.NAME,                                   # Chỉ nhận giá trị trong Enum
):
    return {"category": category, "min_price": min_price, "limit": limit, "sort": sort}


client = TestClient(app)
print(client.get("/products/42").json())             # "42" trong URL → int 42
print(client.get("/products", params={"category": "ao", "sort": "price"}).json())

for url in ["/products/abc", "/products/0", "/products?limit=500", "/products?sort=color"]:
    resp = client.get(url)
    err = resp.json()["detail"][0]
    print(resp.status_code, err["loc"], "-", err["msg"])
# Output:
# {'product_id': 42, 'type': 'int'}
# {'category': 'ao', 'min_price': 0, 'limit': 10, 'sort': 'price'}
# 422 ['path', 'product_id'] - Input should be a valid integer, unable to parse string as an integer
# 422 ['path', 'product_id'] - Input should be greater than or equal to 1
# 422 ['query', 'limit'] - Input should be less than or equal to 100
# 422 ['query', 'sort'] - Input should be 'price' or 'name'
```

Bạn **không viết một dòng `if` kiểm tra nào**, nhưng dữ liệu sai đều bị chặn với thông báo rõ ràng chỉ đúng **chỗ sai** (`loc`). Đó là sức mạnh của type hints + Pydantic.

### Request body với Pydantic v2

Dữ liệu gửi lên bằng `POST`/`PUT`/`PATCH` (JSON body) được mô tả bằng class kế thừa **`pydantic.BaseModel`** - trông giống `@dataclass` nhưng **kiểm tra và chuyển đổi dữ liệu** khi tạo object.

```python
from pydantic import BaseModel, Field, ValidationError, field_validator


class ProductIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    price: int = Field(gt=0, description="Giá bán (VND)")
    quantity: int = Field(default=0, ge=0)
    tags: list[str] = []

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = " ".join(value.split())          # Bỏ khoảng trắng thừa
        if value.lower().startswith("test"):
            raise ValueError("Tên sản phẩm không được bắt đầu bằng 'test'")
        return value.title()


# Dữ liệu hợp lệ - Pydantic tự chuyển "150000" (chuỗi) → 150000 (int)
p = ProductIn(name="  áo   thun  basic ", price="150000", tags=["ao"])
print(p)
print(p.model_dump())                             # → dict (v1 cũ là .dict())
print(p.model_dump_json())                        # → chuỗi JSON (v1 cũ là .json())

# Dữ liệu sai - gom TẤT CẢ lỗi một lần
try:
    ProductIn(name="x", price=-5, quantity="nhiều")
except ValidationError as error:
    for e in error.errors():
        print(e["loc"], e["msg"])
# Output:
# name='Áo Thun Basic' price=150000 quantity=0 tags=['ao']
# {'name': 'Áo Thun Basic', 'price': 150000, 'quantity': 0, 'tags': ['ao']}
# {"name":"Áo Thun Basic","price":150000,"quantity":0,"tags":["ao"]}
# ('name',) String should have at least 2 characters
# ('price',) Input should be greater than 0
# ('quantity',) Input should be a valid integer, unable to parse string as an integer
```

> ℹ️ Pydantic còn có sẵn nhiều kiểu tiện lợi như `EmailStr` (kiểm tra email - cần cài thêm `pip install "pydantic[email]"`, đã có sẵn nếu cài `fastapi[standard]`), `HttpUrl`, `PositiveInt`... Pydantic v2 đổi tên nhiều method so với v1: `.dict()` → `.model_dump()`, `.json()` → `.model_dump_json()`, `@validator` → `@field_validator`, `class Config` → `model_config`. Khi đọc tutorial cũ trên mạng, hãy để ý điều này.

### `response_model`, status code, `HTTPException`

- **`response_model`**: mô tả dữ liệu **trả ra** → FastAPI **lọc bỏ** field không khai báo (ví dụ mật khẩu, giá vốn) và ghi vào tài liệu.
- **`status_code`**: mã trả về khi thành công (tạo mới → `201`, xóa → `204`).
- **`HTTPException`**: "ném" lỗi HTTP ra cho client (404, 409...).

```python
from fastapi import FastAPI, HTTPException, status
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field

app = FastAPI()


class UserIn(BaseModel):
    username: str = Field(min_length=3)
    password: str = Field(min_length=8)


class UserOut(BaseModel):                  # KHÔNG có password
    id: int
    username: str


fake_db: dict[int, dict] = {}


@app.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(data: UserIn):
    if any(u["username"] == data.username for u in fake_db.values()):
        raise HTTPException(status_code=409, detail="Username đã tồn tại")
    user_id = len(fake_db) + 1
    fake_db[user_id] = {"id": user_id, **data.model_dump(), "is_admin": False}
    return fake_db[user_id]                # Trả cả dict có password... response_model sẽ lọc!


@app.get("/users/{user_id}", response_model=UserOut)
def get_user(user_id: int):
    if user_id not in fake_db:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"Không có user {user_id}")
    return fake_db[user_id]


@app.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: int):
    if fake_db.pop(user_id, None) is None:
        raise HTTPException(404, detail="Không có user")
    # 204 No Content: không trả body


client = TestClient(app)
r = client.post("/users", json={"username": "an", "password": "12345678"})
print(r.status_code, r.json()["detail"][0]["msg"])
r = client.post("/users", json={"username": "annguyen", "password": "12345678"})
print(r.status_code, r.json())                 # Không lộ password!
print(client.post("/users", json={"username": "annguyen", "password": "abcdefgh"}).json())
print(client.get("/users/99").json())
print(client.delete("/users/1").status_code, client.get("/users/1").status_code)
# Output:
# 422 String should have at least 3 characters
# 201 {'id': 1, 'username': 'annguyen'}
# {'detail': 'Username đã tồn tại'}
# {'detail': 'Không có user 99'}
# 204 404
```

### Dependency Injection với `Depends`

Nhiều endpoint cần cùng một thứ: kết nối database, user đang đăng nhập, tham số phân trang... Thay vì lặp code, ta viết **hàm dependency** và "khai báo nhu cầu" bằng `Depends`. FastAPI tự gọi hàm đó và đưa kết quả vào.

> 🧠 **Ví dụ dễ hiểu**: Đầu bếp (endpoint) chỉ cần nói "tôi cần hành đã thái" (`Depends(thai_hanh)`). Phụ bếp (FastAPI) tự thái và mang tới. Đầu bếp không cần biết hành mua ở đâu - và khi **test**, ta dễ dàng thay "phụ bếp thật" bằng "phụ bếp giả" (`dependency_overrides`).

```python
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel

app = FastAPI()
TOKENS = {"token-an": "an", "token-binh": "binh"}
ADMINS = {"an"}


# Dependency 1: tham số phân trang dùng chung
class Pagination(BaseModel):
    skip: int = 0
    limit: int = 10


def pagination(skip: int = 0, limit: int = 10) -> Pagination:
    return Pagination(skip=skip, limit=min(limit, 50))    # Chặn limit quá lớn


# Dependency 2: lấy user từ header Authorization
def current_user(authorization: Annotated[str | None, Header()] = None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, detail="Chưa đăng nhập")
    user = TOKENS.get(authorization.removeprefix("Bearer "))
    if user is None:
        raise HTTPException(401, detail="Token không hợp lệ")
    return user


# Dependency 3: dependency dùng dependency khác (xếp chồng)
def admin_user(user: Annotated[str, Depends(current_user)]) -> str:
    if user not in ADMINS:
        raise HTTPException(403, detail="Cần quyền admin")
    return user


# Dependency 4: dạng yield - chạy phần "dọn dẹp" sau khi request xong (vd: đóng kết nối DB)
def get_db():
    db = {"connected": True}
    print("   🔌 mở kết nối DB")
    try:
        yield db
    finally:
        print("   🔒 đóng kết nối DB")


CurrentUser = Annotated[str, Depends(current_user)]      # Đặt alias cho gọn


@app.get("/orders")
def my_orders(user: CurrentUser, page: Annotated[Pagination, Depends(pagination)],
              db: Annotated[dict, Depends(get_db)]):
    return {"user": user, "skip": page.skip, "limit": page.limit, "db": db["connected"]}


@app.delete("/orders/{order_id}")
def delete_order(order_id: int, admin: Annotated[str, Depends(admin_user)]):
    return {"deleted": order_id, "by": admin}


client = TestClient(app)
print(client.get("/orders").json())
print(client.get("/orders?limit=999", headers={"Authorization": "Bearer token-binh"}).json())
print(client.delete("/orders/5", headers={"Authorization": "Bearer token-binh"}).json())
print(client.delete("/orders/5", headers={"Authorization": "Bearer token-an"}).json())

# Khi test: thay dependency thật bằng giả
app.dependency_overrides[current_user] = lambda: "tester"
print(client.get("/orders").json()["user"])
# Output:
# {'detail': 'Chưa đăng nhập'}
#    🔌 mở kết nối DB
#    🔒 đóng kết nối DB
# {'user': 'binh', 'skip': 0, 'limit': 50, 'db': True}
# {'detail': 'Cần quyền admin'}
# {'deleted': 5, 'by': 'an'}
#    🔌 mở kết nối DB
#    🔒 đóng kết nối DB
# tester
```

> 💡 Ví dụ trên dùng token cố định cho dễ hiểu. Ứng dụng thật dùng **JWT** hoặc session, và mật khẩu phải được băm (Bài 11). Xem hướng dẫn "Security" trong tài liệu FastAPI.

### Router, Middleware, CORS, Background Tasks

Khi API lớn dần, không thể nhét mọi endpoint vào một file. **`APIRouter`** giúp chia theo nhóm (mỗi router một file: `routers/products.py`, `routers/users.py`...).

- **Middleware**: đoạn code chạy **trước và sau mọi request** - đo thời gian, ghi log, thêm header.
- **CORS**: trình duyệt mặc định **chặn** trang web ở tên miền A gọi API ở tên miền B. Muốn frontend `http://localhost:3000` gọi API `http://localhost:8000`, server phải cho phép qua `CORSMiddleware`.
- **Background tasks**: việc chậm mà client không cần chờ (gửi email, ghi log thống kê) → trả response ngay, làm việc đó **sau**.

```python
import time

from fastapi import APIRouter, BackgroundTasks, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

# ---- routers/orders.py ----
router = APIRouter(prefix="/orders", tags=["Đơn hàng"])
sent_emails: list[str] = []


def send_confirmation_email(email: str, order_id: int) -> None:
    time.sleep(0.1)                                  # Giả lập gửi email mất thời gian
    sent_emails.append(f"{email}: đơn #{order_id}")


@router.post("", status_code=201)
def create_order(email: str, background_tasks: BackgroundTasks):
    order_id = 1001
    background_tasks.add_task(send_confirmation_email, email, order_id)   # Chạy SAU khi trả response
    return {"order_id": order_id, "message": "Đã nhận đơn, email xác nhận sẽ được gửi"}


@router.get("/{order_id}")
def get_order(order_id: int):
    return {"order_id": order_id}


# ---- main.py ----
app = FastAPI()
app.include_router(router)                           # Gắn router vào app

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://shop.example.com"],   # Frontend được phép
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_process_time(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)              # Chuyển request cho endpoint xử lý
    response.headers["X-Process-Time-ms"] = f"{(time.perf_counter() - start) * 1000:.0f}"
    return response


client = TestClient(app)
r = client.post("/orders", params={"email": "an@mail.com"})
print(r.status_code, r.json()["order_id"], "| có header thời gian:", "x-process-time-ms" in r.headers)
print(sent_emails)                                   # TestClient chờ background task xong

r = client.get("/orders/7", headers={"Origin": "http://localhost:3000"})
print(r.headers.get("access-control-allow-origin"))
r = client.get("/orders/7", headers={"Origin": "https://evil.example"})
print(r.headers.get("access-control-allow-origin"))
# Output:
# 201 1001 | có header thời gian: True
# ['an@mail.com: đơn #1001']
# http://localhost:3000
# None
```

> ⚠️ `BackgroundTasks` chạy **trong cùng tiến trình** server - hợp với việc nhẹ. Việc nặng/quan trọng (xử lý video, gửi 10.000 email) nên dùng hàng đợi chuyên dụng như **Celery**, **RQ**, **arq** để không mất việc khi server khởi động lại.

### 💡 Tips quan trọng

- Mọi dữ liệu vào đều khai báo bằng **type hints / Pydantic model** → không cần tự viết `if` kiểm tra ✅
- Luôn có **`response_model`** riêng cho dữ liệu trả ra (`UserOut`), đừng trả thẳng object nội bộ ❌
- Dùng đúng status code: tạo → `201`, xóa → `204`, không tìm thấy → `404`, trùng → `409` ✅
- Logic dùng chung (auth, DB, phân trang) → **`Depends`** ✅
- Endpoint `def` thường: FastAPI tự chạy trong threadpool. Chỉ dùng `async def` khi bên trong **toàn gọi thư viện async** (`httpx.AsyncClient`...) - gọi hàm chặn (`time.sleep`, `requests`) trong `async def` sẽ làm **đứng cả server** ❌
- Chạy production: `uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4` (hoặc `fastapi run main.py`), phía trước thường có Nginx ✅

## 📖 7. FastAPI, Flask hay Django?

| | **FastAPI** | **Flask** | **Django** |
| --- | --- | --- | --- |
| Triết lý | API hiện đại, type hints | Tối giản, tự chọn thành phần | "Pin kèm sẵn" - có đủ mọi thứ |
| Validation dữ liệu | ✅ Pydantic, tự động | Cài thêm (marshmallow...) | Forms / Django REST Framework |
| Tài liệu API tự động | ✅ `/docs` | Cài thêm | Cài thêm (DRF + drf-spectacular) |
| Async | ✅ Gốc | Hạn chế | Có, đang hoàn thiện |
| ORM, trang admin, đăng nhập | ❌ Tự chọn (SQLAlchemy - Bài 13) | ❌ Tự chọn | ✅ Có sẵn, rất mạnh |
| Phù hợp | API cho app mobile/SPA, microservice, phục vụ model AI | App nhỏ, prototype, học nguyên lý | Web lớn nhiều chức năng: CMS, thương mại điện tử, hệ thống nội bộ |

Cùng một endpoint trong Flask để so sánh:

```text
from flask import Flask, jsonify, request

app = Flask(__name__)

@app.get("/products/<int:product_id>")
def get_product(product_id):
    return jsonify({"product_id": product_id})

@app.post("/products")
def create_product():
    data = request.get_json()
    if not data or "name" not in data or data.get("price", 0) <= 0:   # Tự kiểm tra bằng tay
        return jsonify({"error": "Dữ liệu không hợp lệ"}), 400
    return jsonify(data), 201
```

> 💡 Không có framework "tốt nhất", chỉ có framework **hợp nhất** với bài toán. Kiến thức HTTP, REST, validation, status code bạn học ở bài này **dùng được cho mọi framework**.

## 🌍 Ứng dụng thực tế

### Ứng dụng 1: Client tỷ giá & thời tiết (chuẩn production, test offline)

Yêu cầu: gói việc gọi API bên ngoài vào **một class client** có timeout, retry (tự viết với backoff, chỉ retry lỗi tạm thời), cache ngắn hạn, exception riêng. Code nghiệp vụ chỉ gọi `client.convert(...)` mà không biết gì về HTTP. Test hoàn toàn offline bằng `MockTransport` - kể cả tình huống server lỗi.

```python
"""market_client.py - Client gọi API tỷ giá/thời tiết."""

import logging
import time
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)


class ApiError(Exception):
    """Lỗi khi gọi API bên ngoài - code nghiệp vụ chỉ cần bắt lỗi này."""


@dataclass(frozen=True)
class Weather:
    city: str
    temp: float
    desc: str


class MarketClient:
    RETRY_STATUSES = {429, 500, 502, 503, 504}

    def __init__(self, base_url: str, api_key: str, *, retries: int = 3,
                 cache_seconds: float = 60, transport: httpx.BaseTransport | None = None):
        self._client = httpx.Client(
            base_url=base_url,
            headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json"},
            timeout=httpx.Timeout(5.0, connect=2.0),
            transport=transport,              # Test: truyền MockTransport; thật: để None
        )
        self._retries = retries
        self._cache_seconds = cache_seconds
        self._cache: dict[str, tuple[float, dict]] = {}

    def _get(self, path: str, **params) -> dict:
        key = f"{path}?{sorted(params.items())}"
        cached = self._cache.get(key)
        if cached and time.monotonic() - cached[0] < self._cache_seconds:
            return cached[1]                  # Dùng lại kết quả gần đây, khỏi gọi API

        for attempt in range(1, self._retries + 1):
            try:
                resp = self._client.get(path, params=params)
            except httpx.TransportError as error:        # Mất mạng, timeout...
                reason = f"{type(error).__name__}"
            else:
                if resp.status_code not in self.RETRY_STATUSES:
                    if resp.is_error:                    # 4xx: gửi lại cũng vô ích
                        raise ApiError(f"{resp.status_code}: {resp.json().get('error')}")
                    data = resp.json()
                    self._cache[key] = (time.monotonic(), data)
                    return data
                reason = f"HTTP {resp.status_code}"
            wait = 0.05 * 2 ** (attempt - 1)             # Backoff: 0.05s, 0.1s, 0.2s...
            print(f"   ↻ Lần {attempt} lỗi ({reason}), thử lại sau {wait:.2f}s")
            time.sleep(wait)
        raise ApiError(f"Thất bại sau {self._retries} lần thử: {path}")

    def rate(self, currency: str) -> int:
        return self._get("/rates", base="VND")["rates"][currency.upper()]

    def convert(self, amount: float, currency: str) -> int:
        return round(amount * self.rate(currency))

    def weather(self, city: str) -> Weather:
        return Weather(**self._get(f"/weather/{city}"))

    def close(self) -> None:
        self._client.close()


# ================= DEMO / TEST OFFLINE với MockTransport =================
def make_fake_server():
    calls = {"rates": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.headers.get("Authorization") != "Bearer KEY123":
            return httpx.Response(401, json={"error": "API key sai"})
        if request.url.path == "/rates":
            calls["rates"] += 1
            if calls["rates"] == 1:                       # Lần gọi đầu: server quá tải
                return httpx.Response(503, json={"error": "busy"})
            return httpx.Response(200, json={"base": "VND", "rates": {"USD": 25400, "EUR": 27600}})
        if request.url.path == "/weather/danang":
            return httpx.Response(200, json={"city": "Đà Nẵng", "temp": 29.5, "desc": "Nắng nhẹ"})
        if request.url.path == "/weather/atlantis":
            raise httpx.ConnectTimeout("Không kết nối được")   # Giả lập timeout
        return httpx.Response(404, json={"error": "không tìm thấy thành phố"})

    return handler, calls


handler, calls = make_fake_server()
client = MarketClient("https://api.fake", "KEY123", transport=httpx.MockTransport(handler))

print(f"100 USD = {client.convert(100, 'usd'):,} VND")
print(f"50 EUR = {client.convert(50, 'EUR'):,} VND")
print("Số lần thật sự gọi /rates:", calls["rates"])      # 1 lỗi + 1 thành công, lần 2 dùng cache
print(client.weather("danang"))

for city in ["hue", "atlantis"]:
    try:
        client.weather(city)
    except ApiError as error:
        print("ApiError:", error)

bad = MarketClient("https://api.fake", "WRONG", transport=httpx.MockTransport(handler))
try:
    bad.rate("USD")
except ApiError as error:
    print("ApiError:", error)
client.close()
bad.close()
# Output:
#    ↻ Lần 1 lỗi (HTTP 503), thử lại sau 0.05s
# 100 USD = 2,540,000 VND
# 50 EUR = 1,380,000 VND
# Số lần thật sự gọi /rates: 2
# Weather(city='Đà Nẵng', temp=29.5, desc='Nắng nhẹ')
# ApiError: 404: không tìm thấy thành phố
#    ↻ Lần 1 lỗi (ConnectTimeout), thử lại sau 0.05s
#    ↻ Lần 2 lỗi (ConnectTimeout), thử lại sau 0.10s
#    ↻ Lần 3 lỗi (ConnectTimeout), thử lại sau 0.20s
# ApiError: Thất bại sau 3 lần thử: /weather/atlantis
# ApiError: 401: API key sai
```

> 💡 Khi dùng thật, chỉ cần `MarketClient("https://api.that-cua-ban.com", os.environ["MARKET_API_KEY"])` - API key đọc từ **biến môi trường** (Bài 11), không bao giờ viết cứng trong code.

### Ứng dụng 2: REST API quản lý sản phẩm (CRUD + validation + test)

API đầy đủ: tạo, xem, lọc/phân trang, sửa một phần (PATCH), xóa. Tách **model vào/ra**, **tầng lưu trữ** (repository - ở Bài 13 sẽ thay bằng database thật mà không phải sửa endpoint), và **test tự động**.

```python
# file: products_api.py
"""REST API quản lý sản phẩm. Chạy: fastapi dev products_api.py → http://127.0.0.1:8000/docs"""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator


# ---------- Schemas (dữ liệu vào/ra) ----------
class ProductBase(BaseModel):
    name: str = Field(min_length=2, max_length=100, examples=["Áo thun basic"])
    sku: str = Field(pattern=r"^[A-Z]{2,5}-\d{3,6}$", examples=["AO-001"])
    price: int = Field(gt=0, le=1_000_000_000, description="Giá bán (VND)")
    stock: int = Field(default=0, ge=0)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return " ".join(v.split())


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):              # PATCH: mọi field đều không bắt buộc
    model_config = ConfigDict(extra="forbid")   # Gửi field lạ → lỗi 422 (tránh gõ nhầm tên field)
    name: str | None = Field(default=None, min_length=2, max_length=100)
    price: int | None = Field(default=None, gt=0)
    stock: int | None = Field(default=None, ge=0)


class ProductOut(ProductBase):
    id: int
    created_at: datetime


class ProductPage(BaseModel):
    items: list[ProductOut]
    total: int


# ---------- Repository (tầng lưu trữ, tạm dùng dict trong RAM) ----------
class InMemoryProductRepo:
    def __init__(self) -> None:
        self._items: dict[int, dict] = {}
        self._next_id = 1

    def add(self, data: dict) -> dict:
        product = {"id": self._next_id, "created_at": datetime.now(timezone.utc), **data}
        self._items[self._next_id] = product
        self._next_id += 1
        return product

    def get(self, product_id: int) -> dict | None:
        return self._items.get(product_id)

    def find_by_sku(self, sku: str) -> dict | None:
        return next((p for p in self._items.values() if p["sku"] == sku), None)

    def search(self, q: str | None, max_price: int | None) -> list[dict]:
        result = list(self._items.values())
        if q:
            result = [p for p in result if q.lower() in p["name"].lower()]
        if max_price is not None:
            result = [p for p in result if p["price"] <= max_price]
        return result

    def update(self, product_id: int, changes: dict) -> dict:
        self._items[product_id].update(changes)
        return self._items[product_id]

    def delete(self, product_id: int) -> bool:
        return self._items.pop(product_id, None) is not None


_repo = InMemoryProductRepo()


def get_repo() -> InMemoryProductRepo:     # Dependency → test có thể thay repo khác
    return _repo


Repo = Annotated[InMemoryProductRepo, Depends(get_repo)]


# ---------- Endpoints ----------
router = APIRouter(prefix="/products", tags=["Sản phẩm"])


def get_or_404(repo: InMemoryProductRepo, product_id: int) -> dict:
    product = repo.get(product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Không tìm thấy sản phẩm {product_id}")
    return product


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(data: ProductCreate, repo: Repo):
    if repo.find_by_sku(data.sku):
        raise HTTPException(status.HTTP_409_CONFLICT, f"SKU {data.sku} đã tồn tại")
    return repo.add(data.model_dump())


@router.get("", response_model=ProductPage)
def list_products(
    repo: Repo,
    q: Annotated[str | None, Query(max_length=50, description="Tìm theo tên")] = None,
    max_price: Annotated[int | None, Query(gt=0)] = None,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
):
    items = repo.search(q, max_price)
    return {"items": items[skip:skip + limit], "total": len(items)}


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, repo: Repo):
    return get_or_404(repo, product_id)


@router.patch("/{product_id}", response_model=ProductOut)
def update_product(product_id: int, changes: ProductUpdate, repo: Repo):
    get_or_404(repo, product_id)
    # exclude_unset: chỉ lấy field client THỰC SỰ gửi lên (không ghi đè bằng None)
    return repo.update(product_id, changes.model_dump(exclude_unset=True))


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, repo: Repo):
    if not repo.delete(product_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Không tìm thấy sản phẩm {product_id}")


app = FastAPI(title="Product API", version="1.0")
app.include_router(router)
```

Test tự động với pytest - mỗi test dùng **repo mới** nhờ `dependency_overrides`, nên các test không ảnh hưởng nhau:

```python
# file: test_products_api.py
"""Chạy: python -m pytest -v test_products_api.py"""

import pytest
from fastapi.testclient import TestClient

from products_api import InMemoryProductRepo, app, get_repo


@pytest.fixture
def client():
    repo = InMemoryProductRepo()
    app.dependency_overrides[get_repo] = lambda: repo     # Mỗi test một repo sạch
    yield TestClient(app)
    app.dependency_overrides.clear()


def make(client, **overrides):
    data = {"name": "Áo thun", "sku": "AO-001", "price": 150_000, "stock": 10} | overrides
    return client.post("/products", json=data)


def test_create_and_get(client):
    resp = make(client, name="  Áo   thun  ")
    assert resp.status_code == 201
    body = resp.json()
    assert body["id"] == 1 and body["name"] == "Áo thun"
    assert client.get("/products/1").json()["sku"] == "AO-001"


@pytest.mark.parametrize("field,value", [
    ("price", 0), ("price", "abc"), ("sku", "ao001"), ("name", "A"), ("stock", -1),
])
def test_create_invalid(client, field, value):
    resp = make(client, **{field: value})
    assert resp.status_code == 422
    assert resp.json()["detail"][0]["loc"] == ["body", field]


def test_duplicate_sku(client):
    make(client)
    assert make(client).status_code == 409


def test_list_filter_and_paging(client):
    for i, price in enumerate([100_000, 200_000, 300_000], start=1):
        make(client, sku=f"AO-00{i}", name=f"Áo mẫu {i}", price=price)
    make(client, sku="QU-001", name="Quần jean", price=400_000)
    assert client.get("/products").json()["total"] == 4
    assert client.get("/products", params={"q": "áo", "max_price": 250_000}).json()["total"] == 2
    page = client.get("/products", params={"skip": 3, "limit": 2}).json()
    assert [p["sku"] for p in page["items"]] == ["QU-001"]


def test_patch_only_sent_fields(client):
    make(client)
    resp = client.patch("/products/1", json={"price": 99_000})
    assert resp.json()["price"] == 99_000 and resp.json()["stock"] == 10
    assert client.patch("/products/1", json={"colour": "red"}).status_code == 422


def test_delete(client):
    make(client)
    assert client.delete("/products/1").status_code == 204
    assert client.get("/products/1").status_code == 404
    assert client.delete("/products/1").status_code == 404
```

```bash
python -m pytest -q test_products_api.py
# Output:
# ..........                                                               [100%]
# 10 passed in 0.40s
```

> ℹ️ Tùy phiên bản thư viện, pytest có thể in thêm vài dòng `warnings summary` (DeprecationWarning) - không ảnh hưởng kết quả test.

Và thử nhanh bằng script (hoặc mở `/docs` sau khi chạy `fastapi dev products_api.py`):

```python
from fastapi.testclient import TestClient

from products_api import app

client = TestClient(app)
r = client.post("/products", json={"name": "Bàn phím cơ", "sku": "KB-100", "price": 1_250_000, "stock": 5})
print(r.status_code, {k: v for k, v in r.json().items() if k != "created_at"})
r = client.post("/products", json={"name": "Chuột", "sku": "mouse", "price": -1})
print(r.status_code, [(e["loc"][-1], e["type"]) for e in r.json()["detail"]])
print(client.patch("/products/1", json={"stock": 3}).json()["stock"])
print(client.get("/products", params={"q": "phím"}).json()["total"])
# Output:
# 201 {'name': 'Bàn phím cơ', 'sku': 'KB-100', 'price': 1250000, 'stock': 5, 'id': 1}
# 422 [('sku', 'string_pattern_mismatch'), ('price', 'greater_than')]
# 3
# 1
```

### Ứng dụng 3: Webhook receiver có xác thực chữ ký HMAC

**Webhook** là "API gọi ngược": thay vì bạn liên tục hỏi cổng thanh toán "khách trả tiền chưa?", cổng thanh toán **tự gọi vào URL của bạn** khi có sự kiện. Vấn đề: URL đó công khai trên internet - **kẻ xấu cũng gọi được** và giả mạo "đơn DH01 đã thanh toán" 😱.

Giải pháp (Stripe, GitHub, các cổng thanh toán Việt Nam đều làm tương tự): hai bên chia sẻ một **secret**. Bên gửi tính **chữ ký HMAC-SHA256** của body và gửi kèm trong header. Bên nhận tính lại và so sánh. Kẻ xấu không có secret thì không thể tạo chữ ký đúng. Thêm **timestamp** để chống gửi lại request cũ (replay attack).

> 🧠 **Ví dụ dễ hiểu**: Giống **con dấu giáp lai** trên giấy tờ 📜. Chỉ cơ quan có con dấu (secret) mới đóng được dấu khớp. Ai sửa nội dung giấy (body) thì dấu không còn khớp nữa.

```python
"""webhook_app.py - Nhận webhook thanh toán có xác thực chữ ký HMAC."""

import hashlib
import hmac
import json
import time

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.testclient import TestClient

WEBHOOK_SECRET = b"whsec_demo_secret"    # Thực tế: đọc từ biến môi trường
TOLERANCE_SECONDS = 300                  # Chỉ chấp nhận webhook trong vòng 5 phút
processed_events: set[str] = set()       # Chống xử lý trùng (thực tế: lưu trong DB)
orders = {"DH01": "pending", "DH02": "pending"}

app = FastAPI()


def compute_signature(secret: bytes, timestamp: str, body: bytes) -> str:
    message = timestamp.encode() + b"." + body          # Ký cả timestamp để không sửa được
    return hmac.new(secret, message, hashlib.sha256).hexdigest()


@app.post("/webhooks/payment")
async def payment_webhook(
    request: Request,
    x_signature: str = Header(),         # FastAPI tự đọc header "X-Signature"
    x_timestamp: str = Header(),
):
    body = await request.body()          # ⚠️ Phải ký trên BYTES GỐC, không phải JSON đã parse lại

    if not x_timestamp.isdigit() or abs(time.time() - int(x_timestamp)) > TOLERANCE_SECONDS:
        raise HTTPException(400, "Timestamp không hợp lệ hoặc quá cũ")
    expected = compute_signature(WEBHOOK_SECRET, x_timestamp, body)
    if not hmac.compare_digest(expected, x_signature):  # So sánh an toàn (Bài 11)
        raise HTTPException(401, "Chữ ký không hợp lệ")

    event = json.loads(body)
    if event["id"] in processed_events:                 # Bên gửi thường retry → có thể nhận trùng
        return {"status": "duplicate_ignored"}
    processed_events.add(event["id"])

    if event["type"] == "payment.succeeded":
        orders[event["order_id"]] = "paid"
    return {"status": "ok"}


# ================= Giả lập bên gửi (cổng thanh toán) =================
def send_webhook(client: TestClient, event: dict, secret: bytes = WEBHOOK_SECRET,
                 timestamp: int | None = None, tamper: bool = False):
    body = json.dumps(event).encode()
    ts = str(timestamp if timestamp is not None else int(time.time()))
    signature = compute_signature(secret, ts, body)
    if tamper:                                          # Kẻ xấu sửa body sau khi ký
        body = body.replace(b"DH01", b"DH02")
    resp = client.post("/webhooks/payment", content=body,
                       headers={"X-Signature": signature, "X-Timestamp": ts,
                                "Content-Type": "application/json"})
    return resp.status_code, resp.json()


client = TestClient(app)
event = {"id": "evt_001", "type": "payment.succeeded", "order_id": "DH01", "amount": 250000}

print("Hợp lệ:       ", send_webhook(client, event))
print("Gửi trùng:    ", send_webhook(client, event))
print("Sai secret:   ", send_webhook(client, {**event, "id": "evt_002"}, secret=b"hacker"))
print("Sửa nội dung: ", send_webhook(client, {**event, "id": "evt_003"}, tamper=True))
print("Quá cũ:       ", send_webhook(client, {**event, "id": "evt_004"}, timestamp=int(time.time()) - 3600))
print("Thiếu header: ", client.post("/webhooks/payment", json=event).status_code)
print("Trạng thái đơn:", orders)
# Output:
# Hợp lệ:        (200, {'status': 'ok'})
# Gửi trùng:     (200, {'status': 'duplicate_ignored'})
# Sai secret:    (401, {'detail': 'Chữ ký không hợp lệ'})
# Sửa nội dung:  (401, {'detail': 'Chữ ký không hợp lệ'})
# Quá cũ:        (400, {'detail': 'Timestamp không hợp lệ hoặc quá cũ'})
# Thiếu header:  422
# Trạng thái đơn: {'DH01': 'paid', 'DH02': 'pending'}
```

> 💡 Ba lớp bảo vệ của một webhook receiver chuẩn: **(1) chữ ký HMAC** - đúng người gửi, nội dung không bị sửa; **(2) timestamp** - chống phát lại request cũ; **(3) idempotency theo `event id`** - bên gửi retry nhiều lần cũng chỉ xử lý một lần. Thêm nữa: webhook nên **trả về 200 thật nhanh**, việc nặng thì đẩy vào background task.

## ⚠️ Lỗi thường gặp

### 1. Quên timeout

`requests.get(url)` không timeout → script treo vĩnh viễn khi server không phản hồi. ✅ Luôn truyền `timeout=...` (hoặc dùng `httpx` có timeout mặc định).

### 2. Quên kiểm tra status code

```text
data = requests.get(url, timeout=5).json()    # ❌ Nếu server trả 500 với HTML → lỗi JSONDecodeError khó hiểu
resp = requests.get(url, timeout=5)
resp.raise_for_status()                        # ✅ Báo lỗi HTTP rõ ràng trước
data = resp.json()
```

### 3. Nhầm `data=` với `json=`

`requests.post(url, data={"a": 1})` gửi dạng **form** (`a=1`), không phải JSON. Gửi JSON phải dùng `json={"a": 1}`. Server FastAPI nhận body dạng form sẽ trả 422.

### 4. Viết cứng API key trong code

❌ `headers={"Authorization": "Bearer sk_live_abc..."}` rồi đẩy lên GitHub → bot quét được trong vài phút. ✅ `os.environ["API_KEY"]`.

### 5. Retry mọi thứ, kể cả POST và lỗi 4xx

Retry 400/401/404 là vô ích; retry POST không có idempotency key có thể **tạo dữ liệu trùng**. ✅ Chỉ retry lỗi tạm thời, có backoff, có giới hạn số lần.

### 6. FastAPI: `422 Unprocessable Content` mà không hiểu vì sao

Đọc kỹ `detail` - trường `loc` chỉ đúng chỗ sai: `["body", "price"]`, `["query", "limit"]`... Hay gặp: gửi form thay vì JSON, thiếu field bắt buộc, sai kiểu, quên header `Content-Type: application/json` khi tự gửi `content=`.

### 7. Hàm chặn trong `async def`

```text
@app.get("/slow")
async def slow():
    time.sleep(5)                   # ❌ Đứng CẢ server 5 giây - mọi request khác phải chờ
    requests.get("https://...")     # ❌ Tương tự

@app.get("/slow")
def slow():                         # ✅ def thường: FastAPI chạy trong threadpool riêng
    time.sleep(5)
```

### 8. Trả thẳng dữ liệu nội bộ, lộ thông tin nhạy cảm

Không khai báo `response_model` → trả nguyên dict có `password_hash`, `cost_price`... ✅ Luôn có schema `...Out` riêng.

### 9. Mở CORS toàn bộ trên production

`allow_origins=["*"]` kèm `allow_credentials=True` là cấu hình nguy hiểm (và trình duyệt cũng từ chối). ✅ Liệt kê cụ thể các tên miền frontend.

### 10. Webhook: verify chữ ký trên JSON đã parse lại

`json.dumps(await request.json())` có thể khác bytes gốc (thứ tự key, khoảng trắng, escape Unicode) → chữ ký không bao giờ khớp. ✅ Luôn dùng `await request.body()`.

## 🏋️ Bài tập

### Bài tập 1 (Dễ): Gọi API với urllib và requests

Dùng `demo_server.py`, viết hàm `get_rate(currency)` hai phiên bản: một bằng `urllib`, một bằng `requests`. Cả hai phải có timeout và trả về `None` khi có lỗi (kèm `logging.warning`).

### Bài tập 2 (Dễ): Endpoint đổi tiền

Viết FastAPI endpoint `GET /convert?amount=100&from_currency=USD` trả về số tiền VND. `amount` phải > 0, `from_currency` là `StrEnum` gồm `USD`, `EUR`, `JPY`. Test bằng `TestClient` cả trường hợp đúng và sai.

### Bài tập 3 (Trung bình): Client có retry cho httpx

Viết class `RetryTransport(httpx.BaseTransport)` bọc một transport khác, tự retry khi gặp 429/5xx, tôn trọng header `Retry-After` nếu có. Test bằng `MockTransport` đếm số lần được gọi.

### Bài tập 4 (Trung bình): Mở rộng Product API

Thêm vào Ứng dụng 2:

- `GET /products?sort=price` và `sort=-price` (giảm dần)
- `POST /products/{id}/stock` với body `{"delta": -3}` - không cho tồn kho âm (trả 409)
- Middleware ghi log mỗi request: method, đường dẫn, status, thời gian xử lý
- Viết thêm test cho các tính năng mới

### Bài tập 5 (Khó): Hệ thống đơn hàng + webhook

Kết hợp Ứng dụng 2 và 3: `POST /orders` tạo đơn trạng thái `pending` (trừ tồn kho), webhook `payment.succeeded` chuyển sang `paid`, `payment.failed` chuyển sang `cancelled` và **hoàn lại tồn kho**. Viết script giả lập cổng thanh toán gửi webhook có chữ ký, và test đầy đủ các trường hợp (kể cả webhook đến 2 lần, webhook cho đơn không tồn tại).

<details>
<summary>💡 Xem đáp án Bài tập 2</summary>

```python
from enum import StrEnum
from typing import Annotated

from fastapi import FastAPI, Query
from fastapi.testclient import TestClient

RATES = {"USD": 25_400, "EUR": 27_600, "JPY": 170}


class Currency(StrEnum):
    USD = "USD"
    EUR = "EUR"
    JPY = "JPY"


app = FastAPI()


@app.get("/convert")
def convert(amount: Annotated[float, Query(gt=0)], from_currency: Currency):
    vnd = round(amount * RATES[from_currency])
    return {"amount": amount, "from": from_currency, "vnd": vnd, "text": f"{vnd:,} VND"}


client = TestClient(app)
print(client.get("/convert", params={"amount": 100, "from_currency": "USD"}).json())
print(client.get("/convert", params={"amount": -1, "from_currency": "USD"}).status_code)
print(client.get("/convert", params={"amount": 1, "from_currency": "BTC"}).status_code)
# Output:
# {'amount': 100.0, 'from': 'USD', 'vnd': 2540000, 'text': '2,540,000 VND'}
# 422
# 422
```

</details>

## ✅ Checklist hoàn thành

- [ ] Giải thích được request/response, method, status code (2xx/4xx/5xx), header, JSON
- [ ] Gọi API bằng `urllib` và hiểu hạn chế của nó
- [ ] Dùng `requests`: `params`, `json`, `headers`, `timeout`, `raise_for_status`, `Session`
- [ ] Cấu hình retry với backoff, biết khi nào **không** nên retry
- [ ] Viết generator đọc API có phân trang
- [ ] Dùng `httpx` sync/async và test offline bằng `MockTransport`
- [ ] Viết FastAPI endpoint với path/query params có ràng buộc
- [ ] Viết Pydantic v2 model với `Field`, `field_validator`, `model_dump`
- [ ] Dùng `response_model`, status code đúng, `HTTPException`
- [ ] Dùng `Depends` (kể cả dạng `yield`) và `dependency_overrides` khi test
- [ ] Biết dùng `APIRouter`, middleware, CORS, `BackgroundTasks`
- [ ] Viết test API bằng `TestClient` + pytest
- [ ] Xác thực webhook bằng HMAC + timestamp + idempotency
- [ ] Chọn được framework phù hợp: FastAPI / Flask / Django

## 🚀 Tiếp theo

Product API của chúng ta đang lưu dữ liệu trong RAM - tắt server là mất hết! Bài tiếp theo sẽ học cách lưu dữ liệu **bền vững và an toàn** bằng **database**: SQL, SQLite, SQLAlchemy, và cuối cùng thay `InMemoryProductRepo` bằng database thật.

**Bài tiếp theo**: [Làm việc với Database](./13-databases.md)

---

💡 **Tips nhớ lâu**:

- **4xx = lỗi của bạn, 5xx = lỗi của server** - chỉ retry lỗi tạm thời
- **Không timeout = bom hẹn giờ**
- **API key ở biến môi trường, không ở trong code**
- **Test code gọi API bằng `MockTransport`**, không phụ thuộc internet
- **Type hints là validation** trong FastAPI - khai báo đúng kiểu là đã kiểm tra dữ liệu
- **Model vào (`...In`/`...Create`) và model ra (`...Out`) luôn tách riêng**
- **Webhook: ký HMAC trên bytes gốc, so sánh bằng `hmac.compare_digest`**
