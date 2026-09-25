# 📚 Bài 8: Modules & Packages

## 🎯 Mục tiêu bài học

- Hiểu **module** và **package** là gì, tại sao cần chia nhỏ code
- Thành thạo các kiểu `import` và biết khi nào dùng kiểu nào
- Hiểu `if __name__ == "__main__":` và tại sao nó quan trọng
- Tạo **package** của riêng bạn với `__init__.py`
- Hiểu Python tìm module ở đâu (`sys.path`)
- Dạo một vòng **standard library**: `os`, `sys`, `datetime`, `random`, `math`, `itertools`
- Quản lý thư viện bên ngoài với **pip** + **requirements.txt** trong **venv**
- Dùng **typing** nâng cao hơn: `Optional`, `Union`, `list[int]`, `TypedDict`...
- Làm quen với **mypy** - công cụ kiểm tra kiểu tĩnh

## 📖 1. Module là gì?

### Vấn đề: một file quá dài

Khi chương trình lớn dần, nhét tất cả vào một file `main.py` 3000 dòng sẽ:

- Khó tìm code, khó đọc
- Nhiều người cùng sửa một file → xung đột (conflict)
- Không tái sử dụng được ở project khác

### Module = một file `.py`

**Module** đơn giản là **một file Python**. Tên module = tên file (bỏ `.py`). Bất kỳ file `.py` nào cũng có thể được `import` từ file khác.

> 🧠 **Ví dụ dễ hiểu**: Hãy tưởng tượng code của bạn là một **thư viện sách**:
>
> - **Module** = **một cuốn sách** (một file `.py`) chứa các chương (hàm, class)
> - **Package** = **một kệ sách** (một thư mục) chứa nhiều cuốn sách liên quan
> - **`import`** = **mượn sách** về đọc
> - **Standard library** = **thư viện có sẵn** trong thành phố - miễn phí, không cần mua
> - **PyPI + pip** = **nhà sách online** - đặt mua sách mới về thư viện của bạn

### Tạo module đầu tiên

Tạo thư mục `module_demo/` với 2 file:

```python
# file: module_demo/geometry.py
"""Module chứa các hàm hình học."""

PI = 3.14159


def circle_area(radius: float) -> float:
    return PI * radius ** 2


def rectangle_area(width: float, height: float) -> float:
    return width * height


class Point:
    def __init__(self, x: float, y: float):
        self.x = x
        self.y = y

    def __repr__(self) -> str:
        return f"Point({self.x}, {self.y})"
```

```python
# file: module_demo/main.py
import geometry                     # Import module geometry (file geometry.py cùng thư mục)

print(geometry.PI)
print(geometry.circle_area(2))
print(geometry.Point(1, 2))
# Output:
# 3.14159
# 12.56636
# Point(1, 2)
```

Chạy (đứng trong thư mục `module_demo/`):

```bash
python main.py
```

Khi `import geometry`, Python:

1. Tìm file `geometry.py` (xem phần 4 về nơi Python tìm)
2. **Chạy toàn bộ code** trong file đó **một lần duy nhất** (lần import sau dùng lại kết quả đã lưu)
3. Tạo một object module tên `geometry` chứa mọi biến, hàm, class định nghĩa trong file

> 💡 Bạn sẽ thấy thư mục `__pycache__/` xuất hiện - Python lưu bytecode đã biên dịch (`.pyc`) ở đó để lần sau import nhanh hơn. Có thể xóa thoải mái, và nên thêm vào `.gitignore`.

## 📖 2. Các kiểu import

### 1. `import module`

```python
import math

print(math.sqrt(16))        # Phải ghi rõ tiền tố math.
# Output: 4.0
print(math.pi)
# Output: 3.141592653589793
```

✅ **Ưu điểm**: Rõ ràng, biết ngay hàm đến từ module nào. **Được khuyến khích nhất.**

### 2. `from module import name`

```python
from math import sqrt, pi

print(sqrt(25))             # Không cần tiền tố
# Output: 5.0
print(pi)
# Output: 3.141592653589793
```

✅ **Ưu điểm**: Ngắn gọn khi dùng một vài tên nhiều lần.

### 3. `import module as alias` - Đặt biệt danh

```python
import datetime as dt

print(dt.date(2026, 1, 1).year)
# Output: 2026

# Các alias phổ biến trong cộng đồng (quy ước):
# import numpy as np
# import pandas as pd
# import matplotlib.pyplot as plt
```

### 4. `from module import name as alias`

```python
from collections import OrderedDict as OD
from datetime import datetime as DateTime

print(OD(a=1))
# Output: OrderedDict([('a', 1)])
print(DateTime(2026, 9, 25).strftime("%d/%m/%Y"))
# Output: 25/09/2026
```

### 5. ❌ `from module import *` - Không nên dùng

```python
from math import *          # Import TẤT CẢ tên công khai vào file hiện tại

print(floor(3.7))           # floor từ đâu ra? Người đọc code không biết!
# Output: 3
```

**Tại sao tránh?**

- Không biết tên nào đến từ đâu → khó đọc, khó debug
- Có thể **ghi đè** tên có sẵn mà không hay biết (ví dụ `from os import *` ghi đè hàm `open` có sẵn!)
- Editor và công cụ kiểm tra khó phân tích

### Bảng so sánh

| Cách import | Dùng như | Khi nào dùng |
| --- | --- | --- |
| `import math` | `math.sqrt()` | **Mặc định** - rõ ràng nhất |
| `from math import sqrt` | `sqrt()` | Dùng vài tên nhiều lần, tên đủ rõ nghĩa |
| `import numpy as np` | `np.array()` | Tên module dài, có quy ước cộng đồng |
| `from math import *` | `sqrt()` | ❌ Tránh (trừ trong REPL để thử nhanh) |

### Thứ tự import theo PEP 8

```python
# 1. Standard library
import json
import os
from pathlib import Path

# 2. Thư viện bên thứ ba (third-party) - đã cài bằng pip
# import requests

# 3. Module trong project của bạn (local)
# from myapp.models import User

print("Import đúng thứ tự")
# Output: Import đúng thứ tự
```

Mỗi nhóm cách nhau một dòng trống, trong mỗi nhóm sắp xếp theo alphabet. Công cụ `ruff` hoặc `isort` có thể tự sắp xếp cho bạn.

## 📖 3. `if __name__ == "__main__":`

### Vấn đề

Nhớ rằng: **import một module = chạy toàn bộ code trong module đó**. Nếu module có code "test thử" ở cấp cao nhất, nó sẽ chạy **mỗi khi bị import**:

```python
# file: name_demo/calculator.py
def add(a, b):
    return a + b


print("Test thử:", add(2, 3))       # ❌ Chạy cả khi bị import!
```

```python
# file: name_demo/app.py
import calculator

print("App:", calculator.add(10, 20))
# Output:
# Test thử: 5
# App: 30
```

Dòng `Test thử: 5` xuất hiện dù `app.py` không hề muốn!

### Giải pháp: biến đặc biệt `__name__`

Mỗi module có biến `__name__`:

- Khi file được **chạy trực tiếp** (`python calculator.py`) → `__name__ == "__main__"`
- Khi file được **import** → `__name__ == "calculator"` (tên module)

```python
# file: name_demo/calculator_fixed.py
def add(a, b):
    return a + b


def main():
    print("Test thử:", add(2, 3))
    print("__name__ =", __name__)


if __name__ == "__main__":          # ✅ Chỉ chạy khi file được chạy trực tiếp
    main()
```

```python
# file: name_demo/app_fixed.py
import calculator_fixed

print("App:", calculator_fixed.add(10, 20))
print("Tên module:", calculator_fixed.__name__)
# Output:
# App: 30
# Tên module: calculator_fixed
```

Và khi chạy trực tiếp `python calculator_fixed.py`:

```text
Test thử: 5
__name__ = __main__
```

> 🧠 **Ví dụ dễ hiểu**: `if __name__ == "__main__":` giống tấm biển **"Chỉ dành cho chủ nhà"**. Khi bạn ở nhà mình (chạy trực tiếp), bạn dùng được mọi thứ sau tấm biển. Khi khách đến mượn đồ (import), họ chỉ lấy được những thứ bày ra (hàm, class), còn phần sau tấm biển không bị động tới.

> ✅ **Thói quen tốt**: Mọi file có thể chạy trực tiếp (script) nên có cấu trúc: định nghĩa hàm/class → hàm `main()` → `if __name__ == "__main__": main()`.

## 📖 4. Python tìm module ở đâu? - sys.path

Khi gặp `import something`, Python tìm lần lượt trong danh sách `sys.path`:

1. **Thư mục chứa script đang chạy** (hoặc thư mục hiện tại khi dùng REPL)
2. Các thư mục trong biến môi trường `PYTHONPATH` (nếu có)
3. **Standard library** (`.../lib/python3.11/`)
4. **site-packages** - nơi pip cài thư viện (trong venv nếu đang dùng venv)

```python
import sys

for path in sys.path[:3]:
    print(path)
# Output (ví dụ):
# /home/user/my_project
# /usr/lib/python311.zip
# /usr/lib/python3.11

import json
print(json.__file__)                    # Xem module được load từ đâu
# Output (ví dụ): /usr/lib/python3.11/json/__init__.py
```

> ⚠️ Vì **thư mục hiện tại được tìm ĐẦU TIÊN**, nếu bạn đặt tên file là `random.py`, `json.py`, `math.py`... nó sẽ **che mất** module chuẩn! (Xem lại [Bài 1](./01-introduction-setup.md) - Lỗi thường gặp số 5.)

## 📖 5. Package - Nhóm các module

### Package là gì?

**Package** là **một thư mục chứa các module** (và có thể chứa package con). Để Python nhận diện rõ ràng một thư mục là package, đặt vào đó một file `__init__.py` (có thể để trống).

```text
shop_project/
├── main.py
└── shop/                       ← Package
    ├── __init__.py             ← Đánh dấu "đây là package" + code khởi tạo
    ├── products.py             ← Module
    ├── cart.py                 ← Module
    └── payment/                ← Sub-package (package con)
        ├── __init__.py
        └── momo.py
```

> 💡 Từ Python 3.3, thư mục **không có** `__init__.py` vẫn import được (gọi là "namespace package"), nhưng **nên luôn tạo `__init__.py`** cho package thông thường - rõ ràng hơn và tránh nhiều lỗi khó hiểu.

### Xây dựng package `shop`

```python
# file: shop_project/shop/products.py
from dataclasses import dataclass


@dataclass
class Product:
    name: str
    price: int


CATALOG = {
    "p1": Product("Áo thun", 150_000),
    "p2": Product("Quần jean", 450_000),
}


def find_product(product_id: str) -> Product | None:
    return CATALOG.get(product_id)
```

```python
# file: shop_project/shop/cart.py
from .products import Product, find_product      # Relative import: "." = package hiện tại


class Cart:
    def __init__(self) -> None:
        self.items: list[tuple[Product, int]] = []

    def add(self, product_id: str, qty: int = 1) -> None:
        product = find_product(product_id)
        if product is None:
            raise KeyError(f"Không có sản phẩm {product_id}")
        self.items.append((product, qty))

    def total(self) -> int:
        return sum(product.price * qty for product, qty in self.items)
```

```python
# file: shop_project/shop/payment/momo.py
def pay(amount: int) -> str:
    return f"Đã thanh toán {amount:,}đ qua MoMo"
```

```python
# file: shop_project/shop/payment/__init__.py
# (file rỗng - chỉ để đánh dấu payment là package)
```

`__init__.py` của package gốc chạy **khi package được import lần đầu**. Thường dùng để **"nâng" các tên quan trọng lên** cho người dùng import cho gọn:

```python
# file: shop_project/shop/__init__.py
"""Package shop - quản lý sản phẩm và giỏ hàng."""

from .cart import Cart
from .products import Product, find_product

__all__ = ["Cart", "Product", "find_product"]   # Những tên được export khi "from shop import *"
__version__ = "1.0.0"
```

```python
# file: shop_project/main.py
from shop import Cart, __version__              # Nhờ __init__.py nên import gọn
from shop.payment.momo import pay               # Import từ sub-package (absolute import)
import shop.products

cart = Cart()
cart.add("p1", 2)
cart.add("p2")
print(f"Shop v{__version__}")
print(f"Tổng: {cart.total():,}đ")
print(pay(cart.total()))
print(shop.products.find_product("p1"))
# Output:
# Shop v1.0.0
# Tổng: 750,000đ
# Đã thanh toán 750,000đ qua MoMo
# Product(name='Áo thun', price=150000)
```

Chạy từ thư mục `shop_project/`:

```bash
python main.py
```

### Absolute import vs Relative import

```text
# Absolute import: đường dẫn đầy đủ từ gốc project - rõ ràng, khuyến khích
from shop.products import Product

# Relative import: tương đối so với module hiện tại - chỉ dùng BÊN TRONG package
from .products import Product         # . = package hiện tại
from ..utils import helper            # .. = package cha
```

> ⚠️ **Relative import không dùng được trong file chạy trực tiếp**. Nếu bạn chạy `python shop/cart.py` sẽ gặp `ImportError: attempted relative import with no known parent package`. Hãy chạy qua file ở ngoài (`main.py`) hoặc dùng `python -m shop.cart` từ thư mục gốc project.

### Chạy module với `python -m`

```bash
# Chạy module như script, Python tự thêm thư mục hiện tại vào sys.path
python -m shop.cart

# Rất nhiều công cụ được chạy theo cách này
python -m venv .venv
python -m pip install requests
python -m http.server 8000      # Mở web server tĩnh ngay tại thư mục hiện tại!
python -m json.tool data.json   # Format đẹp file JSON
```

> ⚠️ Với package `shop` ở trên, `python -m shop.cart` chạy được (không còn `ImportError`) nhưng sẽ in thêm cảnh báo:
>
> ```text
> RuntimeWarning: 'shop.cart' found in sys.modules after import of package 'shop', but prior to execution of 'shop.cart'; this may result in unpredictable behaviour
> ```
>
> Lý do: `-m` phải import package `shop` trước, mà `shop/__init__.py` **đã import sẵn** `cart` → `cart.py` bị nạp **hai lần** (một lần là `shop.cart`, một lần là `__main__`). Ở đây vô hại vì `cart.py` không có code chạy ở cấp cao nhất. Bài học: module nào bạn định chạy bằng `python -m` (thường là điểm khởi động như `main.py`/`__main__.py`) thì **đừng import sẵn nó trong `__init__.py`**.

## 📖 6. Standard Library - "Batteries Included"

Python đi kèm **hơn 200 module** có sẵn, không cần cài gì thêm. Đây là những module bạn sẽ dùng nhiều nhất.

### os - Tương tác với hệ điều hành

```python
import os

print(os.name in ("posix", "nt"))          # "posix" (Mac/Linux) hoặc "nt" (Windows)
# Output: True
print(os.path.isabs(os.getcwd()))          # getcwd(): thư mục làm việc hiện tại
# Output: True

# Biến môi trường (environment variables) - nơi lưu cấu hình, API key...
os.environ["APP_MODE"] = "development"
print(os.environ.get("APP_MODE"))
# Output: development
print(os.environ.get("KHONG_CO_BIEN_NAY", "giá trị mặc định"))
# Output: giá trị mặc định

# Tạo thư mục, liệt kê file
os.makedirs("os_demo/sub", exist_ok=True)
print(os.listdir("os_demo"))
# Output: ['sub']

# os.path - cách cũ để xử lý đường dẫn (pathlib hiện đại hơn - Bài 7)
print(os.path.join("data", "file.txt").replace("\\", "/"))
# Output: data/file.txt
print(os.path.splitext("report.pdf"))
# Output: ('report', '.pdf')
```

> 💡 **Không bao giờ ghi thẳng mật khẩu, API key vào code!** Hãy đọc từ biến môi trường: `api_key = os.environ["API_KEY"]`.

### sys - Thông tin về trình thông dịch

```python
import sys

print(sys.version_info >= (3, 8))          # Kiểm tra phiên bản Python
# Output: True
print(sys.version_info.major)
# Output: 3
print(type(sys.argv))                      # Tham số dòng lệnh: python app.py a b → ['app.py', 'a', 'b']
# Output: <class 'list'>
print(sys.platform in ("linux", "darwin", "win32"))
# Output: True

# In ra "luồng lỗi" (stderr) thay vì stdout
print("Cảnh báo!", file=sys.stderr)

# sys.exit(1)   # Thoát chương trình với mã lỗi (0 = thành công, khác 0 = lỗi)
```

### datetime - Ngày và giờ

```python
from datetime import date, datetime, timedelta

# Tạo ngày giờ cụ thể
birthday = date(2000, 5, 20)
meeting = datetime(2026, 9, 25, 14, 30)
print(birthday, meeting)
# Output: 2000-05-20 2026-09-25 14:30:00

# Truy cập thành phần
print(meeting.year, meeting.month, meeting.day, meeting.hour)
# Output: 2026 9 25 14
print(meeting.strftime("%A"))              # Thứ trong tuần
# Output: Friday

# Định dạng: datetime → chuỗi (strftime = string FORMAT time)
print(meeting.strftime("%d/%m/%Y %H:%M"))
# Output: 25/09/2026 14:30

# Phân tích: chuỗi → datetime (strptime = string PARSE time)
deadline = datetime.strptime("31/12/2026 23:59", "%d/%m/%Y %H:%M")
print(deadline)
# Output: 2026-12-31 23:59:00

# Tính toán với timedelta
print(meeting + timedelta(days=7, hours=2))
# Output: 2026-10-02 16:30:00
remaining = deadline - meeting
print(remaining.days, "ngày")
# Output: 97 ngày

# Tính tuổi
today = date(2026, 9, 25)
age = today.year - birthday.year - ((today.month, today.day) < (birthday.month, birthday.day))
print(f"Tuổi: {age}")
# Output: Tuổi: 26

# ISO format - chuẩn để lưu vào JSON/database
print(meeting.isoformat())
# Output: 2026-09-25T14:30:00
print(datetime.fromisoformat("2026-09-25T14:30:00") == meeting)
# Output: True

# Thời điểm hiện tại
now = datetime.now()
print(type(now).__name__)
# Output: datetime
```

Các mã định dạng hay dùng:

| Mã | Ý nghĩa | Ví dụ |
| --- | --- | --- |
| `%d` | Ngày (2 chữ số) | `25` |
| `%m` | Tháng (2 chữ số) | `09` |
| `%Y` | Năm (4 chữ số) | `2026` |
| `%H` / `%M` / `%S` | Giờ (24h) / Phút / Giây | `14` / `30` / `00` |
| `%A` | Tên thứ | `Friday` |
| `%B` | Tên tháng | `September` |

### random - Số ngẫu nhiên

```python
import random

random.seed(42)                            # Cố định "hạt giống" → kết quả lặp lại được (tiện khi test)

print(random.randint(1, 6))                # Số nguyên trong [1, 6] - tung xúc xắc
print(random.random())                     # Số thực trong [0, 1)
print(random.uniform(1.5, 3.5))            # Số thực trong [1.5, 3.5]
print(random.choice(["kéo", "búa", "bao"]))   # Chọn 1 phần tử
print(random.sample(range(1, 50), 6))      # Chọn 6 phần tử KHÔNG trùng - xổ số!
print(random.choices(["A", "B"], weights=[9, 1], k=5))   # Chọn có trọng số, CÓ trùng

cards = ["A", "K", "Q", "J"]
random.shuffle(cards)                      # Xáo trộn TẠI CHỖ
print(cards)
# Output (với seed 42 trên Python 3.11):
# 6
# 0.11133106816568039
# 2.9831009995196656
# kéo
# [15, 9, 7, 44, 35, 6]
# ['A', 'A', 'A', 'A', 'A']
# ['A', 'J', 'Q', 'K']
```

> ⚠️ Module `random` **không an toàn** cho bảo mật (mật khẩu, token, OTP). Hãy dùng module `secrets`:

```python
import secrets

token = secrets.token_hex(16)              # Chuỗi hex ngẫu nhiên an toàn, dài 32 ký tự
print(len(token))
# Output: 32
otp = "".join(secrets.choice("0123456789") for _ in range(6))
print(len(otp), otp.isdigit())
# Output: 6 True
```

### math - Toán học

```python
import math

print(math.sqrt(144))                  # Căn bậc 2
# Output: 12.0
print(math.pow(2, 10))                 # Lũy thừa (trả về float)
# Output: 1024.0
print(math.floor(-2.5), math.ceil(-2.5))   # Làm tròn xuống / lên
# Output: -3 -2
print(math.factorial(5))               # Giai thừa
# Output: 120
print(math.gcd(48, 18))                # Ước chung lớn nhất
# Output: 6
print(math.lcm(4, 6))                  # Bội chung nhỏ nhất (Python 3.9+)
# Output: 12
print(round(math.pi, 5), round(math.e, 5))
# Output: 3.14159 2.71828
print(math.hypot(3, 4))                # Cạnh huyền tam giác vuông
# Output: 5.0
print(math.isclose(0.1 + 0.2, 0.3))   # So sánh float an toàn (Bài 2)
# Output: True
print(math.comb(5, 2), math.perm(5, 2))    # Tổ hợp C(5,2), chỉnh hợp A(5,2)
# Output: 10 20
print(math.inf > 10 ** 100)            # Vô cực
# Output: True
```

### itertools - Công cụ cho vòng lặp

```python
import itertools

# count: đếm vô hạn (phải có điểm dừng!)
for i in itertools.count(start=10, step=5):
    if i > 25:
        break
    print(i, end=" ")
print()
# Output: 10 15 20 25

# cycle: lặp vòng tròn vô hạn
colors = itertools.cycle(["🔴", "🟢", "🔵"])
print([next(colors) for _ in range(5)])
# Output: ['🔴', '🟢', '🔵', '🔴', '🟢']

# chain: nối nhiều iterable
print(list(itertools.chain([1, 2], (3, 4), "ab")))
# Output: [1, 2, 3, 4, 'a', 'b']

# islice: slicing cho iterator
print(list(itertools.islice(itertools.count(), 3, 8)))
# Output: [3, 4, 5, 6, 7]

# product: tích Descartes - thay cho vòng lặp lồng nhau
sizes = ["S", "M"]
colors_ = ["Đen", "Trắng"]
print(list(itertools.product(sizes, colors_)))
# Output: [('S', 'Đen'), ('S', 'Trắng'), ('M', 'Đen'), ('M', 'Trắng')]

# permutations: hoán vị | combinations: tổ hợp
print(list(itertools.permutations("ABC", 2)))
# Output: [('A', 'B'), ('A', 'C'), ('B', 'A'), ('B', 'C'), ('C', 'A'), ('C', 'B')]
print(list(itertools.combinations([1, 2, 3, 4], 2)))
# Output: [(1, 2), (1, 3), (1, 4), (2, 3), (2, 4), (3, 4)]

# accumulate: tổng dồn
print(list(itertools.accumulate([100, 200, 50, 300])))
# Output: [100, 300, 350, 650]

# groupby: nhóm các phần tử LIÊN TIẾP có cùng key (nên sắp xếp trước!)
people = [("An", "HN"), ("Bình", "HN"), ("Chi", "SG"), ("Dũng", "SG"), ("Em", "HN")]
people.sort(key=lambda p: p[1])
for city, group in itertools.groupby(people, key=lambda p: p[1]):
    print(city, [name for name, _ in group])
# Output:
# HN ['An', 'Bình', 'Em']
# SG ['Chi', 'Dũng']

# pairwise: các cặp liền kề (Python 3.10+)
prices = [100, 120, 90, 150]
print([b - a for a, b in itertools.pairwise(prices)])
# Output: [20, -30, 60]
```

### Các module hữu ích khác

| Module | Công dụng |
| --- | --- |
| `pathlib` | Đường dẫn file ([Bài 7](./07-exceptions-files.md)) |
| `json`, `csv` | Đọc/ghi dữ liệu ([Bài 7](./07-exceptions-files.md)) |
| `collections` | `Counter`, `defaultdict`, `deque` ([Bài 5](./05-data-structures.md)) |
| `functools` | `lru_cache`, `wraps`, `partial`, `reduce` ([Bài 9](./09-advanced-python.md)) |
| `re` | Biểu thức chính quy (regex) - tìm kiếm mẫu văn bản ([Bài 11](./11-stdlib-practical.md)) |
| `argparse` | Xây dựng ứng dụng dòng lệnh ([Bài 10](./10-final-project.md)) |
| `logging` | Ghi log chuyên nghiệp thay cho `print` ([Bài 11](./11-stdlib-practical.md)) |
| `sqlite3` | Cơ sở dữ liệu SQLite có sẵn ([Bài 13](./13-databases.md)) |
| `urllib.request` | Gửi HTTP request đơn giản (thực tế hay dùng `requests`/`httpx` - [Bài 12](./12-http-web-apis.md)) |
| `shutil` | Copy, di chuyển, xóa cây thư mục, nén zip |
| `time` | `time.sleep()`, đo thời gian với `time.perf_counter()` |
| `unittest` | Viết test có sẵn ([Bài 10](./10-final-project.md)) |

Ví dụ nhanh với `re` và `logging`:

```python
import logging
import re

text = "Liên hệ: an@mail.com, binh.tran@company.vn hoặc 0912-345-678"
emails = re.findall(r"[\w.]+@[\w.]+", text)
print(emails)
# Output: ['an@mail.com', 'binh.tran@company.vn']
print(re.sub(r"\d", "*", "0912-345-678"))
# Output: ****-***-***

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logging.info("Ứng dụng khởi động")        # In ra stderr: INFO: Ứng dụng khởi động
logging.debug("Không hiện vì level là INFO")
```

## 📖 7. pip, requirements.txt và quy trình venv

### Nhắc lại quy trình ([Bài 1](./01-introduction-setup.md))

```bash
# 1. Tạo và kích hoạt venv
python3 -m venv .venv
source .venv/bin/activate              # Windows: .venv\Scripts\activate

# 2. Cài thư viện
python -m pip install requests rich

# 3. Lưu danh sách
python -m pip freeze > requirements.txt

# 4. Người khác cài lại đúng như vậy
python -m pip install -r requirements.txt
```

### Viết requirements.txt đúng cách

`pip freeze` liệt kê **tất cả** thư viện, kể cả các thư viện phụ thuộc gián tiếp (ví dụ cài `requests` sẽ kéo theo `urllib3`, `idna`...). Cách tổ chức phổ biến:

```text
# requirements.txt - thư viện cần để CHẠY ứng dụng
requests>=2.31,<3          # Cho phép bản 2.x từ 2.31 trở lên
rich==13.7.1               # Ghim chính xác phiên bản

# requirements-dev.txt - thư viện chỉ cần khi PHÁT TRIỂN
-r requirements.txt        # Bao gồm luôn file kia
pytest>=8
mypy>=1.10
ruff
```

Các toán tử phiên bản:

| Cú pháp | Ý nghĩa |
| --- | --- |
| `pkg==1.2.3` | Chính xác phiên bản 1.2.3 |
| `pkg>=1.2` | Từ 1.2 trở lên |
| `pkg>=1.2,<2` | Từ 1.2 đến dưới 2.0 |
| `pkg~=1.2.3` | "Tương thích": >= 1.2.3 và < 1.3 |

### Ví dụ dùng thư viện bên ngoài

Sau khi `python -m pip install requests`:

```text
import requests

response = requests.get("https://api.github.com/repos/python/cpython", timeout=10)
response.raise_for_status()            # Báo lỗi nếu status code là 4xx/5xx
data = response.json()                 # Tự chuyển JSON → dict
print(data["full_name"], "⭐", data["stargazers_count"])
# Output (ví dụ): python/cpython ⭐ 65000
```

### Tìm thư viện ở đâu?

- [pypi.org](https://pypi.org) - tìm kiếm thư viện, xem phiên bản, hướng dẫn
- Xem số sao GitHub, lần cập nhật gần nhất, tài liệu có đầy đủ không trước khi chọn
- Một số thư viện nổi tiếng: `requests`/`httpx` (HTTP), `rich` (terminal đẹp), `pandas` (dữ liệu), `fastapi`/`flask`/`django` (web), `pytest` (test), `pydantic` (validate dữ liệu)

### Các công cụ hiện đại (tham khảo)

- **`pyproject.toml`**: file cấu hình chuẩn mới cho project Python (thay cho `setup.py`)
- **`uv`**, **`poetry`**, **`pipenv`**: công cụ quản lý thư viện + venv tiện hơn pip thuần. Nên học pip + venv trước để hiểu bản chất.

## 📖 8. Typing nâng cao hơn

Ở [Bài 4](./04-functions.md), bạn đã biết type hints cơ bản. Giờ hãy xem các công cụ mạnh hơn trong module `typing`.

### Collection types

```python
# Python 3.9+: dùng trực tiếp list, dict, tuple, set
def average(scores: list[float]) -> float:
    return sum(scores) / len(scores)


def count_words(text: str) -> dict[str, int]:
    result: dict[str, int] = {}
    for word in text.split():
        result[word] = result.get(word, 0) + 1
    return result


point: tuple[int, int] = (3, 4)             # Tuple đúng 2 phần tử int
values: tuple[int, ...] = (1, 2, 3, 4)      # Tuple nhiều phần tử int
unique_ids: set[str] = {"a1", "b2"}
matrix: list[list[int]] = [[1, 2], [3, 4]]

print(average([8.0, 9.5]), count_words("a b a"))
# Output: 8.75 {'a': 2, 'b': 1}
```

> 💡 Với Python 3.8 trở xuống, phải viết `from typing import List, Dict` và dùng `List[int]`, `Dict[str, int]`. Bạn sẽ gặp cách viết này trong code cũ.

### Optional và Union

```python
from typing import Optional, Union


# Optional[X] = "X hoặc None"
def find_email(user_id: int) -> Optional[str]:
    emails = {1: "an@mail.com"}
    return emails.get(user_id)


# Union[X, Y] = "X hoặc Y"
def to_number(value: Union[str, int, float]) -> float:
    return float(value)


# ✅ Cú pháp mới (Python 3.10+) dùng dấu | - ngắn gọn hơn, khuyến khích
def find_email_new(user_id: int) -> str | None:
    return None


def to_number_new(value: str | int | float) -> float:
    return float(value)


print(find_email(1), find_email(2), to_number("3.5"))
# Output: an@mail.com None 3.5
```

### Any, Callable, Literal, Final

```python
from typing import Any, Callable, Final, Literal

MAX_RETRY: Final = 3                            # Hằng số - mypy báo lỗi nếu bị gán lại


def log(data: Any) -> None:                     # Any: chấp nhận mọi kiểu (tắt kiểm tra)
    print(f"[LOG] {data}")


def apply(func: Callable[[int, int], int], a: int, b: int) -> int:
    """func là hàm nhận 2 int, trả về int."""
    return func(a, b)


def set_mode(mode: Literal["light", "dark"]) -> str:   # Chỉ chấp nhận đúng các giá trị này
    return f"Chế độ: {mode}"


log({"x": 1})
# Output: [LOG] {'x': 1}
print(apply(lambda x, y: x * y, 6, 7))
# Output: 42
print(set_mode("dark"))
# Output: Chế độ: dark
```

### TypedDict - Mô tả cấu trúc dict

Rất hữu ích khi làm việc với JSON:

```python
from typing import NotRequired, TypedDict      # NotRequired: Python 3.11+


class UserDict(TypedDict):
    id: int
    name: str
    email: str
    phone: NotRequired[str]                    # Key không bắt buộc


def greet(user: UserDict) -> str:
    return f"Xin chào {user['name']} ({user['email']})"


user: UserDict = {"id": 1, "name": "An", "email": "an@mail.com"}
print(greet(user))
# Output: Xin chào An (an@mail.com)
print(type(user))                              # Lúc chạy vẫn là dict bình thường
# Output: <class 'dict'>
```

> 💡 Nếu dữ liệu có hành vi (method) hoặc cần kiểm tra khi tạo → dùng **dataclass** ([Bài 6](./06-oop.md)). Nếu chỉ muốn mô tả cấu trúc của dict (ví dụ JSON từ API) → dùng **TypedDict**.

### Type alias và Generic đơn giản

```python
from typing import TypeVar

# Type alias: đặt tên cho kiểu phức tạp
Matrix = list[list[float]]
UserId = int


def identity(size: int) -> Matrix:
    return [[1.0 if i == j else 0.0 for j in range(size)] for i in range(size)]


# TypeVar: "kiểu gì vào thì kiểu đó ra"
T = TypeVar("T")


def first(items: list[T]) -> T:
    return items[0]


print(identity(2))
# Output: [[1.0, 0.0], [0.0, 1.0]]
print(first([10, 20]), first(["a", "b"]))    # mypy biết: kết quả lần 1 là int, lần 2 là str
# Output: 10 a
```

## 📖 9. mypy - Kiểm tra kiểu tĩnh

### mypy là gì?

Như đã biết, Python **không kiểm tra type hints khi chạy**. **mypy** là công cụ đọc code của bạn (**không chạy**) và báo lỗi khi kiểu dữ liệu không khớp - giúp bắt lỗi **trước khi** chạy chương trình.

> 🧠 **Ví dụ dễ hiểu**: mypy giống **người soát lỗi chính tả** đọc bài văn trước khi bạn nộp. Bài văn vẫn nộp được khi có lỗi (Python vẫn chạy), nhưng tốt hơn hết là sửa trước.

### Cài đặt và sử dụng

```bash
python -m pip install mypy
mypy my_script.py          # Kiểm tra một file
mypy .                     # Kiểm tra cả project
mypy --strict app.py       # Chế độ nghiêm ngặt: bắt buộc type hints mọi nơi
```

### Ví dụ

Tạo file `typing_demo.py`:

```python
# file: mypy_demo/typing_demo.py
def calculate_total(prices: list[float], discount: float = 0) -> float:
    return sum(prices) * (1 - discount)


def get_username(user_id: int) -> str | None:
    return "an" if user_id == 1 else None


total = calculate_total([100, 200], "10%")      # ❌ Truyền str thay vì float
name = get_username(2)
print(name.upper())                             # ❌ name có thể là None!
```

Chạy `mypy typing_demo.py`:

```text
typing_demo.py:10: error: Argument 2 to "calculate_total" has incompatible type "str"; expected "float"  [arg-type]
typing_demo.py:12: error: Item "None" of "str | None" has no attribute "upper"  [union-attr]
Found 2 errors in 1 file (checked 1 source file)
```

Sửa lại:

```python
def calculate_total(prices: list[float], discount: float = 0) -> float:
    return sum(prices) * (1 - discount)


def get_username(user_id: int) -> str | None:
    return "an" if user_id == 1 else None


total = calculate_total([100, 200], 0.1)        # ✅
name = get_username(2)
if name is not None:                            # ✅ "Thu hẹp kiểu" (type narrowing)
    print(name.upper())
else:
    print("Không tìm thấy user")
print(round(total, 2))
# Output:
# Không tìm thấy user
# 270.0
```

> ✅ **Lời khuyên**: Bật **Pylance** trong VS Code (`"python.analysis.typeCheckingMode": "basic"`) để thấy lỗi kiểu ngay khi gõ, và chạy `mypy` trong CI trước khi merge code.

## 🌍 Ứng dụng thực tế

### 1. Tổ chức package cho ứng dụng quản lý thư viện

Khi ứng dụng lớn dần, câu hỏi quan trọng nhất là: **file nào được import file nào?** Quy tắc vàng: phụ thuộc chỉ đi **một chiều**, từ tầng "cao" (giao diện) xuống tầng "thấp" (dữ liệu). Nhờ vậy không bao giờ bị circular import.

```text
library_app/
├── main.py                     ← Điểm khởi động: chỉ ghép các mảnh lại và in kết quả
└── library/
    ├── __init__.py             ← "Mặt tiền": export các tên quan trọng
    ├── models.py               ← Dữ liệu (Book, Loan, Member) - không import ai trong package
    ├── catalog.py              ← Quản lý đầu sách        (import models)
    ├── loans.py                ← Mượn/trả, tính phạt      (import models, catalog)
    └── utils/
        ├── __init__.py
        └── formatting.py       ← Hàm tiện ích chung, không biết gì về "thư viện"

Chiều phụ thuộc:  main.py → library → loans → catalog → models
                  main.py → library.utils (độc lập)
```

```python
# file: library_app/library/models.py
"""Dữ liệu cốt lõi - KHÔNG import module nào khác trong package (tránh import vòng)."""
from dataclasses import dataclass, field
from datetime import date


@dataclass
class Book:
    isbn: str
    title: str
    author: str
    copies: int = 1


@dataclass
class Loan:
    isbn: str
    member: str
    borrowed_on: date
    due_on: date
    returned_on: date | None = None


@dataclass
class Member:
    name: str
    loans: list[Loan] = field(default_factory=list)
```

```python
# file: library_app/library/catalog.py
"""Quản lý đầu sách: thêm, tìm kiếm."""
from .models import Book


class Catalog:
    def __init__(self) -> None:
        self._books: dict[str, Book] = {}

    def add(self, book: Book) -> None:
        self._books[book.isbn] = book

    def get(self, isbn: str) -> Book:
        return self._books[isbn]

    def search(self, keyword: str) -> list[Book]:
        keyword = keyword.lower()
        return [b for b in self._books.values()
                if keyword in b.title.lower() or keyword in b.author.lower()]
```

```python
# file: library_app/library/loans.py
"""Nghiệp vụ mượn/trả sách và tính tiền phạt trả trễ."""
from datetime import date, timedelta

from .catalog import Catalog
from .models import Loan, Member

LOAN_DAYS = 14                  # Được mượn tối đa 14 ngày
FINE_PER_DAY = 2_000            # Phạt 2.000đ cho mỗi ngày trễ
MAX_BOOKS = 3                   # Mỗi thành viên mượn tối đa 3 cuốn cùng lúc


def borrow(catalog: Catalog, member: Member, isbn: str, today: date) -> Loan:
    book = catalog.get(isbn)
    active = [loan for loan in member.loans if loan.returned_on is None]
    if len(active) >= MAX_BOOKS:
        raise ValueError(f"{member.name} đã mượn đủ {MAX_BOOKS} cuốn")
    if book.copies == 0:
        raise ValueError(f"'{book.title}' đã được mượn hết")
    book.copies -= 1
    loan = Loan(isbn, member.name, today, today + timedelta(days=LOAN_DAYS))
    member.loans.append(loan)
    return loan


def give_back(catalog: Catalog, loan: Loan, today: date) -> int:
    """Trả sách, trả về số tiền phạt (0 nếu đúng hạn)."""
    loan.returned_on = today
    catalog.get(loan.isbn).copies += 1
    late_days = (today - loan.due_on).days
    return max(late_days, 0) * FINE_PER_DAY
```

```python
# file: library_app/library/utils/formatting.py
"""Hàm định dạng dùng chung - không phụ thuộc gì vào nghiệp vụ thư viện."""
from datetime import date


def format_vnd(amount: int) -> str:
    return f"{amount:,}đ".replace(",", ".")


def format_date(d: date) -> str:
    return d.strftime("%d/%m/%Y")
```

```python
# file: library_app/library/utils/__init__.py
from .formatting import format_date, format_vnd

__all__ = ["format_date", "format_vnd"]
```

```python
# file: library_app/library/__init__.py
"""Package library - ứng dụng quản lý thư viện mini."""
from .catalog import Catalog
from .loans import borrow, give_back
from .models import Book, Member

__all__ = ["Book", "Catalog", "Member", "borrow", "give_back"]
__version__ = "0.1.0"
```

```python
# file: library_app/main.py
from datetime import date

from library import Book, Catalog, Member, __version__, borrow, give_back
from library.utils import format_date, format_vnd

catalog = Catalog()
catalog.add(Book("978-604-1", "Dế Mèn phiêu lưu ký", "Tô Hoài", copies=2))
catalog.add(Book("978-604-2", "Số đỏ", "Vũ Trọng Phụng"))
catalog.add(Book("978-604-3", "Tắt đèn", "Ngô Tất Tố"))
an, binh = Member("An"), Member("Bình")

print(f"📚 Thư viện mini v{__version__}")
print("Tìm 'tô':", [b.title for b in catalog.search("tô")])

loan = borrow(catalog, an, "978-604-2", today=date(2026, 9, 1))
print(f"{an.name} mượn '{catalog.get(loan.isbn).title}', hạn trả {format_date(loan.due_on)}")

try:
    borrow(catalog, binh, "978-604-2", today=date(2026, 9, 2))
except ValueError as error:
    print("⚠️", error)

fine = give_back(catalog, loan, today=date(2026, 9, 20))
print(f"{an.name} trả sách ngày 20/09/2026 → tiền phạt: {format_vnd(fine)}")
print("Còn trong kho:", {b.title: b.copies for b in catalog.search("")})

# Output:
# 📚 Thư viện mini v0.1.0
# Tìm 'tô': ['Dế Mèn phiêu lưu ký']
# An mượn 'Số đỏ', hạn trả 15/09/2026
# ⚠️ 'Số đỏ' đã được mượn hết
# An trả sách ngày 20/09/2026 → tiền phạt: 10.000đ
# Còn trong kho: {'Dế Mèn phiêu lưu ký': 2, 'Số đỏ': 1, 'Tắt đèn': 1}
```

Chạy từ thư mục `library_app/`:

```bash
python main.py
```

> 💡 **Hằng số nghiệp vụ** (`LOAN_DAYS`, `FINE_PER_DAY`, `MAX_BOOKS`) đặt ở đầu module `loans.py` - khi thư viện đổi quy định, bạn biết chính xác phải sửa ở đâu. Hàm `borrow`/`give_back` nhận `today` làm tham số thay vì tự gọi `date.today()` → test được với bất kỳ ngày nào ([Bài 10](./10-final-project.md) sẽ tận dụng kỹ thuật này).

### 2. Module tiện ích dùng lại cho mọi project: tìm kiếm tiếng Việt không dấu

Ở ví dụ trên, tìm `"tô"` **không** ra "Ngô Tất Tố" vì `"tô"` ≠ `"tố"`. Người dùng Việt thường gõ không dấu, nên ta viết một module tiện ích (dùng `unicodedata` của standard library) và **import lại ở nhiều nơi**:

```python
# file: vn_utils.py - Module tiện ích tiếng Việt, dùng lại được cho mọi project
"""Các hàm xử lý chuỗi tiếng Việt: bỏ dấu, tạo slug."""
import unicodedata


def remove_accents(text: str) -> str:
    """'Tiếng Việt' → 'Tieng Viet'. Dùng cho tìm kiếm không dấu, tên file..."""
    # NFD tách "ế" thành "e" + dấu mũ + dấu sắc; sau đó bỏ các ký tự dấu (category "Mn")
    decomposed = unicodedata.normalize("NFD", text)
    no_marks = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
    return no_marks.replace("đ", "d").replace("Đ", "D")   # "đ" không tách được nên thay tay


def slugify(text: str) -> str:
    """'Học Python cơ bản!' → 'hoc-python-co-ban' (dùng cho URL, tên file)."""
    cleaned = "".join(ch if ch.isalnum() else " " for ch in remove_accents(text).lower())
    return "-".join(cleaned.split())


if __name__ == "__main__":
    # Chỉ chạy khi gõ "python vn_utils.py" - KHÔNG chạy khi module bị import
    # assert điều_kiện: sai thì báo AssertionError (sẽ dùng nhiều khi viết test ở Bài 10)
    assert remove_accents("Đường Nguyễn Huệ") == "Duong Nguyen Hue"
    assert slugify("  Học Python cơ bản! ") == "hoc-python-co-ban"
    print("✅ vn_utils: tất cả kiểm tra đều đạt")

# Output: ✅ vn_utils: tất cả kiểm tra đều đạt
```

```python
# file: search_books.py - Dùng lại vn_utils để tìm kiếm không dấu
import sys

from vn_utils import remove_accents, slugify

BOOKS = ["Dế Mèn phiêu lưu ký", "Số đỏ", "Tắt đèn", "Tôi thấy hoa vàng trên cỏ xanh"]


def search(keyword: str) -> list[str]:
    key = remove_accents(keyword).lower()
    return [b for b in BOOKS if key in remove_accents(b).lower()]


def main() -> None:
    # sys.argv[1:] là các tham số dòng lệnh; không có thì dùng từ khóa mẫu
    keywords = sys.argv[1:] or ["den", "SO DO", "hoa vang"]
    for keyword in keywords:
        print(f"🔎 '{keyword}' → {search(keyword)}")
    print("🔗 URL:", "/books/" + slugify(BOOKS[-1]))


if __name__ == "__main__":
    main()

# Output:
# 🔎 'den' → ['Tắt đèn']
# 🔎 'SO DO' → ['Số đỏ']
# 🔎 'hoa vang' → ['Tôi thấy hoa vàng trên cỏ xanh']
# 🔗 URL: /books/toi-thay-hoa-vang-tren-co-xanh
```

Truyền từ khóa qua dòng lệnh (đọc bằng `sys.argv`):

```bash
python search_books.py "de men"
# Output:
# 🔎 'de men' → ['Dế Mèn phiêu lưu ký']
# 🔗 URL: /books/toi-thay-hoa-vang-tren-co-xanh
```

> 🧠 Nhờ `if __name__ == "__main__":`, `vn_utils.py` vừa là **module** để import, vừa tự kiểm tra được khi chạy trực tiếp. Khi nhiều project cùng cần, bạn có thể đóng gói nó thành package riêng và `pip install` như thư viện thật.

## ⚠️ Lỗi thường gặp

### 1. Đặt tên file trùng module chuẩn

```text
# Bạn có file tên json.py trong project
import json
json.loads('{"a": 1}')
# AttributeError: module 'json' has no attribute 'loads'
```

**Cách sửa**: Đổi tên file (`json_demo.py`), xóa `__pycache__/`.

### 2. Circular import (import vòng tròn)

```text
# a.py
from b import func_b
def func_a(): ...

# b.py
from a import func_a      # a đang import b, b lại import a → vòng tròn!
def func_b(): ...

# ImportError: cannot import name 'func_a' from partially initialized module 'a'
# (most likely due to a circular import)
```

**Cách sửa**: Tách phần dùng chung ra module thứ ba (`common.py`), hoặc import bên trong hàm (chỉ khi thật cần).

### 3. ModuleNotFoundError do chạy sai thư mục

```text
# Cấu trúc: project/shop/cart.py, project/main.py
cd project/shop
python ../main.py
# ModuleNotFoundError: No module named 'shop'
```

**Cách sửa**: Luôn chạy từ **thư mục gốc project**: `cd project && python main.py` hoặc `python -m shop.cart`.

### 4. Relative import trong file chạy trực tiếp

```text
python shop/cart.py
# ImportError: attempted relative import with no known parent package
```

**Cách sửa**: `python -m shop.cart` (từ thư mục gốc), hoặc chạy qua `main.py`.

### 5. Cài thư viện nhưng quên kích hoạt venv

```text
pip install requests          # Cài vào Python global
source .venv/bin/activate
python app.py                 # ModuleNotFoundError: No module named 'requests'
```

**Cách sửa**: Kích hoạt venv **trước**, rồi mới `python -m pip install`.

### 6. Code chạy khi import vì thiếu `if __name__ == "__main__":`

Xem phần 3 - luôn bọc code "chạy thử" trong `main()` và `if __name__ == "__main__":`.

### 7. Tên package/module có dấu gạch ngang

```text
# File: my-utils.py
import my-utils           # ❌ SyntaxError: Python hiểu là "my trừ utils"
```

**Cách sửa**: Dùng dấu gạch dưới: `my_utils.py` → `import my_utils`.

### 8. Nhầm tên trên PyPI với tên import

```text
pip install beautifulsoup4    →   import bs4
pip install Pillow            →   import PIL
pip install scikit-learn      →   import sklearn
pip install python-dotenv     →   import dotenv
```

Luôn đọc tài liệu của thư viện để biết tên import chính xác.

## 🏋️ Bài tập

### Bài tập 1: Đếm ngược sự kiện

Dùng `datetime`, viết chương trình nhận ngày sự kiện (`dd/mm/yyyy`) và in: còn bao nhiêu ngày, sự kiện rơi vào thứ mấy, đã qua hay chưa.

### Bài tập 2: Trò chơi xổ số

Dùng `random`: sinh vé số 6 số không trùng từ 1-45, cho người chơi "mua" 10 vé ngẫu nhiên, đếm mỗi vé trùng bao nhiêu số với kết quả. Dùng `random.seed()` để kết quả lặp lại được.

### Bài tập 3: Module tiện ích

Tạo module `string_utils.py` gồm các hàm: `slugify(text)` (`"Xin Chào Python"` → `"xin-chao-python"`, gợi ý: `unicodedata`), `truncate(text, n)`, `count_vowels(text)`. Có phần test trong `if __name__ == "__main__":`. Import và dùng trong `main.py`.

### Bài tập 4: Package calculator

Tạo package:

```text
calculator/
├── __init__.py       # export các hàm chính
├── basic.py          # add, subtract, multiply, divide
├── advanced.py       # power, sqrt, factorial (dùng math)
└── converters/
    ├── __init__.py
    └── units.py      # km_to_miles, celsius_to_fahrenheit
```

Viết `main.py` dùng cả 3 kiểu import.

### Bài tập 5: Thêm type hints và chạy mypy

Lấy một bài tập bất kỳ từ [Bài 5](./05-data-structures.md) hoặc [Bài 6](./06-oop.md), thêm type hints đầy đủ, cài `mypy` trong venv và chạy `mypy --strict` cho đến khi không còn lỗi.

<details>
<summary>💡 Xem đáp án gợi ý Bài tập 3 (slugify)</summary>

```python
import re
import unicodedata


def slugify(text: str) -> str:
    text = text.replace("đ", "d").replace("Đ", "D")        # đ không tách dấu được
    normalized = unicodedata.normalize("NFD", text)         # Tách chữ và dấu: "à" → "a" + "`"
    no_accents = "".join(c for c in normalized if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", no_accents.lower()).strip("-")


print(slugify("Xin Chào Python"))
# Output: xin-chao-python
print(slugify("  Học lập trình Đà Nẵng!!! "))
# Output: hoc-lap-trinh-da-nang
```

</details>

## ✅ Checklist hoàn thành

- [ ] Giải thích được module, package, library
- [ ] Dùng thành thạo `import x`, `from x import y`, `import x as z`
- [ ] Biết tại sao tránh `from x import *`
- [ ] Hiểu và luôn dùng `if __name__ == "__main__":`
- [ ] Tạo package có `__init__.py`, sub-package, dùng relative/absolute import
- [ ] Biết chạy module với `python -m`
- [ ] Dùng được `os`, `sys`, `datetime`, `random`, `math`, `itertools`
- [ ] Viết `requirements.txt` với ràng buộc phiên bản
- [ ] Dùng `Optional`, `Union` / `X | None`, `list[int]`, `TypedDict`, `Callable`
- [ ] Chạy `mypy` và hiểu thông báo lỗi
- [ ] Tổ chức được package nhiều module với chiều phụ thuộc một chiều, viết module tiện ích dùng lại (phần 🌍 Ứng dụng thực tế)
- [ ] Hoàn thành ít nhất 3 bài tập

## 🚀 Tiếp theo

Bạn đã biết cách tổ chức một project Python chuyên nghiệp. Bài tiếp theo sẽ mở ra những tính năng "phép thuật" giúp Python trở nên mạnh mẽ và thanh lịch: **iterator, generator, decorator, context manager, closure** và **lập trình bất đồng bộ với asyncio**.

**Bài tiếp theo**: [Python nâng cao](./09-advanced-python.md)

---

💡 **Tips nhớ lâu**:

- **Module = file, Package = thư mục có `__init__.py`**
- **`import module`** rõ ràng nhất; tránh `import *`
- **`if __name__ == "__main__":`** cho mọi script
- **Không đặt tên file trùng module chuẩn** (`random.py`, `json.py`...)
- **Luôn chạy từ thư mục gốc project**, dùng `python -m` khi cần
- **Kiểm tra kho standard library trước** khi `pip install` thư viện mới
