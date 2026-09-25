# 📚 Bài 16: Python trong Production

## 🎯 Mục tiêu bài học

- Hiểu "production-ready" nghĩa là gì và vì sao code "chạy được trên máy tôi" là chưa đủ
- Tổ chức project theo **src layout**, cấu hình mọi thứ trong **`pyproject.toml`**, đóng gói và cài đặt bằng `pip install -e .`
- Quản lý dependency chuyên nghiệp: **venv**, khóa phiên bản với **pip-tools / uv / poetry**
- Tự động kiểm tra chất lượng code: **ruff** (lint + format), **mypy --strict**, **pre-commit**
- Viết test chuyên nghiệp với **pytest nâng cao**: fixtures, `conftest.py`, `parametrize`, `tmp_path`, `monkeypatch`, `unittest.mock`, coverage, test API FastAPI
- Cấu hình ứng dụng bằng **biến môi trường**, `.env` và **pydantic-settings**
- **Logging** chuẩn production với `dictConfig` và log dạng **JSON**
- Xử lý lỗi và **retry** đúng cách; **profiling** để tìm chỗ chậm (`cProfile`, `timeit`)
- **Bảo mật** cơ bản: `secrets`, SQL injection, không commit `.env`
- Đóng gói app bằng **Docker** và chạy **CI** trên **GitHub Actions**
- **Capstone**: xây dựng hoàn chỉnh **Expense Tracker API** (FastAPI + SQLAlchemy + SQLite + pydantic-settings + logging + tests + Dockerfile + CI)

> 💡 Bài này tổng hợp kiến thức của cả khóa: OOP ([Bài 6](./06-oop.md)), exceptions ([Bài 7](./07-exceptions-files.md)), modules & packages ([Bài 8](./08-modules-packages.md)), decorator ([Bài 9](./09-advanced-python.md)), pytest ([Bài 10](./10-final-project.md)), logging ([Bài 11](./11-stdlib-practical.md)), FastAPI ([Bài 12](./12-http-web-apis.md)) và SQLAlchemy ([Bài 13](./13-databases.md)). Đây là bài dài nhất - hãy học từng mục, làm đến đâu chắc đến đó.

### Cài đặt thư viện cho bài này

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
python -m pip install --upgrade pip

pip install fastapi "uvicorn[standard]" sqlalchemy pydantic-settings httpx
pip install pytest pytest-cov ruff mypy pre-commit
```

## 📖 1. "Production" nghĩa là gì?

**Production** (môi trường vận hành thật) là nơi code của bạn phục vụ **người dùng thật**, với **dữ liệu thật**, chạy **24/7**, và khi hỏng thì **mất tiền thật**.

> 🧠 **Ví dụ dễ hiểu**: Nấu một bữa cơm cho gia đình khác hoàn toàn với mở **nhà hàng**. Ở nhà, món hơi mặn cũng không sao. Nhà hàng thì cần: công thức chuẩn hóa (ai nấu cũng ra cùng vị = **dependency cố định**), kiểm tra an toàn thực phẩm (**test, lint**), sổ ghi chép nhập hàng (**logging**), quy trình khi hết nguyên liệu (**xử lý lỗi, retry**), khóa kho (**bảo mật**), bếp giống hệt nhau ở mọi chi nhánh (**Docker**), và thanh tra định kỳ (**CI**).

| Câu hỏi | Script cá nhân | Ứng dụng production |
| --- | --- | --- |
| Người khác cài đặt được không? | "Cài mấy thư viện này là chạy" | `pip install .` / `docker run` là chạy |
| Đổi cấu hình (DB, API key) thế nào? | Sửa code | Biến môi trường, không sửa code |
| Có lỗi thì sao? | Đọc traceback trên màn hình | Log có cấu trúc, cảnh báo, retry |
| Làm sao biết sửa code không làm hỏng chỗ khác? | Chạy thử bằng tay | Test tự động + CI chạy mỗi lần push |
| Code có dễ đọc với người mới không? | Tùy hứng | Formatter + linter + type checker |
| Mật khẩu để ở đâu? | Trong code 😱 | Secret manager / biến môi trường |

## 📖 2. Cấu trúc project chuẩn - src layout

Có 2 cách bố trí phổ biến:

```text
flat layout (Bài 10)             src layout (khuyến nghị cho package/ứng dụng lớn)
todo-cli/                        expense-tracker/
├── todo/                        ├── src/
│   ├── __init__.py              │   └── expense_tracker/
│   └── ...                      │       ├── __init__.py
├── tests/                       │       └── ...
└── pyproject.toml               ├── tests/
                                 ├── pyproject.toml
                                 ├── README.md
                                 ├── .env.example
                                 ├── .gitignore
                                 ├── Dockerfile
                                 └── .github/workflows/ci.yml
```

### Tại sao nên dùng src layout?

Với flat layout, khi bạn chạy `pytest` ở thư mục gốc, Python tìm thấy thư mục `todo/` **ngay tại chỗ** và import nó - kể cả khi package **chưa được cài đặt đúng**. Test pass trên máy bạn, nhưng khi người khác `pip install` package của bạn thì lỗi (quên khai báo file, thiếu dependency...).

Với src layout, code nằm trong `src/` - **không** nằm trên đường dẫn import mặc định. Bạn **buộc phải cài đặt** package (`pip install -e .`) thì mới import được → test chạy trên **đúng thứ người dùng sẽ nhận được**.

> 🧠 **Ví dụ dễ hiểu**: Flat layout giống **thử món ăn ngay trong bếp** - mọi nguyên liệu đều trong tầm tay nên luôn "ngon". Src layout giống **đóng hộp món ăn rồi mở ra thử** như khách hàng - nếu quên cho gia vị vào hộp, bạn sẽ phát hiện ngay.

## 📖 3. pyproject.toml - Một file cấu hình cho tất cả

`pyproject.toml` (chuẩn PEP 518/621) là file cấu hình trung tâm của project Python hiện đại: thông tin package, dependency, và cấu hình của **mọi công cụ** (ruff, mypy, pytest, coverage...). Trước đây bạn phải có `setup.py`, `setup.cfg`, `requirements.txt`, `.flake8`, `mypy.ini`, `pytest.ini`... - giờ gom lại một chỗ.

```toml
# file: my-app/pyproject.toml
[build-system]                          # Công cụ nào sẽ "đóng gói" project
requires = ["hatchling>=1.24"]
build-backend = "hatchling.build"

[project]                               # Thông tin package (PEP 621)
name = "my-app"
version = "0.1.0"
description = "Ứng dụng mẫu"
readme = "README.md"
requires-python = ">=3.11"
authors = [{ name = "Nguyễn Văn An", email = "an@example.com" }]
dependencies = [                        # Dependency khi CHẠY - khai báo khoảng phiên bản
    "httpx>=0.27",
    "pydantic>=2.7,<3",
]

[project.optional-dependencies]         # Dependency tùy chọn: pip install -e ".[dev]"
dev = ["pytest>=8", "pytest-cov>=5", "ruff>=0.6", "mypy>=1.10"]

[project.scripts]                       # Tạo lệnh terminal: gõ `my-app` → gọi my_app.cli:main()
my-app = "my_app.cli:main"

[tool.hatch.build.targets.wheel]        # Code nằm ở đâu (src layout)
packages = ["src/my_app"]

[tool.pytest.ini_options]               # Cấu hình pytest
testpaths = ["tests"]
```

### Cài đặt package ở chế độ editable

```bash
cd my-app
pip install -e ".[dev]"
# -e (editable): cài dạng "liên kết" tới thư mục src/ → sửa code có hiệu lực NGAY, không cần cài lại
# ".[dev]": cài package hiện tại (.) kèm nhóm dependency "dev"

my-app --help            # Lệnh từ [project.scripts] đã có sẵn trong venv
python -c "import my_app; print(my_app.__file__)"
# Output (ví dụ): /home/an/my-app/src/my_app/__init__.py
```

| Lệnh | Ý nghĩa |
| --- | --- |
| `pip install .` | Cài package như người dùng cuối (bản sao vào venv) |
| `pip install -e .` | Cài editable - dành cho **lập trình viên** đang phát triển |
| `pip install -e ".[dev]"` | Editable + công cụ phát triển |
| `python -m build` | Tạo file phân phối `dist/*.whl` và `dist/*.tar.gz` (cần `pip install build`) |
| `twine upload dist/*` | Đăng lên PyPI để ai cũng `pip install` được |

> 💡 **Khai báo dependency trong `pyproject.toml` bằng khoảng phiên bản** (`>=2.7,<3`) - để package của bạn "sống chung" được với package khác. **Phiên bản chính xác** (`==2.9.2`) thuộc về **file lock** (mục 4), dùng khi triển khai ứng dụng.

## 📖 4. Quản lý dependency

### Vấn đề: "Hôm qua còn chạy, hôm nay cài lại thì lỗi"

`requirements.txt` ghi `fastapi` (không phiên bản) → hôm nay cài bản 0.115, tháng sau cài bản 0.120 có thay đổi → lỗi. Kể cả khi bạn ghi `fastapi==0.115.0`, các **dependency của fastapi** (starlette, pydantic...) vẫn có thể nhảy phiên bản.

Giải pháp: **file lock** - danh sách **mọi** package (kể cả gián tiếp) với **phiên bản chính xác**, được **sinh tự động** từ danh sách dependency trực tiếp.

> 🧠 **Ví dụ dễ hiểu**: `pyproject.toml` là **thực đơn** ("món phở cần bánh phở, thịt bò"). File lock là **hóa đơn nhập hàng chi tiết** ("bánh phở hãng X lô 123, thịt bò Úc lô 456"). Mọi chi nhánh nhập theo hóa đơn → món ăn giống hệt nhau.

### Ba công cụ phổ biến

**1. pip-tools** - nhẹ nhàng, dùng tiếp pip quen thuộc:

```bash
pip install pip-tools
pip-compile pyproject.toml -o requirements.lock                 # Sinh file lock từ dependencies
pip-compile pyproject.toml --extra dev -o requirements-dev.lock
pip-sync requirements-dev.lock                                  # Cài ĐÚNG những gì trong lock (gỡ thứ thừa)
pip-compile --upgrade-package fastapi pyproject.toml -o requirements.lock   # Nâng cấp có chủ đích
```

**2. uv** - viết bằng Rust, **nhanh gấp 10-100 lần pip**, đang trở thành lựa chọn phổ biến nhất:

```bash
# Cài: pip install uv   (hoặc xem hướng dẫn tại docs.astral.sh/uv)
uv venv                                  # Tạo .venv
uv pip install -e ".[dev]"               # Như pip nhưng rất nhanh
uv pip compile pyproject.toml -o requirements.lock   # Tương đương pip-compile

# Hoặc để uv quản lý toàn bộ project:
uv init my-app && cd my-app
uv add fastapi sqlalchemy                # Thêm dependency vào pyproject.toml + cập nhật uv.lock
uv add --dev pytest ruff
uv run pytest                            # Chạy lệnh trong môi trường đã đồng bộ với uv.lock
```

**3. poetry** - quản lý trọn gói (dependency, venv, build, publish):

```bash
pip install poetry
poetry new my-app
poetry add fastapi                       # Ghi vào pyproject.toml + poetry.lock
poetry add --group dev pytest
poetry install                           # Cài theo poetry.lock
poetry run pytest
```

| | pip + pip-tools | uv | poetry |
| --- | --- | --- | --- |
| Tốc độ | Bình thường | ⚡ Rất nhanh | Bình thường |
| File lock | `requirements.lock` | `uv.lock` (hoặc requirements) | `poetry.lock` |
| Quản lý phiên bản Python | ❌ | ✅ `uv python install 3.12` | ❌ |
| Độ phức tạp | Thấp | Thấp | Trung bình |
| Gợi ý | Project nhỏ, muốn đơn giản | **Project mới** | Team đã quen dùng |

> 💡 Dù dùng công cụ nào, nguyên tắc vẫn là: (1) **mỗi project một venv**, (2) **không commit** thư mục `.venv`, (3) **commit** file lock, (4) nâng cấp dependency **có chủ đích** và chạy test sau khi nâng cấp.

## 📖 5. Chất lượng code: ruff, mypy, pre-commit

Con người rất giỏi tranh cãi về dấu cách và rất tệ trong việc phát hiện biến chưa dùng. Hãy để **máy** làm những việc đó.

### ruff - Linter + formatter "tất cả trong một"

**Linter** tìm lỗi tiềm ẩn và code "có mùi" (import thừa, biến không dùng, `except:` trống...). **Formatter** tự động định dạng code theo một chuẩn thống nhất. `ruff` làm cả hai, thay thế flake8, isort, black, pyupgrade... và chạy **cực nhanh**.

Cho file `bad_code.py`:

```python
# file: lint-demo/bad_code.py
import os, sys
import json
from typing import List


def get_user(id, users: List[dict] = []):
    for u in users:
        if u["id"] == id:
            return u
    password = "123456"
    try:
        data = json.loads("{}")
    except:
        pass
    if id == None:
        return None
```

```bash
# --select: bật nhiều nhóm rule (mục dưới sẽ đưa cấu hình này vào pyproject.toml)
ruff check --select E,W,F,I,N,UP,B,SIM,S,RUF bad_code.py --output-format concise
# Output:
# bad_code.py:2:1: E401 [*] Multiple imports on one line
# bad_code.py:2:1: I001 [*] Import block is un-sorted or un-formatted
# bad_code.py:2:8: F401 [*] `os` imported but unused
# bad_code.py:2:12: F401 [*] `sys` imported but unused
# bad_code.py:4:1: UP035 `typing.List` is deprecated, use `list` instead
# bad_code.py:7:25: UP006 [*] Use `list` instead of `List` for type annotation
# bad_code.py:7:38: B006 Do not use mutable data structures for argument defaults
# bad_code.py:11:5: F841 Local variable `password` is assigned to but never used
# bad_code.py:11:16: S105 Possible hardcoded password assigned to: "password"
# bad_code.py:12:5: SIM105 Use `contextlib.suppress(BaseException)` instead of `try`-`except`-`pass`
# bad_code.py:13:9: F841 Local variable `data` is assigned to but never used
# bad_code.py:14:5: E722 Do not use bare `except`
# bad_code.py:14:5: S110 `try`-`except`-`pass` detected, consider logging the exception
# bad_code.py:16:14: E711 Comparison to `None` should be `cond is None`
# Found 14 errors.
# [*] 5 fixable with the `--fix` option (5 hidden fixes can be enabled with the `--unsafe-fixes` option).

ruff check --fix .        # Tự sửa những lỗi có [*]
ruff format .             # Định dạng lại toàn bộ code (giống black)
ruff format --check .     # Chỉ kiểm tra, không sửa - dùng trong CI
```

Chỉ 16 dòng code mà có 14 vấn đề - trong đó có cả **bug thật** (B006: default `[]` dùng chung giữa các lần gọi - nhớ lại Bài 4) và **lỗi bảo mật** (S105: mật khẩu viết cứng).

Cấu hình trong `pyproject.toml`:

```toml
[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
# E/W: pycodestyle, F: pyflakes, I: isort, N: đặt tên, UP: cú pháp hiện đại,
# B: bugbear (bug tiềm ẩn), SIM: đơn giản hóa, S: bandit (bảo mật), RUF: ruff riêng
select = ["E", "W", "F", "I", "N", "UP", "B", "SIM", "S", "RUF"]

[tool.ruff.lint.per-file-ignores]
"tests/**" = ["S101"]           # Cho phép dùng assert trong test
```

### mypy - Kiểm tra kiểu tĩnh

Bạn đã gặp type hints và mypy ở [Bài 8](./08-modules-packages.md). Trong production, hãy bật chế độ **`--strict`**: bắt buộc mọi hàm có type hints, không cho phép `Any` ngầm định.

```python
# file: lint-demo/typed.py
def average(numbers):
    return sum(numbers) / len(numbers)


def find_price(prices: dict[str, int], name: str) -> int:
    return prices.get(name)


def greet(name: str) -> str:
    return "Xin chào " + name


total: int = average([1, 2, 3])
greet(42)
```

```bash
mypy typed.py
# Output:
# typed.py:7: error: Incompatible return value type (got "int | None", expected "int")  [return-value]
# typed.py:15: error: Argument 1 to "greet" has incompatible type "int"; expected "str"  [arg-type]
# Found 2 errors in 1 file (checked 1 source file)

mypy --strict typed.py
# Output:
# typed.py:2: error: Function is missing a type annotation  [no-untyped-def]
# typed.py:7: error: Incompatible return value type (got "int | None", expected "int")  [return-value]
# typed.py:14: error: Call to untyped function "average" in typed context  [no-untyped-call]
# typed.py:15: error: Argument 1 to "greet" has incompatible type "int"; expected "str"  [arg-type]
# Found 4 errors in 1 file (checked 1 source file)
```

Lỗi ở dòng 7 là **bug thật**: `dict.get()` trả về `None` khi không tìm thấy, và code gọi hàm sẽ nổ `TypeError` ở một chỗ rất xa. Ở chế độ thường, mypy **bỏ qua** hàm `average` vì nó không có type hints - `--strict` bắt bạn khai báo đầy đủ.

```toml
[tool.mypy]
strict = true
python_version = "3.11"
```

> 💡 Với project cũ chưa có type hints, bật `strict` ngay sẽ ra hàng trăm lỗi. Hãy bật dần: bắt đầu với `disallow_untyped_defs = true` cho module mới, hoặc dùng `[[tool.mypy.overrides]]` để nới lỏng cho module cũ.

### pre-commit - Tự động kiểm tra trước mỗi commit

Có công cụ rồi nhưng... hay quên chạy. **pre-commit** gắn các công cụ vào **git hook**: mỗi lần `git commit`, chúng tự chạy; nếu có lỗi, commit bị chặn lại.

```yaml
# file: my-app/.pre-commit-config.yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v5.0.0
    hooks:
      - id: trailing-whitespace        # Xóa khoảng trắng cuối dòng
      - id: end-of-file-fixer          # File kết thúc bằng một dòng trống
      - id: check-yaml
      - id: check-added-large-files    # Chặn commit file quá lớn
      - id: detect-private-key         # Chặn commit khóa bí mật!
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.6.9
    hooks:
      - id: ruff                       # Lint (tự sửa được thì sửa)
        args: [--fix]
      - id: ruff-format                # Format
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.11.2
    hooks:
      - id: mypy
        additional_dependencies: [pydantic, pydantic-settings, sqlalchemy, fastapi]
```

```bash
pip install pre-commit
pre-commit install              # Cài git hook (làm 1 lần mỗi khi clone repo)
pre-commit run --all-files      # Chạy thử trên toàn bộ code
pre-commit autoupdate           # Cập nhật "rev" lên phiên bản mới nhất
```

### 💡 Tips quan trọng

- **Formatter chấm dứt mọi tranh cãi về style** - cả team dùng `ruff format`, không ai phải review dấu cách nữa ✅
- Chạy lint/type-check ở **3 nơi**: trong editor (extension Ruff, Pylance/mypy), pre-commit, và CI ✅
- Đừng tắt cảnh báo bừa bãi bằng `# noqa` / `# type: ignore` - nếu buộc phải dùng, ghi rõ mã lỗi và lý do: `# noqa: S311 - random không dùng cho bảo mật` ✅
- Áp dụng cho project cũ: bật **từng nhóm rule** một, sửa dần ❌ đừng bật tất cả rồi bỏ cuộc

## 📖 6. pytest nâng cao

Bài 10 đã giới thiệu pytest, fixture, `parametrize`, `pytest.raises`. Mục này đi sâu vào các kỹ thuật bạn sẽ dùng **hằng ngày** khi test code thật: code đọc biến môi trường, ghi file, gọi API bên ngoài.

### Module cần test

```python
# file: testing-demo/pricing.py
"""Tính tiền giỏ hàng - module minh họa các kỹ thuật test."""
import json
import os
from dataclasses import asdict, dataclass
from pathlib import Path

import httpx

DISCOUNTS = {"SALE10": 10, "VIP20": 20}


class InvalidCouponError(ValueError):
    """Mã giảm giá không hợp lệ."""


@dataclass(frozen=True)
class Item:
    name: str
    price: int          # VND - dùng số nguyên cho tiền, KHÔNG dùng float
    qty: int = 1


def subtotal(items: list[Item]) -> int:
    return sum(item.price * item.qty for item in items)


def apply_coupon(amount: int, code: str | None) -> int:
    if code is None:
        return amount
    percent = DISCOUNTS.get(code.strip().upper())
    if percent is None:
        raise InvalidCouponError(f"Mã không hợp lệ: {code}")
    return amount * (100 - percent) // 100


def shipping_fee(amount: int) -> int:
    """Miễn phí ship từ ngưỡng cấu hình qua biến môi trường FREE_SHIP_FROM."""
    free_from = int(os.environ.get("FREE_SHIP_FROM", "500000"))
    return 0 if amount >= free_from else 30_000


def get_usd_rate(client: httpx.Client) -> float:
    """Gọi API bên ngoài lấy tỷ giá - thứ KHÔNG nên gọi thật trong unit test."""
    response = client.get("https://api.example.com/rates/USD")
    response.raise_for_status()
    return float(response.json()["vnd"])


def checkout_usd(items: list[Item], code: str | None, client: httpx.Client) -> float:
    amount = apply_coupon(subtotal(items), code)
    return round((amount + shipping_fee(amount)) / get_usd_rate(client), 2)


def save_order(path: Path, items: list[Item]) -> None:
    data = [asdict(item) for item in items]
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def load_order(path: Path) -> list[Item]:
    return [Item(**row) for row in json.loads(path.read_text(encoding="utf-8"))]
```

### Fixtures và conftest.py

**Fixture** = "đồ nghề" chuẩn bị sẵn cho test. Đặt fixture trong **`conftest.py`** thì mọi file test trong thư mục đều dùng được mà **không cần import**.

```python
# file: testing-demo/tests/conftest.py
from collections.abc import Iterator

import httpx
import pytest

from pricing import Item


@pytest.fixture
def cart() -> list[Item]:
    """Giỏ hàng mẫu - mỗi test nhận một bản MỚI (scope mặc định = "function")."""
    return [Item("Áo", 150_000, 2), Item("Mũ", 90_000)]


@pytest.fixture
def fake_rate_client() -> Iterator[httpx.Client]:
    """Client HTTP giả: trả tỷ giá 25.000 mà không cần internet.

    Dùng yield: code SAU yield là phần dọn dẹp (teardown), luôn chạy kể cả khi test lỗi.
    """
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"vnd": 25_000})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    yield client
    client.close()                          # Teardown


@pytest.fixture(scope="session")
def coupon_codes() -> list[str]:
    """scope="session": chỉ tạo MỘT lần cho cả phiên test - hợp với thứ tốn kém (kết nối DB...)."""
    return ["SALE10", "VIP20"]
```

### Test đầy đủ các kỹ thuật

```python
# file: testing-demo/tests/test_pricing.py
from pathlib import Path
from unittest.mock import Mock, patch

import httpx
import pytest

import pricing
from pricing import InvalidCouponError, Item


# ---------- 1. Dùng fixture: chỉ cần khai báo tên làm tham số ----------
def test_subtotal(cart: list[Item]) -> None:
    assert pricing.subtotal(cart) == 390_000


# ---------- 2. parametrize: 1 hàm test, nhiều bộ dữ liệu ----------
@pytest.mark.parametrize(
    ("amount", "code", "expected"),
    [
        (100_000, None, 100_000),
        (100_000, "SALE10", 90_000),
        (100_000, "vip20", 80_000),          # Không phân biệt hoa thường
        (100_000, "  SALE10 ", 90_000),      # Có khoảng trắng thừa
    ],
    ids=["no-coupon", "sale10", "lowercase", "whitespace"],
)
def test_apply_coupon(amount: int, code: str | None, expected: int) -> None:
    assert pricing.apply_coupon(amount, code) == expected


def test_invalid_coupon_raises() -> None:
    with pytest.raises(InvalidCouponError, match="FAKE"):   # match: kiểm tra nội dung thông báo
        pricing.apply_coupon(100_000, "FAKE")


def test_all_coupons_give_discount(coupon_codes: list[str]) -> None:
    for code in coupon_codes:
        assert pricing.apply_coupon(100_000, code) < 100_000


# ---------- 3. monkeypatch: tạm thay biến môi trường / thuộc tính ----------
def test_shipping_default_threshold(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("FREE_SHIP_FROM", raising=False)     # Đảm bảo không bị ảnh hưởng từ máy
    assert pricing.shipping_fee(499_999) == 30_000
    assert pricing.shipping_fee(500_000) == 0


def test_shipping_custom_threshold(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FREE_SHIP_FROM", "200000")          # Tự khôi phục sau test
    assert pricing.shipping_fee(250_000) == 0


def test_checkout_with_monkeypatched_rate(monkeypatch: pytest.MonkeyPatch, cart: list[Item]) -> None:
    monkeypatch.setattr(pricing, "get_usd_rate", lambda client: 20_000.0)
    monkeypatch.setenv("FREE_SHIP_FROM", "1000000")
    # 390.000 + 30.000 ship = 420.000 VND / 20.000 = 21 USD
    assert pricing.checkout_usd(cart, None, client=Mock()) == 21.0


# ---------- 4. Test gọi API bằng client giả (fixture MockTransport) ----------
def test_get_usd_rate(fake_rate_client: httpx.Client) -> None:
    assert pricing.get_usd_rate(fake_rate_client) == 25_000.0


# ---------- 5. unittest.mock: Mock, patch, side_effect, assert_called ----------
def test_get_usd_rate_calls_correct_url() -> None:
    client = Mock()                                         # Object "giả" - nhận mọi lời gọi
    client.get.return_value.json.return_value = {"vnd": "24500"}
    assert pricing.get_usd_rate(client) == 24_500.0
    client.get.assert_called_once_with("https://api.example.com/rates/USD")


def test_get_usd_rate_propagates_http_error() -> None:
    client = Mock()
    client.get.side_effect = httpx.ConnectError("mất mạng")  # side_effect: ném exception khi gọi
    with pytest.raises(httpx.ConnectError):
        pricing.get_usd_rate(client)


def test_checkout_with_patch(cart: list[Item]) -> None:
    # patch("module.tên"): thay tạm trong khối with - patch ĐÚNG nơi hàm được TRA CỨU khi chạy
    with patch("pricing.get_usd_rate", return_value=26_000.0) as fake_rate:
        result = pricing.checkout_usd(cart, "SALE10", client=Mock())
    fake_rate.assert_called_once()
    assert result == round((351_000 + 30_000) / 26_000, 2)


# ---------- 6. tmp_path: thư mục tạm riêng cho mỗi test, tự dọn ----------
def test_save_and_load_roundtrip(tmp_path: Path, cart: list[Item]) -> None:
    order_file = tmp_path / "order.json"
    pricing.save_order(order_file, cart)
    assert order_file.exists()
    assert "Áo" in order_file.read_text(encoding="utf-8")   # ensure_ascii=False giữ tiếng Việt
    assert pricing.load_order(order_file) == cart
```

Chạy test (dùng `python -m pytest` để thư mục hiện tại được thêm vào đường dẫn import):

```bash
cd testing-demo
python -m pytest -v
# Output (ví dụ):
# ============================= test session starts ==============================
# collected 15 items
#
# tests/test_pricing.py::test_subtotal PASSED                              [  6%]
# tests/test_pricing.py::test_apply_coupon[no-coupon] PASSED               [ 13%]
# tests/test_pricing.py::test_apply_coupon[sale10] PASSED                  [ 20%]
# tests/test_pricing.py::test_apply_coupon[lowercase] PASSED               [ 26%]
# tests/test_pricing.py::test_apply_coupon[whitespace] PASSED              [ 33%]
# tests/test_pricing.py::test_invalid_coupon_raises PASSED                 [ 40%]
# ...
# tests/test_pricing.py::test_save_and_load_roundtrip PASSED               [100%]
#
# ============================== 15 passed in 0.03s ==============================

python -m pytest -k coupon          # Chỉ chạy test có "coupon" trong tên
python -m pytest -x                 # Dừng ngay khi có test lỗi đầu tiên
python -m pytest --lf               # Chỉ chạy lại các test lỗi lần trước
```

### Mock vs monkeypatch vs fake - Chọn cái nào?

| Kỹ thuật | Dùng khi | Ví dụ |
| --- | --- | --- |
| **Dependency injection + fake** | Thiết kế cho phép truyền phụ thuộc vào | Truyền `httpx.Client(transport=MockTransport(...))` |
| `monkeypatch.setenv/setattr` | Thay biến môi trường, thuộc tính đơn giản | Đổi `FREE_SHIP_FROM` |
| `unittest.mock.Mock` | Cần object giả + **kiểm tra cách nó được gọi** | `assert_called_once_with(...)` |
| `unittest.mock.patch` | Code tự tạo phụ thuộc bên trong, không truyền vào được | `patch("module.requests.get")` |

> 💡 **Mock càng ít càng tốt**. Test mock quá nhiều sẽ kiểm tra "code gọi hàm nào" thay vì "code cho ra kết quả đúng", và gãy mỗi khi bạn refactor. Thiết kế hàm **nhận phụ thuộc làm tham số** (như `client` ở trên) giúp test dễ hơn nhiều.

> ⚠️ **Patch đúng chỗ**: nếu `app.py` viết `from pricing import get_usd_rate`, thì phải `patch("app.get_usd_rate")` - vì `app` đã có tên `get_usd_rate` **riêng** trỏ tới hàm gốc. Quy tắc: patch **nơi tên được tra cứu**, không phải nơi hàm được định nghĩa.

### Coverage - Đo độ phủ của test

**Coverage** cho biết dòng code nào **đã được** test chạy qua và dòng nào **chưa**:

```bash
pip install pytest-cov
python -m pytest --cov=pricing --cov-report=term-missing
# Output (ví dụ):
# Name         Stmts   Miss  Cover   Missing
# ------------------------------------------
# pricing.py      36      0   100%
# ------------------------------------------
# TOTAL           36      0   100%
# ============================== 15 passed in 0.09s ==============================

python -m pytest --cov=pricing --cov-report=html     # Báo cáo HTML: mở htmlcov/index.html
```

> ⚠️ **Coverage 100% ≠ không có bug**. Coverage chỉ cho biết dòng code **đã chạy**, không cho biết bạn đã **kiểm tra đúng** kết quả. Mục tiêu hợp lý: 80-90% cho logic nghiệp vụ, và quan trọng hơn là test các **trường hợp biên** (0, rỗng, âm, rất lớn, None, lỗi mạng...).

### Test API FastAPI

FastAPI có sẵn `TestClient` (dựa trên httpx) để gọi API **không cần chạy server**. Kết hợp với **`app.dependency_overrides`** để thay dependency thật (DB, dịch vụ ngoài) bằng bản giả:

```python
from typing import Annotated

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

app = FastAPI()


def get_weather_service() -> dict[str, int]:
    raise RuntimeError("Gọi API thời tiết thật - không muốn điều này trong test!")


@app.get("/weather/{city}")
def weather(city: str, service: Annotated[dict[str, int], Depends(get_weather_service)]) -> dict:
    temp = service.get(city)
    return {"city": city, "temp": temp, "hot": temp is not None and temp >= 35}


# Trong test: thay dependency thật bằng dữ liệu giả
app.dependency_overrides[get_weather_service] = lambda: {"hanoi": 36, "dalat": 18}
client = TestClient(app)

response = client.get("/weather/hanoi")
print(response.status_code, response.json())
print(client.get("/weather/dalat").json()["hot"])
app.dependency_overrides.clear()                  # Dọn dẹp sau test
# Output:
# 200 {'city': 'hanoi', 'temp': 36, 'hot': True}
# False
```

Phần capstone ở cuối bài có bộ test API đầy đủ với database thật (SQLite tạm).

> 💡 Với Starlette/FastAPI bản rất mới, nếu bạn thấy cảnh báo `StarletteDeprecationWarning: Using httpx with starlette.testclient is deprecated; install httpx2 instead`, chỉ cần `pip install httpx2` - `TestClient` sẽ tự dùng thư viện này.

### 💡 Tips quan trọng

- Mỗi test phải **độc lập**: không phụ thuộc thứ tự chạy, không dùng chung dữ liệu có thể bị sửa ✅
- Test **không gọi mạng thật**, không ghi vào file/DB thật - dùng `tmp_path`, `MockTransport`, DB tạm ✅
- Đặt tên test mô tả hành vi: `test_invalid_coupon_raises` tốt hơn `test_coupon_2` ✅
- Dùng `ids=` trong `parametrize` để kết quả dễ đọc ✅
- Test chậm (> 1 giây) → đánh dấu `@pytest.mark.slow`, chạy riêng: `pytest -m "not slow"` ✅

## 📖 7. Cấu hình bằng biến môi trường: .env và pydantic-settings

### Tại sao không để cấu hình trong code?

Cùng một code chạy ở **3 môi trường**: máy bạn (SQLite, debug bật), staging (DB thử nghiệm), production (PostgreSQL, debug tắt, API key thật). Nếu cấu hình nằm trong code, mỗi lần triển khai lại phải **sửa code** - vừa dễ sai, vừa để lộ mật khẩu trong Git.

Nguyên tắc **Twelve-Factor App**: *"Lưu cấu hình trong môi trường"* - code giống hệt nhau ở mọi nơi, chỉ **biến môi trường** là khác.

> 🧠 **Ví dụ dễ hiểu**: Code là **chiếc xe**; cấu hình là **địa chỉ đích đến** nhập vào GPS. Bạn không cần đóng một chiếc xe mới cho mỗi chuyến đi - chỉ cần nhập địa chỉ khác.

### File .env

Gõ `export` hàng chục biến mỗi lần mở terminal thì rất mệt. File **`.env`** chứa các biến ở dạng `TÊN=giá_trị`, được thư viện đọc tự động khi chạy ở máy dev:

```bash
# .env - CHỈ dùng ở máy dev, KHÔNG BAO GIỜ commit lên Git
APP_DATABASE_URL=sqlite:///./dev.db
APP_SECRET_KEY=dev-secret-change-me
APP_DEBUG=true
```

Luôn kèm file **`.env.example`** (commit được) liệt kê **tên** các biến cần có với giá trị mẫu, để đồng đội biết cần cấu hình gì.

### pydantic-settings - Cấu hình có kiểm tra kiểu

`os.environ.get("APP_DEBUG")` luôn trả về **chuỗi** (hoặc `None`): `"false"` là chuỗi khác rỗng → `bool("false")` là `True`! 😱 **pydantic-settings** đọc biến môi trường/`.env`, **chuyển kiểu** và **kiểm tra hợp lệ** ngay khi khởi động - sai cấu hình thì app **dừng ngay** với thông báo rõ ràng (*fail fast*), thay vì chạy được nửa ngày rồi mới lỗi.

```python
import os
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict

# Tạo file .env mẫu cho ví dụ
Path(".env").write_text(
    "APP_DATABASE_URL=postgresql://shop:matkhau@db:5432/shop\n"
    "APP_DEBUG=true\n"
    "APP_SECRET_KEY=super-secret-123\n"
    'APP_ALLOWED_HOSTS=["shop.vn", "api.shop.vn"]\n',
    encoding="utf-8",
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",            # Đọc thêm từ file .env (nếu có)
        env_prefix="APP_",          # Biến APP_DEBUG → trường debug
        extra="ignore",             # Bỏ qua biến lạ trong .env
    )

    app_name: str = "Shop API"                          # Có giá trị mặc định
    environment: Literal["dev", "staging", "prod"] = "dev"
    debug: bool = False                                 # "true"/"1"/"yes" → True
    database_url: str = "sqlite:///./dev.db"
    secret_key: SecretStr                               # BẮT BUỘC - không có mặc định
    max_upload_mb: int = Field(default=10, gt=0, le=100)
    allowed_hosts: list[str] = ["localhost"]            # Kiểu phức tạp: viết dạng JSON


@lru_cache                                              # Chỉ đọc cấu hình MỘT lần
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
print(settings.debug, type(settings.debug).__name__)
print(settings.database_url)
print(settings.allowed_hosts)
print(settings.secret_key)                              # SecretStr: tự che khi in/log
print(settings.secret_key.get_secret_value())           # Lấy giá trị thật khi thực sự cần
# Output:
# True bool
# postgresql://shop:matkhau@db:5432/shop
# ['shop.vn', 'api.shop.vn']
# **********
# super-secret-123

# Thứ tự ưu tiên: tham số truyền vào > biến môi trường > .env > giá trị mặc định
os.environ["APP_DEBUG"] = "false"
print(Settings().debug)
# Output: False

# Cấu hình sai → lỗi NGAY khi khởi động, thông báo rõ ràng
os.environ["APP_MAX_UPLOAD_MB"] = "500"
try:
    Settings()
except ValidationError as e:
    err = e.errors()[0]
    print(f"❌ {err['loc'][0]}: {err['msg']}")
# Output: ❌ max_upload_mb: Input should be less than or equal to 100
```

> 💡 Dùng `get_settings()` có `@lru_cache` thay vì biến toàn cục `settings = Settings()` ở cấp module: cấu hình chỉ được đọc khi **cần**, và trong test bạn có thể truyền `Settings(...)` riêng hoặc gọi `get_settings.cache_clear()` sau khi `monkeypatch.setenv`.

## 📖 8. Logging chuẩn production

Bài 11 đã giới thiệu module `logging`. Trong production, bạn cần thêm:

- **Cấu hình tập trung** bằng `logging.config.dictConfig` - một dict mô tả toàn bộ: định dạng, nơi ghi, mức độ
- **Log dạng JSON** - mỗi dòng là một object JSON. Hệ thống thu thập log (ELK, Grafana Loki, CloudWatch, Datadog) **tìm kiếm, lọc, thống kê** được theo từng trường (`level`, `user_id`, `duration_ms`...) thay vì phải regex từng dòng chữ
- **Ngữ cảnh** trong mỗi log: request id, user id, thời gian xử lý...

```python
import json
import logging
import logging.config
from datetime import datetime, timezone

# Các thuộc tính CÓ SẴN của LogRecord - để tách riêng phần "extra" do ta thêm vào
_STANDARD_ATTRS = set(vars(logging.makeLogRecord({}))) | {"message", "asctime"}


class JsonFormatter(logging.Formatter):
    """Mỗi bản ghi log → một dòng JSON."""

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "time": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(timespec="seconds"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        # Các trường truyền qua extra={...}
        payload.update({k: v for k, v in vars(record).items() if k not in _STANDARD_ATTRS})
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False, default=str)


LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,           # Không tắt logger của thư viện khác
    "formatters": {
        "json": {"()": JsonFormatter},           # "()": dùng class tự viết
        "plain": {"format": "%(asctime)s %(levelname)-8s %(name)s: %(message)s"},
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
            "stream": "ext://sys.stdout",
        },
        "file": {
            "class": "logging.handlers.RotatingFileHandler",   # Tự "xoay" file khi quá lớn
            "filename": "app.log",
            "maxBytes": 5_000_000,               # 5MB/file
            "backupCount": 3,                    # Giữ app.log.1 ... app.log.3
            "encoding": "utf-8",
            "formatter": "plain",
        },
    },
    "loggers": {
        "shop": {"level": "DEBUG"},              # Logger của app: chi tiết
        "httpx": {"level": "WARNING"},           # Thư viện ồn ào: chỉ cảnh báo trở lên
    },
    "root": {"level": "INFO", "handlers": ["console", "file"]},
}

logging.config.dictConfig(LOGGING_CONFIG)
log = logging.getLogger("shop.orders")          # Tên phân cấp: shop.orders thuộc "shop"

log.info("Tạo đơn hàng", extra={"order_id": 1024, "user_id": 7, "amount": 350000})
log.debug("Chi tiết giỏ hàng", extra={"items": ["Áo", "Mũ"]})
try:
    1 / 0
except ZeroDivisionError:
    log.exception("Lỗi tính giảm giá", extra={"order_id": 1024})   # Tự đính kèm traceback
# Output (ví dụ):
# {"time": "2025-03-15T07:00:00+00:00", "level": "INFO", "logger": "shop.orders", "message": "Tạo đơn hàng", "order_id": 1024, "user_id": 7, "amount": 350000}
# {"time": "2025-03-15T07:00:00+00:00", "level": "DEBUG", "logger": "shop.orders", "message": "Chi tiết giỏ hàng", "items": ["Áo", "Mũ"]}
# {"time": "2025-03-15T07:00:00+00:00", "level": "ERROR", "logger": "shop.orders", "message": "Lỗi tính giảm giá", "order_id": 1024, "exception": "Traceback (most recent call last):\n  File \"/home/an/shop/logging_demo.py\", line 62, in <module>\n    1 / 0\n    ~~^~~\nZeroDivisionError: division by zero"}
```

Quy tắc vàng khi log:

- ✅ Dùng `logging.getLogger(__name__)` trong mỗi module; chỉ cấu hình (`dictConfig`) **một lần** ở điểm khởi động app
- ✅ Truyền tham số: `log.info("User %s đăng nhập", user_id)` hoặc `extra=` - **không** dùng f-string trong log (tốn công định dạng kể cả khi log bị tắt, và làm hỏng việc gom nhóm log giống nhau)
- ✅ Chọn đúng mức: `DEBUG` (chi tiết để debug) < `INFO` (sự kiện bình thường) < `WARNING` (bất thường nhưng vẫn chạy) < `ERROR` (thao tác thất bại) < `CRITICAL` (app sắp chết)
- ❌ **Không bao giờ log** mật khẩu, token, số thẻ, dữ liệu cá nhân nhạy cảm
- ✅ Trong container (Docker), log ra **stdout** - nền tảng sẽ thu thập; không cần ghi file

## 📖 9. Xử lý lỗi và retry

### Nguyên tắc xử lý lỗi trong ứng dụng thật

1. **Fail fast khi khởi động**: thiếu cấu hình, không kết nối được DB → dừng ngay, báo rõ (pydantic-settings làm điều này)
2. **Tạo cây exception riêng** cho nghiệp vụ (`AppError` → `NotFoundError`, `PermissionDeniedError`...) - như Bài 7, Bài 10
3. **Bắt lỗi ở "biên"** (tầng API/CLI): chuyển exception thành HTTP status/thông báo thân thiện. Tầng giữa **không nuốt lỗi**
4. **Giữ nguyên nhân gốc**: `raise ServiceError("...") from e`
5. **Chỉ retry lỗi tạm thời** (mất mạng, timeout, HTTP 503/429) - **không** retry lỗi logic (400, dữ liệu sai), vì thử lại 100 lần vẫn sai

### Retry với exponential backoff + jitter

Khi server đang quá tải, nếu 1.000 client cùng thử lại **ngay lập tức** thì server càng sập nặng. **Exponential backoff**: chờ 0.1s → 0.2s → 0.4s → 0.8s... (gấp đôi mỗi lần). **Jitter**: cộng thêm một chút ngẫu nhiên để các client không thử lại **cùng một lúc**.

```python
import functools
import logging
import random
import sys
import time
from collections.abc import Callable
from typing import ParamSpec, TypeVar

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s", stream=sys.stdout)
log = logging.getLogger("retry")

P = ParamSpec("P")
R = TypeVar("R")


def retry(
    *,
    on: tuple[type[Exception], ...],        # CHỈ retry những lỗi này
    attempts: int = 3,
    base_delay: float = 0.1,
    max_delay: float = 2.0,
) -> Callable[[Callable[P, R]], Callable[P, R]]:
    """Decorator retry với exponential backoff + jitter (xem lại decorator có tham số, Bài 9)."""

    def decorator(func: Callable[P, R]) -> Callable[P, R]:
        @functools.wraps(func)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            for attempt in range(1, attempts + 1):
                try:
                    return func(*args, **kwargs)
                except on as e:
                    if attempt == attempts:
                        log.error("%s thất bại sau %d lần: %s", func.__name__, attempts, e)
                        raise
                    delay = min(max_delay, base_delay * 2 ** (attempt - 1))
                    delay += random.uniform(0, delay * 0.1)           # Jitter ±10%
                    log.warning("%s lỗi lần %d (%s) → thử lại sau %.1fs",
                                func.__name__, attempt, e, delay)
                    time.sleep(delay)
            raise AssertionError("không bao giờ tới đây")
        return wrapper
    return decorator


calls = {"n": 0}


@retry(on=(ConnectionError, TimeoutError), attempts=4)
def fetch_exchange_rate() -> float:
    calls["n"] += 1
    if calls["n"] < 3:                       # Giả lập: 2 lần đầu mất mạng
        raise ConnectionError("mất kết nối")
    return 25_400.0


@retry(on=(ConnectionError,), attempts=3)
def parse_amount(text: str) -> int:
    return int(text)                          # ValueError KHÔNG nằm trong `on` → không retry


print("Tỷ giá:", fetch_exchange_rate())
try:
    parse_amount("abc")
except ValueError as e:
    print("Không retry lỗi dữ liệu:", e)
# Output:
# WARNING fetch_exchange_rate lỗi lần 1 (mất kết nối) → thử lại sau 0.1s
# WARNING fetch_exchange_rate lỗi lần 2 (mất kết nối) → thử lại sau 0.2s
# Tỷ giá: 25400.0
# Không retry lỗi dữ liệu: invalid literal for int() with base 10: 'abc'
```

> 💡 Trong dự án thật, dùng thư viện **`tenacity`** (`pip install tenacity`) - đã xử lý sẵn mọi trường hợp: `@retry(stop=stop_after_attempt(4), wait=wait_exponential_jitter(initial=0.1), retry=retry_if_exception_type(ConnectionError))`. Nhưng hiểu cách tự viết giúp bạn dùng nó đúng.

> ⚠️ Chỉ retry thao tác **idempotent** (làm nhiều lần cho cùng kết quả: đọc dữ liệu, `PUT`, `DELETE`). Retry một request "chuyển 1 triệu" bị timeout có thể chuyển **2 lần** nếu thật ra lần đầu đã thành công! Với thao tác không idempotent, dùng **idempotency key** (mã duy nhất cho mỗi giao dịch, server bỏ qua nếu đã xử lý).

## 📖 10. Profiling và tối ưu hiệu năng

> 🧠 **Ví dụ dễ hiểu**: Xe chạy chậm, bạn không thay cả động cơ ngay - bạn đưa xe đi **kiểm tra** xem chậm do lốp non, phanh bó hay động cơ yếu. **Profiler** là "máy chẩn đoán" cho code: chỉ ra **chính xác** hàm nào tốn thời gian nhất.

> *"Premature optimization is the root of all evil"* - Donald Knuth. Tối ưu khi chưa đo = đoán mò, thường tối ưu nhầm chỗ và làm code khó đọc hơn.

### timeit - Đo đoạn code nhỏ

```python
import timeit

setup = "data_list = list(range(10_000)); data_set = set(data_list)"
t_list = timeit.timeit("9_999 in data_list", setup=setup, number=10_000)
t_set = timeit.timeit("9_999 in data_set", setup=setup, number=10_000)
print(f"Tìm trong list: {t_list * 1000:.1f}ms | trong set: {t_set * 1000:.2f}ms "
      f"→ set nhanh hơn ~{t_list / t_set:,.0f} lần")

words = ["python"] * 10_000
t_concat = timeit.timeit(lambda: "".join(w for w in words), number=200)
t_plus = timeit.timeit("s = ''\nfor w in words: s += w", globals={"words": words}, number=200)
print(f"join: {t_concat * 1000:.0f}ms | cộng chuỗi: {t_plus * 1000:.0f}ms")
# Output (ví dụ):
# Tìm trong list: 508.8ms | trong set: 0.21ms → set nhanh hơn ~2,385 lần
# join: 43ms | cộng chuỗi: 62ms
```

Từ terminal: `python -m timeit -s "x = list(range(1000))" "sum(x)"`.

### cProfile - Tìm "điểm nghẽn" trong chương trình

```python
import cProfile
import io
import pstats
import random


def load_orders(n: int) -> list[dict]:
    rng = random.Random(0)
    return [{"id": i, "customer": f"KH{rng.randint(1, n // 2)}"} for i in range(n)]


def find_repeat_customers_slow(orders: list[dict]) -> list[str]:
    seen: list[str] = []                     # ❌ list: "in" phải duyệt cả list - O(n)
    repeat: list[str] = []
    for order in orders:
        c = order["customer"]
        if c in seen and c not in repeat:
            repeat.append(c)
        seen.append(c)
    return repeat


def find_repeat_customers_fast(orders: list[dict]) -> list[str]:
    seen: set[str] = set()                   # ✅ set: "in" gần như O(1)
    repeat: dict[str, None] = {}             # dict giữ thứ tự chèn, tra cứu O(1)
    for order in orders:
        c = order["customer"]
        if c in seen:
            repeat[c] = None
        seen.add(c)
    return list(repeat)


def main() -> None:
    orders = load_orders(20_000)
    slow = find_repeat_customers_slow(orders)
    fast = find_repeat_customers_fast(orders)
    assert slow == fast


with cProfile.Profile() as profiler:          # Python 3.8+: dùng như context manager
    main()

stream = io.StringIO()
stats = pstats.Stats(profiler, stream=stream).strip_dirs().sort_stats("cumulative")  # strip_dirs: bỏ đường dẫn dài
stats.print_stats(8)                          # 8 hàm tốn thời gian nhất
print("\n".join(stream.getvalue().splitlines()[:18]))
# Output (ví dụ):
#          218794 function calls in 1.298 seconds
#
#    Ordered by: cumulative time
#    List reduced from 19 to 8 due to restriction <8>
#
#    ncalls  tottime  percall  cumtime  percall filename:lineno(function)
#         1    0.000    0.000    1.298    1.298 profile_demo.py:34(main)
#         1    1.244    1.244    1.248    1.248 profile_demo.py:12(find_repeat_customers_slow)
#         1    0.000    0.000    0.043    0.043 profile_demo.py:7(load_orders)
#         1    0.011    0.011    0.043    0.043 profile_demo.py:9(<listcomp>)
#     20000    0.005    0.000    0.032    0.000 random.py:358(randint)
#     20000    0.012    0.000    0.028    0.000 random.py:284(randrange)
#     20000    0.009    0.000    0.012    0.000 random.py:235(_randbelow_with_getrandbits)
#         1    0.005    0.005    0.007    0.007 profile_demo.py:23(find_repeat_customers_fast)
```

Đọc bảng: **`cumtime`** = tổng thời gian hàm chạy (kể cả hàm con), **`tottime`** = thời gian **riêng** hàm đó, **`ncalls`** = số lần gọi. Ở đây `find_repeat_customers_slow` chiếm **~96%** thời gian (1.248s), trong khi bản `_fast` chỉ mất 0.007s - chỉ đổi `list` → `set` là nhanh hơn **gần 200 lần**. Lưu ý chương trình tên là `profile_demo.py` (đừng đặt tên file là `profile.py` hay `cProfile.py` - sẽ "đè" lên module chuẩn!). Đó là sức mạnh của việc chọn đúng cấu trúc dữ liệu (Bài 5).

Chạy profiler cho cả script từ terminal:

```bash
python -m cProfile -s cumtime my_script.py | head -20
# Xem trực quan bằng biểu đồ: pip install snakeviz
python -m cProfile -o profile.out my_script.py && snakeviz profile.out
# Profile app ĐANG CHẠY (production) mà không cần sửa code: pip install py-spy
py-spy top --pid 12345
```

### Checklist tối ưu (theo thứ tự nên thử)

1. **Thuật toán & cấu trúc dữ liệu**: `set`/`dict` thay `list` khi tra cứu, tránh vòng lặp lồng nhau O(n²)
2. **Không làm lại việc đã làm**: `@functools.cache` / `lru_cache` (Bài 9), đưa phép tính bất biến ra ngoài vòng lặp
3. **I/O**: gộp truy vấn DB (tránh "N+1 query"), thêm index, dùng batch; song song hóa I/O ([Bài 14](./14-concurrency-parallelism.md))
4. **Vector hóa**: dùng pandas/NumPy thay vòng lặp Python ([Bài 15](./15-data-processing.md))
5. **Song song hóa CPU**: `ProcessPoolExecutor`
6. Cuối cùng mới nghĩ tới: Cython, Rust extension, PyPy...

## 📖 11. Bảo mật cơ bản

### secrets - Sinh giá trị ngẫu nhiên an toàn

Bạn đã gặp `secrets` và `hashlib` ở [Bài 11](./11-stdlib-practical.md). Nhắc lại điểm cốt lõi: module `random` **dự đoán được** (dùng cho game, mô phỏng). Token, mật khẩu, mã OTP phải dùng **`secrets`**:

```python
import hashlib
import hmac
import os
import secrets
import string

token = secrets.token_urlsafe(32)              # Token cho link reset mật khẩu, API key
print(len(token) >= 40, token.isascii())
# Output: True True

alphabet = string.ascii_letters + string.digits
password = "".join(secrets.choice(alphabet) for _ in range(16))
otp = f"{secrets.randbelow(1_000_000):06d}"    # Mã OTP 6 chữ số
print(len(password), len(otp))
# Output: 16 6

# So sánh bí mật: DÙNG compare_digest - thời gian so sánh không phụ thuộc vị trí ký tự sai
# (== dừng ngay ở ký tự khác đầu tiên → kẻ tấn công đo thời gian để đoán dần từng ký tự)
print(secrets.compare_digest("abc123", "abc123"))
# Output: True


# Lưu mật khẩu người dùng: KHÔNG lưu bản gốc, KHÔNG dùng md5/sha256 trần.
# Dùng hàm băm "chậm có chủ đích" + salt ngẫu nhiên: scrypt (có sẵn), argon2/bcrypt (thư viện)
def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    salt_hex, digest_hex = stored.split("$")
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt_hex), n=2**14, r=8, p=1)
    return hmac.compare_digest(digest.hex(), digest_hex)


stored = hash_password("MatKhau@2025")
print(verify_password("MatKhau@2025", stored), verify_password("matkhau@2025", stored))
print(hash_password("abc") != hash_password("abc"))   # Cùng mật khẩu, salt khác → hash khác
# Output:
# True False
# True
```

> 💡 Trong dự án thật, dùng thư viện chuyên dụng như **`argon2-cffi`** hoặc **`pwdlib`** / **`bcrypt`** thay vì tự viết.

### SQL injection - Lỗ hổng kinh điển

Nhắc lại từ [Bài 13](./13-databases.md) vì đây là lỗi bảo mật **phổ biến và nguy hiểm bậc nhất**: không bao giờ **ghép chuỗi** dữ liệu người dùng vào câu SQL:

```python
import sqlite3

conn = sqlite3.connect(":memory:")
conn.execute("CREATE TABLE users (username TEXT, password_hash TEXT, is_admin INTEGER)")
conn.executemany("INSERT INTO users VALUES (?, ?, ?)",
                 [("an", "h1", 0), ("admin", "h2", 1)])

user_input = "' OR '1'='1"                     # Kẻ tấn công nhập chuỗi này vào ô "tên đăng nhập"

# ❌ f-string: dữ liệu trở thành MỘT PHẦN câu lệnh SQL
query = f"SELECT username FROM users WHERE username = '{user_input}'"
print(query)
print("Ghép chuỗi:", conn.execute(query).fetchall())

# ✅ Tham số hóa (?): dữ liệu LUÔN chỉ là dữ liệu, không bao giờ thành lệnh
print("Tham số hóa:", conn.execute(
    "SELECT username FROM users WHERE username = ?", (user_input,)
).fetchall())
# Output:
# SELECT username FROM users WHERE username = '' OR '1'='1'
# Ghép chuỗi: [('an',), ('admin',)]
# Tham số hóa: []
```

Với chuỗi `' OR '1'='1`, điều kiện `WHERE` luôn đúng → lộ **toàn bộ** người dùng (hoặc đăng nhập được mà không cần mật khẩu). Kẻ xấu còn có thể nhập `'; DROP TABLE users; --`. ORM như SQLAlchemy (Bài 13) tự tham số hóa - nhưng nếu bạn dùng `text()` với f-string thì vẫn bị!

### Không commit bí mật

```gitignore
# .gitignore
.env
.env.*
!.env.example
*.pem
*.key
.venv/
__pycache__/
*.db
```

- Lỡ commit mật khẩu/API key lên GitHub? **Xóa commit là không đủ** (bot đã quét trong vài giây). Việc đầu tiên: **đổi (rotate) ngay** mật khẩu/key đó
- Dùng công cụ quét: `pre-commit` hook `detect-private-key`, **gitleaks**, GitHub **secret scanning**
- Production: lưu bí mật trong **secret manager** (GitHub Actions Secrets, AWS Secrets Manager, Vault...) và truyền vào app qua biến môi trường

### Các lỗi bảo mật thường gặp khác

| ❌ Nguy hiểm | ✅ An toàn |
| --- | --- |
| `eval(user_input)` / `exec(...)` | `ast.literal_eval` cho literal, hoặc parse thủ công |
| `pickle.loads(data_từ_bên_ngoài)` | `json.loads` - pickle có thể **chạy code tùy ý** |
| `yaml.load(f)` | `yaml.safe_load(f)` |
| `subprocess.run(f"convert {filename}", shell=True)` | `subprocess.run(["convert", filename])` (list, không shell) |
| `open(base_dir + user_path)` | Kiểm tra `(base_dir / user_path).resolve().is_relative_to(base_dir)` |
| `requests.get(url, verify=False)` | Giữ kiểm tra chứng chỉ SSL |
| Dependency cũ có lỗ hổng | `pip install pip-audit && pip-audit` định kỳ, bật Dependabot |
| `DEBUG=True` ở production | Tắt debug - trang lỗi debug làm lộ code và cấu hình |

## 📖 12. Docker - Đóng gói ứng dụng

### Tại sao cần Docker?

"Chạy trên máy em được mà!" - câu nói kinh điển. Máy bạn Python 3.11, server Python 3.9; máy bạn có thư viện hệ thống X, server không có...

> 🧠 **Ví dụ dễ hiểu**: **Docker image** giống **container hàng hóa** 📦 tiêu chuẩn: bạn đóng gói **mọi thứ** app cần (hệ điều hành tối giản, Python, thư viện, code) vào một "thùng" chuẩn. Tàu nào (máy nào có Docker) cũng chở được, và mở ra ở đâu cũng **giống hệt nhau**. **Dockerfile** là **bản hướng dẫn đóng thùng**. **Container** là thùng hàng đang được "mở ra dùng" (image đang chạy).

Cài Docker Desktop (Windows/macOS) hoặc Docker Engine (Linux) tại [docs.docker.com](https://docs.docker.com/get-docker/).

### Dockerfile cho app FastAPI

Đây là Dockerfile của capstone Expense Tracker (mục 14). Mỗi dòng đều có lý do:

```dockerfile
# file: expense-tracker/Dockerfile
# ---- Image nền: Python 3.11 bản "slim" (nhỏ gọn, ~50MB thay vì ~350MB) ----
FROM python:3.11-slim

# Không tạo file .pyc; in log ra ngay (không đệm) → thấy log tức thì với `docker logs`
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Tạo user thường: KHÔNG chạy app bằng root (nếu app bị hack, kẻ tấn công không có quyền root)
RUN useradd --create-home --uid 1000 appuser

# ---- Cài dependency TRƯỚC khi copy code ----
# Docker cache theo từng lớp (layer): nếu requirements.lock không đổi, lớp này được dùng lại
# → sửa code rồi build lại chỉ mất vài giây thay vì cài lại toàn bộ thư viện
COPY requirements.lock ./
RUN pip install -r requirements.lock

# ---- Copy code và cài package (không cài lại dependency) ----
COPY pyproject.toml README.md ./
COPY src ./src
RUN pip install --no-deps .

# Thư mục chứa file SQLite, thuộc về appuser (gắn volume vào đây để dữ liệu không mất)
RUN mkdir -p /app/data && chown appuser:appuser /app/data
VOLUME ["/app/data"]

USER appuser

ENV EXPENSE_DATABASE_URL=sqlite:////app/data/expenses.db \
    EXPENSE_ENVIRONMENT=prod \
    EXPENSE_LOG_JSON=true

EXPOSE 8000

# Docker tự kiểm tra app còn "sống" không
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2)"]

# Lệnh `expense-tracker` (từ [project.scripts]) chạy uvicorn với factory create_app.
# Dạng exec (list JSON): app là tiến trình chính → nhận tín hiệu tắt (SIGTERM) đúng cách.
# --host 0.0.0.0: nhận kết nối từ ngoài container (127.0.0.1 chỉ nhận từ bên trong)
CMD ["expense-tracker", "--host", "0.0.0.0", "--port", "8000"]
```

File `requirements.lock` được sinh từ `pyproject.toml` (mục 4):

```bash
pip install pip-tools
pip-compile pyproject.toml -o requirements.lock
# hoặc: uv pip compile pyproject.toml -o requirements.lock
```

**`.dockerignore`** - những thứ **không** được đưa vào image (giống `.gitignore`), giúp build nhanh và tránh lộ bí mật:

```text
# file: expense-tracker/.dockerignore
.venv/
.git/
.env
__pycache__/
*.pyc
.pytest_cache/
.mypy_cache/
.ruff_cache/
htmlcov/
.coverage
*.db
tests/
```

### Build và chạy

```bash
cd expense-tracker
docker build -t expense-tracker:1.0 .           # Build image, đặt tên:phiên bản

# -p: cổng máy thật:cổng trong container
# -v: volume - dữ liệu SQLite sống sót khi xóa container
# -e: bí mật truyền qua biến môi trường
docker run -d --name expense \
  -p 8000:8000 \
  -v expense-data:/app/data \
  -e EXPENSE_API_KEY="$(openssl rand -hex 24)" \
  expense-tracker:1.0

docker ps                                       # Xem container đang chạy (cột STATUS có "healthy")
docker logs -f expense                          # Xem log (JSON)
curl http://localhost:8000/health
docker stop expense && docker rm expense
```

> 💡 **docker compose** giúp khai báo nhiều dịch vụ (app + PostgreSQL + Redis...) trong một file `compose.yaml` và chạy tất cả bằng `docker compose up`. Đây là bước tiếp theo tự nhiên khi app của bạn cần database thật.

## 📖 13. CI với GitHub Actions

**CI (Continuous Integration)** = mỗi lần push code hoặc mở Pull Request, một máy chủ **tự động** cài project từ đầu và chạy lint + type-check + test. Code lỗi bị phát hiện **trước khi** được merge.

> 🧠 **Ví dụ dễ hiểu**: CI giống **máy soi chiếu ở sân bay** 🛃 - mọi hành lý (commit) đều phải đi qua, không ngoại lệ, kể cả của "sếp". Nhờ vậy không ai phải tin vào lời hứa "em chạy test rồi".

Tạo file `.github/workflows/ci.yml` trong repo:

```yaml
# file: expense-tracker/.github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:                              # Chạy cho mọi Pull Request

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ["3.11", "3.12"]    # Test trên nhiều phiên bản Python

    steps:
      - uses: actions/checkout@v4            # Lấy code về

      - uses: actions/setup-python@v5        # Cài Python
        with:
          python-version: ${{ matrix.python-version }}
          cache: pip                         # Cache thư viện → lần sau chạy nhanh hơn
          cache-dependency-path: pyproject.toml

      - name: Cài đặt
        run: |
          python -m pip install --upgrade pip
          pip install -e ".[dev]"

      - name: Lint (ruff)
        run: |
          ruff check .
          ruff format --check .

      - name: Type check (mypy)
        run: mypy

      - name: Test (pytest + coverage)
        run: pytest --cov --cov-report=term-missing
```

Push lên GitHub, vào tab **Actions** để xem kết quả. Thêm **badge** vào README để khoe trạng thái ✅, và bật **branch protection** (Settings → Branches) để **bắt buộc CI xanh** trước khi merge.

> 💡 Dự án thường có thêm workflow **CD** (Continuous Deployment): khi merge vào `main` và CI xanh → tự build Docker image, đẩy lên registry (Docker Hub, GitHub Container Registry) và triển khai lên server/cloud.

## 🌍 Ứng dụng thực tế - Capstone: Expense Tracker API

Đã đến lúc ghép **mọi thứ** lại thành một ứng dụng hoàn chỉnh, đúng chuẩn production: **API quản lý chi tiêu cá nhân**.

### Tính năng

| Method | Endpoint | Chức năng |
| --- | --- | --- |
| `GET` | `/health` | Kiểm tra app còn sống (dùng cho Docker healthcheck, load balancer) |
| `POST` | `/expenses` | Thêm khoản chi (cần API key nếu được cấu hình) |
| `GET` | `/expenses` | Danh sách, lọc theo `category`, `date_from`, `date_to`, phân trang `limit`/`offset` |
| `GET` | `/expenses/summary` | Tổng hợp theo danh mục trong khoảng thời gian |
| `GET` | `/expenses/{id}` | Xem một khoản chi |
| `PATCH` | `/expenses/{id}` | Sửa một phần khoản chi |
| `DELETE` | `/expenses/{id}` | Xóa khoản chi |

### Kiến trúc

```text
          HTTP request
               │
┌──────────────▼───────────────┐
│ main.py   create_app()       │  Factory: cấu hình, logging, middleware, lifespan
├──────────────────────────────┤
│ api.py    Router + Depends   │  Tầng HTTP: validate (schemas), status code, API key
├──────────────────────────────┤
│ repository.py                │  Tầng dữ liệu: mọi truy vấn SQLAlchemy
├──────────────────────────────┤
│ models.py / database.py      │  Bảng, engine, session
└──────────────┬───────────────┘
               ▼
          SQLite / PostgreSQL

config.py (pydantic-settings) và logging_config.py được dùng bởi mọi tầng
```

Mỗi tầng chỉ biết tầng ngay dưới nó (giống Bài 10: models → storage → service → cli). Nhờ vậy: đổi SQLite sang PostgreSQL chỉ cần đổi `EXPENSE_DATABASE_URL`; test được từng tầng riêng.

### Cấu trúc thư mục

```text
expense-tracker/
├── .github/workflows/ci.yml     # CI (mục 13)
├── src/
│   └── expense_tracker/
│       ├── __init__.py          # Phiên bản
│       ├── __main__.py          # Lệnh chạy server
│       ├── api.py               # Các endpoint
│       ├── config.py            # Settings (pydantic-settings)
│       ├── database.py          # Engine, session, Base
│       ├── logging_config.py    # dictConfig + JSON formatter
│       ├── main.py              # create_app()
│       ├── models.py            # Bảng SQLAlchemy
│       ├── repository.py        # Truy vấn dữ liệu
│       └── schemas.py           # Pydantic: dữ liệu vào/ra
├── tests/
│   ├── conftest.py
│   ├── test_api.py
│   ├── test_config.py
│   ├── test_logging.py
│   └── test_schemas.py
├── .dockerignore                # Mục 12
├── .env.example
├── .gitignore
├── Dockerfile                   # Mục 12
├── README.md
├── pyproject.toml
└── requirements.lock            # Sinh bằng pip-compile / uv (mục 4)
```

### Bước 1: Khởi tạo project

```bash
mkdir -p expense-tracker/src/expense_tracker expense-tracker/tests expense-tracker/.github/workflows
cd expense-tracker
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
python -m pip install --upgrade pip
```

```toml
# file: expense-tracker/pyproject.toml
[build-system]
requires = ["hatchling>=1.24"]
build-backend = "hatchling.build"

[project]
name = "expense-tracker"
version = "1.0.0"
description = "API quản lý chi tiêu cá nhân - capstone khóa học Python"
readme = "README.md"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.30",
    "sqlalchemy>=2.0",
    "pydantic>=2.7",
    "pydantic-settings>=2.3",
]

[project.optional-dependencies]
dev = [
    "pytest>=8",
    "pytest-cov>=5",
    "httpx>=0.27",
    "ruff>=0.6",
    "mypy>=1.10",
    "pre-commit>=3.7",
]

[project.scripts]
expense-tracker = "expense_tracker.__main__:main"

[tool.hatch.build.targets.wheel]
packages = ["src/expense_tracker"]

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "W", "F", "I", "N", "UP", "B", "SIM", "S", "RUF"]

[tool.ruff.lint.per-file-ignores]
"tests/**" = ["S101"]

[tool.mypy]
strict = true
python_version = "3.11"
files = ["src"]

[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-ra --strict-markers"

[tool.coverage.run]
source = ["expense_tracker"]
branch = true
omit = ["*/__main__.py"]    # Chỉ gọi uvicorn - không cần unit test

[tool.coverage.report]
show_missing = true
skip_covered = false
fail_under = 90
```

Lưu ý `fail_under = 90`: nếu coverage dưới 90%, lệnh `pytest --cov` **thất bại** → CI đỏ. `README.md` bắt buộc phải có vì `pyproject.toml` khai báo `readme = "README.md"`:

```markdown
<!-- file: expense-tracker/README.md -->
# Expense Tracker API

API quản lý chi tiêu cá nhân - capstone khóa học Python.

- Cài đặt: `pip install -e ".[dev]"`
- Chạy server: `expense-tracker --reload` rồi mở http://127.0.0.1:8000/docs
- Kiểm tra: `ruff check . && mypy && pytest --cov`
```

```bash
# file: expense-tracker/.env.example
# Sao chép thành .env rồi sửa giá trị: cp .env.example .env
EXPENSE_ENVIRONMENT=dev
EXPENSE_DATABASE_URL=sqlite:///./expenses.db
EXPENSE_LOG_LEVEL=INFO
EXPENSE_LOG_JSON=false
# Để trống = không yêu cầu API key (chỉ nên dùng khi dev)
# EXPENSE_API_KEY=thay-bang-chuoi-ngau-nhien-dai
```

```text
# file: expense-tracker/.gitignore
.venv/
__pycache__/
*.pyc
.env
*.db
.pytest_cache/
.mypy_cache/
.ruff_cache/
.coverage
htmlcov/
dist/
```

### Bước 2: Phiên bản và cấu hình

```python
# file: expense-tracker/src/expense_tracker/__init__.py
"""Expense Tracker API - quản lý chi tiêu cá nhân."""

__version__ = "1.0.0"
```

```python
# file: expense-tracker/src/expense_tracker/config.py
"""Cấu hình ứng dụng: đọc từ biến môi trường (tiền tố EXPENSE_) và file .env."""

from functools import lru_cache
from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="EXPENSE_",
        extra="ignore",
    )

    app_name: str = "Expense Tracker API"
    environment: Literal["dev", "test", "prod"] = "dev"
    database_url: str = "sqlite:///./expenses.db"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    log_json: bool = False
    # Nếu đặt API key: mọi thao tác GHI (POST/PATCH/DELETE) phải gửi header X-API-Key
    api_key: SecretStr | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

Mọi cấu hình đều có giá trị mặc định an toàn cho môi trường dev → clone về là chạy được ngay. Production chỉ việc đặt biến môi trường `EXPENSE_*`.

### Bước 3: Logging

Tái sử dụng `JsonFormatter` ở mục 8. Khi dev, log dạng chữ dễ đọc; production (`EXPENSE_LOG_JSON=true`), log dạng JSON:

```python
# file: expense-tracker/src/expense_tracker/logging_config.py
"""Cấu hình logging: dạng chữ dễ đọc khi dev, dạng JSON khi chạy production."""

import json
import logging
import logging.config
from datetime import UTC, datetime
from typing import Any

# Thuộc tính có sẵn của LogRecord (+ "color_message" uvicorn tự thêm) - không đưa vào JSON
_STANDARD_ATTRS = set(vars(logging.makeLogRecord({}))) | {"message", "asctime", "color_message"}


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "time": datetime.fromtimestamp(record.created, tz=UTC).isoformat(timespec="seconds"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        payload.update({k: v for k, v in vars(record).items() if k not in _STANDARD_ATTRS})
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False, default=str)


def setup_logging(level: str = "INFO", json_logs: bool = False) -> None:
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "json": {"()": JsonFormatter},
                "plain": {"format": "%(asctime)s %(levelname)-8s %(name)s: %(message)s"},
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "json" if json_logs else "plain",
                    "stream": "ext://sys.stdout",
                },
            },
            "loggers": {
                "expense_tracker": {"level": level},
                "uvicorn.access": {"level": "WARNING"},  # Đã có log request riêng của ta
            },
            "root": {"level": "INFO", "handlers": ["console"]},
        }
    )
```

### Bước 4: Database và model

```python
# file: expense-tracker/src/expense_tracker/database.py
"""Kết nối database: engine, session và lớp Base cho các model."""

from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    pass


def make_engine(url: str) -> Engine:
    # SQLite mặc định chỉ cho dùng connection ở thread tạo ra nó;
    # FastAPI chạy endpoint đồng bộ trong threadpool → cần tắt kiểm tra này
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return create_engine(url, connect_args=connect_args)


def make_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, expire_on_commit=False)


def get_session(request: Request) -> Iterator[Session]:
    """Dependency: mỗi request một session, tự đóng khi xong."""
    session_factory: sessionmaker[Session] = request.app.state.session_factory
    with session_factory() as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]
```

`get_session` là **dependency có `yield`** (giống fixture có yield của pytest): FastAPI mở session trước khi gọi endpoint và **đóng** sau khi trả response - kể cả khi có lỗi.

```python
# file: expense-tracker/src/expense_tracker/models.py
"""Model SQLAlchemy - cấu trúc bảng trong database."""

from datetime import date, datetime

from sqlalchemy import Date, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from expense_tracker.database import Base


class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    amount: Mapped[int]  # VND, số nguyên - KHÔNG dùng float cho tiền
    category: Mapped[str] = mapped_column(String(50), index=True)
    note: Mapped[str] = mapped_column(String(255), default="")
    spent_on: Mapped[date] = mapped_column(Date, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
```

> 💡 **Tại sao tiền dùng `int`?** `0.1 + 0.2 == 0.30000000000000004` - float có sai số làm tròn, cộng dồn hàng nghìn giao dịch sẽ lệch. VND không có phần lẻ nên dùng số nguyên là hoàn hảo. Với tiền tệ có phần lẻ (USD), lưu theo **cent** (số nguyên) hoặc dùng `decimal.Decimal`.

### Bước 5: Schemas - kiểm tra dữ liệu vào/ra

```python
# file: expense-tracker/src/expense_tracker/schemas.py
"""Schema Pydantic - dữ liệu vào/ra của API, kèm kiểm tra hợp lệ."""

from datetime import date

from pydantic import BaseModel, ConfigDict, Field, field_validator

MAX_AMOUNT = 1_000_000_000  # 1 tỷ đồng/khoản chi


def _normalize_category(value: str) -> str:
    normalized = " ".join(value.split()).lower()
    if not normalized:
        raise ValueError("category không được để trống")
    return normalized


class ExpenseCreate(BaseModel):
    amount: int = Field(gt=0, le=MAX_AMOUNT, description="Số tiền (VND)", examples=[45000])
    category: str = Field(min_length=1, max_length=50, examples=["ăn uống"])
    note: str = Field(default="", max_length=255)
    spent_on: date = Field(default_factory=date.today)

    @field_validator("category")
    @classmethod
    def normalize_category(cls, value: str) -> str:
        return _normalize_category(value)


class ExpenseUpdate(BaseModel):
    """Mọi trường đều tùy chọn: chỉ cập nhật những gì được gửi lên (PATCH)."""

    amount: int | None = Field(default=None, gt=0, le=MAX_AMOUNT)
    category: str | None = Field(default=None, min_length=1, max_length=50)
    note: str | None = Field(default=None, max_length=255)
    spent_on: date | None = None

    @field_validator("category")
    @classmethod
    def normalize_category(cls, value: str | None) -> str | None:
        return None if value is None else _normalize_category(value)


class ExpenseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)  # Cho phép tạo từ object SQLAlchemy

    id: int
    amount: int
    category: str
    note: str
    spent_on: date


class CategoryTotal(BaseModel):
    category: str
    total: int
    count: int


class Summary(BaseModel):
    total: int
    count: int
    by_category: list[CategoryTotal]
```

Tách **3 loại schema** là thực hành chuẩn: `ExpenseCreate` (client gửi lên - không có `id`), `ExpenseUpdate` (mọi trường tùy chọn cho PATCH), `ExpenseRead` (trả về - có `id`). Client **không bao giờ** tự đặt được `id` hay `created_at`.

### Bước 6: Repository - tầng truy cập dữ liệu

```python
# file: expense-tracker/src/expense_tracker/repository.py
"""Tầng truy cập dữ liệu: mọi câu truy vấn nằm ở đây, API không viết SQL trực tiếp."""

from collections.abc import Sequence
from datetime import date

from sqlalchemy import ColumnElement, func, select
from sqlalchemy.orm import Session

from expense_tracker.models import Expense
from expense_tracker.schemas import CategoryTotal, ExpenseCreate, ExpenseUpdate, Summary


class ExpenseRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def create(self, data: ExpenseCreate) -> Expense:
        expense = Expense(**data.model_dump())
        self.session.add(expense)
        self.session.commit()
        self.session.refresh(expense)
        return expense

    def get(self, expense_id: int) -> Expense | None:
        return self.session.get(Expense, expense_id)

    def search(
        self,
        *,
        category: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Sequence[Expense]:
        stmt = (
            select(Expense)
            .where(*self._conditions(category, date_from, date_to))
            .order_by(Expense.spent_on.desc(), Expense.id.desc())
            .limit(limit)
            .offset(offset)
        )
        return self.session.scalars(stmt).all()

    def update(self, expense: Expense, data: ExpenseUpdate) -> Expense:
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(expense, field, value)
        self.session.commit()
        self.session.refresh(expense)
        return expense

    def delete(self, expense: Expense) -> None:
        self.session.delete(expense)
        self.session.commit()

    def summary(self, *, date_from: date | None = None, date_to: date | None = None) -> Summary:
        total = func.sum(Expense.amount)
        stmt = (
            select(Expense.category, total.label("total"), func.count(Expense.id).label("count"))
            .where(*self._conditions(None, date_from, date_to))
            .group_by(Expense.category)
            .order_by(total.desc())
        )
        rows = self.session.execute(stmt).all()
        by_category = [
            CategoryTotal(category=category, total=cat_total, count=count)
            for category, cat_total, count in rows
        ]
        return Summary(
            total=sum(c.total for c in by_category),
            count=sum(c.count for c in by_category),
            by_category=by_category,
        )

    @staticmethod
    def _conditions(
        category: str | None, date_from: date | None, date_to: date | None
    ) -> list[ColumnElement[bool]]:
        """Tạo danh sách điều kiện WHERE từ các bộ lọc tùy chọn."""
        conditions: list[ColumnElement[bool]] = []
        if category is not None:
            conditions.append(Expense.category == category.strip().lower())
        if date_from is not None:
            conditions.append(Expense.spent_on >= date_from)
        if date_to is not None:
            conditions.append(Expense.spent_on <= date_to)
        return conditions
```

`model_dump(exclude_unset=True)` chỉ lấy những trường client **thực sự gửi** → PATCH `{"amount": 35000}` không vô tình xóa `note` thành `None`.

### Bước 7: API endpoints

```python
# file: expense-tracker/src/expense_tracker/api.py
"""Các endpoint của API."""

import secrets
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status

from expense_tracker import __version__
from expense_tracker.config import Settings
from expense_tracker.database import SessionDep
from expense_tracker.models import Expense
from expense_tracker.repository import ExpenseRepository
from expense_tracker.schemas import ExpenseCreate, ExpenseRead, ExpenseUpdate, Summary

router = APIRouter()


def get_settings_from_app(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


def get_repository(session: SessionDep) -> ExpenseRepository:
    return ExpenseRepository(session)


def require_api_key(
    settings: Annotated[Settings, Depends(get_settings_from_app)],
    x_api_key: Annotated[str | None, Header()] = None,
) -> None:
    """Bảo vệ thao tác ghi. Không cấu hình API key (dev) → cho qua."""
    if settings.api_key is None:
        return
    expected = settings.api_key.get_secret_value()
    if x_api_key is None or not secrets.compare_digest(x_api_key, expected):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="API key không hợp lệ")


RepoDep = Annotated[ExpenseRepository, Depends(get_repository)]
WriteAccess = [Depends(require_api_key)]


def get_or_404(repo: ExpenseRepository, expense_id: int) -> Expense:
    expense = repo.get(expense_id)
    if expense is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail=f"Không tìm thấy khoản chi {expense_id}"
        )
    return expense


@router.get("/health", tags=["system"])
def health(settings: Annotated[Settings, Depends(get_settings_from_app)]) -> dict[str, str]:
    return {"status": "ok", "version": __version__, "environment": settings.environment}


@router.post(
    "/expenses",
    response_model=ExpenseRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=WriteAccess,
    tags=["expenses"],
)
def create_expense(data: ExpenseCreate, repo: RepoDep) -> Expense:
    return repo.create(data)


@router.get("/expenses", response_model=list[ExpenseRead], tags=["expenses"])
def list_expenses(
    repo: RepoDep,
    category: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[Expense]:
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="date_from phải <= date_to")
    return list(
        repo.search(
            category=category, date_from=date_from, date_to=date_to, limit=limit, offset=offset
        )
    )


# ⚠️ Phải khai báo TRƯỚC /expenses/{expense_id}, nếu không "summary" bị hiểu là expense_id
@router.get("/expenses/summary", response_model=Summary, tags=["reports"])
def expense_summary(
    repo: RepoDep, date_from: date | None = None, date_to: date | None = None
) -> Summary:
    return repo.summary(date_from=date_from, date_to=date_to)


@router.get("/expenses/{expense_id}", response_model=ExpenseRead, tags=["expenses"])
def get_expense(expense_id: int, repo: RepoDep) -> Expense:
    return get_or_404(repo, expense_id)


@router.patch(
    "/expenses/{expense_id}",
    response_model=ExpenseRead,
    dependencies=WriteAccess,
    tags=["expenses"],
)
def update_expense(expense_id: int, data: ExpenseUpdate, repo: RepoDep) -> Expense:
    return repo.update(get_or_404(repo, expense_id), data)


@router.delete(
    "/expenses/{expense_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=WriteAccess,
    tags=["expenses"],
)
def delete_expense(expense_id: int, repo: RepoDep) -> None:
    repo.delete(get_or_404(repo, expense_id))
```

Điểm đáng chú ý:

- **`Annotated[..., Depends(...)]`**: cách khai báo dependency hiện đại, tái sử dụng được (`RepoDep`, `SessionDep`) và không bị ruff cảnh báo B008
- **API key** so sánh bằng `secrets.compare_digest` (mục 11); chỉ thao tác **ghi** mới cần key
- **Thứ tự route**: `/expenses/summary` phải đứng trước `/expenses/{expense_id}`

### Bước 8: Application factory và điểm chạy

```python
# file: expense-tracker/src/expense_tracker/main.py
"""Tạo ứng dụng FastAPI (application factory)."""

import logging
import time
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response

from expense_tracker import __version__
from expense_tracker.api import router
from expense_tracker.config import Settings, get_settings
from expense_tracker.database import Base, make_engine, make_session_factory
from expense_tracker.logging_config import setup_logging

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    """Factory: mỗi lần gọi tạo một app MỚI với cấu hình riêng - rất tiện cho test."""
    settings = settings or get_settings()
    setup_logging(settings.log_level, settings.log_json)
    engine = make_engine(settings.database_url)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        # Chạy khi app khởi động. Dự án lớn: dùng Alembic để migrate thay vì create_all
        Base.metadata.create_all(engine)
        logger.info("Khởi động %s (env=%s)", settings.app_name, settings.environment)
        yield
        engine.dispose()  # Chạy khi app tắt
        logger.info("Đã tắt ứng dụng")

    app = FastAPI(title=settings.app_name, version=__version__, lifespan=lifespan)
    app.state.settings = settings
    app.state.session_factory = make_session_factory(engine)
    app.include_router(router)

    @app.middleware("http")
    async def log_requests(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:8]
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 1)
        response.headers["X-Request-ID"] = request_id
        logger.info(
            "%s %s → %s (%.1fms)",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            extra={"request_id": request_id, "duration_ms": duration_ms},
        )
        return response

    return app
```

Tại sao dùng **factory** `create_app(settings)` thay vì biến toàn cục `app = FastAPI()`?

- Test truyền được `Settings` riêng (DB tạm) cho **từng test** - không đụng vào DB thật
- Không có "tác dụng phụ" khi import module (không tự kết nối DB, không cấu hình logging lúc import)
- Middleware gắn **request id** vào mỗi request và log thời gian xử lý - khi người dùng báo lỗi, bạn tìm đúng dòng log bằng id trong header `X-Request-ID`

```python
# file: expense-tracker/src/expense_tracker/__main__.py
"""Chạy bằng: python -m expense_tracker  (hoặc lệnh `expense-tracker` sau khi cài đặt)."""

import argparse

import uvicorn


def main() -> None:
    parser = argparse.ArgumentParser(description="Chạy Expense Tracker API")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--reload", action="store_true", help="Tự khởi động lại khi sửa code (dev)")
    args = parser.parse_args()
    uvicorn.run(
        "expense_tracker.main:create_app",
        factory=True,
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_config=None,  # Để uvicorn dùng chung cấu hình logging của app
    )


if __name__ == "__main__":
    main()
```

### Bước 9: Tests

```python
# file: expense-tracker/tests/conftest.py
from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from expense_tracker.config import Settings
from expense_tracker.main import create_app


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    """Cấu hình cho test: DB SQLite tạm riêng cho TỪNG test, không đọc file .env."""
    return Settings(
        _env_file=None,  # type: ignore[call-arg]
        environment="test",
        database_url=f"sqlite:///{tmp_path / 'test.db'}",
        log_level="WARNING",
        api_key=None,
    )


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    app = create_app(settings)
    with TestClient(app) as test_client:  # "with" → chạy lifespan (tạo bảng)
        yield test_client


@pytest.fixture
def make_expense(client: TestClient) -> Callable[..., dict[str, Any]]:
    """Fixture dạng "factory": trả về HÀM để test tự tạo dữ liệu theo ý muốn."""

    def _make(**overrides: Any) -> dict[str, Any]:
        payload = {"amount": 50_000, "category": "ăn uống", "spent_on": "2025-03-01"}
        payload.update(overrides)
        response = client.post("/expenses", json=payload)
        assert response.status_code == 201, response.text
        data: dict[str, Any] = response.json()
        return data

    return _make
```

```python
# file: expense-tracker/tests/test_api.py
from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from expense_tracker.config import Settings
from expense_tracker.main import create_app

MakeExpense = Callable[..., dict[str, Any]]


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["environment"] == "test"
    assert "X-Request-ID" in response.headers


def test_create_and_get_expense(client: TestClient) -> None:
    payload = {
        "amount": 45_000,
        "category": "  Ăn   Uống ",
        "note": "Phở bò",
        "spent_on": "2025-03-10",
    }
    created = client.post("/expenses", json=payload)
    assert created.status_code == 201
    body = created.json()
    assert body["id"] > 0
    assert body["category"] == "ăn uống"  # Đã được chuẩn hóa

    fetched = client.get(f"/expenses/{body['id']}")
    assert fetched.status_code == 200
    assert fetched.json() == body


@pytest.mark.parametrize(
    "payload",
    [
        {"amount": 0, "category": "x"},
        {"amount": -5, "category": "x"},
        {"amount": 2_000_000_000, "category": "x"},
        {"amount": 1000, "category": "   "},
        {"amount": 1000},
        {"amount": "abc", "category": "x"},
    ],
    ids=["zero", "negative", "too-large", "blank-category", "missing-category", "not-a-number"],
)
def test_create_invalid_returns_422(client: TestClient, payload: dict[str, Any]) -> None:
    assert client.post("/expenses", json=payload).status_code == 422


def test_get_missing_returns_404(client: TestClient) -> None:
    response = client.get("/expenses/999")
    assert response.status_code == 404
    assert "999" in response.json()["detail"]


def test_list_filters(client: TestClient, make_expense: MakeExpense) -> None:
    make_expense(category="ăn uống", spent_on="2025-03-01")
    make_expense(category="đi lại", spent_on="2025-03-05")
    make_expense(category="ăn uống", spent_on="2025-04-02")

    assert len(client.get("/expenses").json()) == 3
    food = client.get("/expenses", params={"category": "Ăn uống"}).json()
    assert [e["spent_on"] for e in food] == ["2025-04-02", "2025-03-01"]  # Mới nhất trước
    march = client.get("/expenses", params={"date_from": "2025-03-01", "date_to": "2025-03-31"})
    assert len(march.json()) == 2


def test_list_pagination(client: TestClient, make_expense: MakeExpense) -> None:
    for day in range(1, 6):
        make_expense(spent_on=f"2025-03-0{day}")
    page = client.get("/expenses", params={"limit": 2, "offset": 2}).json()
    assert [e["spent_on"] for e in page] == ["2025-03-03", "2025-03-02"]


def test_list_invalid_date_range(client: TestClient) -> None:
    response = client.get("/expenses", params={"date_from": "2025-05-01", "date_to": "2025-01-01"})
    assert response.status_code == 400


def test_update_expense(client: TestClient, make_expense: MakeExpense) -> None:
    expense = make_expense(amount=30_000, note="cũ")
    response = client.patch(f"/expenses/{expense['id']}", json={"amount": 35_000})
    assert response.status_code == 200
    assert response.json()["amount"] == 35_000
    assert response.json()["note"] == "cũ"  # Trường không gửi lên → giữ nguyên


def test_delete_expense(client: TestClient, make_expense: MakeExpense) -> None:
    expense = make_expense()
    assert client.delete(f"/expenses/{expense['id']}").status_code == 204
    assert client.get(f"/expenses/{expense['id']}").status_code == 404
    assert client.delete(f"/expenses/{expense['id']}").status_code == 404


def test_summary(client: TestClient, make_expense: MakeExpense) -> None:
    make_expense(amount=50_000, category="ăn uống")
    make_expense(amount=70_000, category="ăn uống")
    make_expense(amount=200_000, category="mua sắm")
    make_expense(amount=10_000, category="đi lại", spent_on="2024-12-31")

    summary = client.get("/expenses/summary", params={"date_from": "2025-01-01"}).json()
    assert summary["total"] == 320_000
    assert summary["count"] == 3
    assert summary["by_category"][0] == {"category": "mua sắm", "total": 200_000, "count": 1}


def test_write_requires_api_key(settings: Settings) -> None:
    secured = settings.model_copy(update={"api_key": SecretStr("s3cret")})
    with TestClient(create_app(secured)) as client:
        payload = {"amount": 1000, "category": "test"}
        assert client.post("/expenses", json=payload).status_code == 401
        wrong = client.post("/expenses", json=payload, headers={"X-API-Key": "sai"})
        assert wrong.status_code == 401
        ok = client.post("/expenses", json=payload, headers={"X-API-Key": "s3cret"})
        assert ok.status_code == 201
        assert client.get("/expenses").status_code == 200  # Đọc thì không cần key
```

```python
# file: expense-tracker/tests/test_schemas.py
from datetime import date

import pytest
from pydantic import ValidationError

from expense_tracker.schemas import ExpenseCreate, ExpenseUpdate


@pytest.mark.parametrize(
    ("raw", "expected"),
    [("Ăn uống", "ăn uống"), ("  đi   LẠI ", "đi lại"), ("GIẢI TRÍ", "giải trí")],
)
def test_category_is_normalized(raw: str, expected: str) -> None:
    assert ExpenseCreate(amount=1000, category=raw).category == expected


def test_spent_on_defaults_to_today() -> None:
    assert ExpenseCreate(amount=1000, category="x").spent_on == date.today()


def test_update_allows_partial_data() -> None:
    update = ExpenseUpdate(note="mới")
    assert update.model_dump(exclude_unset=True) == {"note": "mới"}


def test_update_rejects_blank_category() -> None:
    with pytest.raises(ValidationError):
        ExpenseUpdate(category="   ")
```

```python
# file: expense-tracker/tests/test_config.py
import pytest
from pydantic import ValidationError

from expense_tracker.config import Settings, get_settings


def test_settings_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EXPENSE_LOG_LEVEL", "DEBUG")
    monkeypatch.setenv("EXPENSE_LOG_JSON", "true")
    monkeypatch.setenv("EXPENSE_API_KEY", "abc")
    get_settings.cache_clear()  # Xóa cache để đọc lại biến môi trường
    settings = get_settings()
    assert settings.log_level == "DEBUG"
    assert settings.log_json is True
    assert settings.api_key is not None
    assert settings.api_key.get_secret_value() == "abc"
    assert "abc" not in repr(settings)  # SecretStr không lộ khi in/log
    get_settings.cache_clear()


def test_invalid_environment_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EXPENSE_ENVIRONMENT", "production")  # Chỉ chấp nhận dev/test/prod
    with pytest.raises(ValidationError):
        Settings(_env_file=None)  # type: ignore[call-arg]
```

```python
# file: expense-tracker/tests/test_logging.py
import json
import logging
import sys

from expense_tracker.logging_config import JsonFormatter


def make_record(**fields: object) -> logging.LogRecord:
    base = {"name": "expense_tracker.test", "levelno": 20, "levelname": "INFO"}
    return logging.makeLogRecord({**base, **fields})


def test_json_formatter_includes_extra_fields() -> None:
    record = make_record(msg="Tạo %s", args=("khoản chi",), request_id="abc123")
    data = json.loads(JsonFormatter().format(record))
    assert data["message"] == "Tạo khoản chi"
    assert data["level"] == "INFO"
    assert data["request_id"] == "abc123"


def test_json_formatter_includes_exception() -> None:
    try:
        1 / 0  # noqa: B018
    except ZeroDivisionError:
        record = make_record(msg="Lỗi", exc_info=sys.exc_info())
    data = json.loads(JsonFormatter().format(record))
    assert "ZeroDivisionError" in data["exception"]
```

### Bước 10: Cài đặt, kiểm tra chất lượng, chạy test

```bash
pip install -e ".[dev]"

ruff check .
# Output: All checks passed!
ruff format --check .
# Output: 16 files already formatted
mypy
# Output: Success: no issues found in 10 source files

pytest --cov
# Output (ví dụ):
# collected 26 items
#
# tests/test_api.py ................                                       [ 61%]
# tests/test_config.py ..                                                  [ 69%]
# tests/test_logging.py ..                                                 [ 76%]
# tests/test_schemas.py ......                                             [100%]
#
# ================================ tests coverage ================================
# _______________ coverage: platform linux, python 3.11.15-final-0 _______________
#
# Name                                    Stmts   Miss Branch BrPart  Cover   Missing
# -----------------------------------------------------------------------------------
# src/expense_tracker/__init__.py             1      0      0      0   100%
# src/expense_tracker/api.py                 52      0      8      0   100%
# src/expense_tracker/config.py              15      0      0      0   100%
# src/expense_tracker/database.py            17      0      0      0   100%
# src/expense_tracker/logging_config.py      15      0      2      0   100%
# src/expense_tracker/main.py                37      0      0      0   100%
# src/expense_tracker/models.py              12      0      0      0   100%
# src/expense_tracker/repository.py          45      0      8      0   100%
# src/expense_tracker/schemas.py             41      0      2      0   100%
# -----------------------------------------------------------------------------------
# TOTAL                                     235      0     20      0   100%
# Required test coverage of 90.0% reached. Total coverage: 100.00%
# ============================== 26 passed in 1.00s ==============================
```

26 test, coverage 100%, không lỗi lint, không lỗi kiểu. 🎉

> 💡 Nếu pytest báo thêm `1 warning` dạng `StarletteDeprecationWarning ... install httpx2 instead` (Starlette bản mới), chạy `pip install httpx2` như đã nói ở mục 6 - đây chỉ là cảnh báo, không ảnh hưởng kết quả test.

### Bước 11: Chạy và thử API

```bash
cp .env.example .env
expense-tracker --reload             # Hoặc: python -m expense_tracker --reload
# Output (ví dụ):
# INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
# 2025-03-15 07:00:00,123 INFO     expense_tracker.main: Khởi động Expense Tracker API (env=dev)
```

Mở **http://127.0.0.1:8000/docs** để thử API trên giao diện Swagger. Hoặc dùng `curl` ở một terminal khác:

```bash
curl -s http://127.0.0.1:8000/health
# Output: {"status":"ok","version":"1.0.0","environment":"dev"}

curl -s -X POST http://127.0.0.1:8000/expenses -H "Content-Type: application/json" \
  -d '{"amount": 45000, "category": "Ăn uống", "note": "Phở bò", "spent_on": "2025-03-10"}'
# Output: {"id":1,"amount":45000,"category":"ăn uống","note":"Phở bò","spent_on":"2025-03-10"}

curl -s -X POST http://127.0.0.1:8000/expenses -H "Content-Type: application/json" \
  -d '{"amount": 250000, "category": "mua sắm", "note": "Áo thun", "spent_on": "2025-03-11"}'
# Output: {"id":2,"amount":250000,"category":"mua sắm","note":"Áo thun","spent_on":"2025-03-11"}

curl -s -X POST http://127.0.0.1:8000/expenses -H "Content-Type: application/json" \
  -d '{"amount": 30000, "category": "ĂN UỐNG", "note": "Cà phê", "spent_on": "2025-03-12"}'
# Output: {"id":3,"amount":30000,"category":"ăn uống","note":"Cà phê","spent_on":"2025-03-12"}

# Tiếng Việt trong URL phải được mã hóa: dùng -G --data-urlencode
curl -s -G http://127.0.0.1:8000/expenses --data-urlencode "category=ăn uống"
# Output: [{"id":3,"amount":30000,"category":"ăn uống","note":"Cà phê","spent_on":"2025-03-12"},{"id":1,"amount":45000,"category":"ăn uống","note":"Phở bò","spent_on":"2025-03-10"}]

curl -s http://127.0.0.1:8000/expenses/summary
# Output: {"total":325000,"count":3,"by_category":[{"category":"mua sắm","total":250000,"count":1},{"category":"ăn uống","total":75000,"count":2}]}

curl -s -X PATCH http://127.0.0.1:8000/expenses/1 -H "Content-Type: application/json" -d '{"amount": 50000}'
# Output: {"id":1,"amount":50000,"category":"ăn uống","note":"Phở bò","spent_on":"2025-03-10"}

curl -s -X POST http://127.0.0.1:8000/expenses -H "Content-Type: application/json" -d '{"amount": -5, "category": "x"}'
# Output: {"detail":[{"type":"greater_than","loc":["body","amount"],"msg":"Input should be greater than 0","input":-5,"ctx":{"gt":0}}]}

curl -s -o /dev/null -w "%{http_code}\n" -X DELETE http://127.0.0.1:8000/expenses/2
# Output: 204
curl -s http://127.0.0.1:8000/expenses/2
# Output: {"detail":"Không tìm thấy khoản chi 2"}
```

Terminal chạy server hiện log của từng request:

```text
2025-03-15 07:00:05,101 INFO     expense_tracker.main: GET /health → 200 (14.4ms)
2025-03-15 07:00:05,119 INFO     expense_tracker.main: POST /expenses → 201 (9.6ms)
...
2025-03-15 07:00:05,193 INFO     expense_tracker.main: POST /expenses → 422 (2.1ms)
2025-03-15 07:00:05,205 INFO     expense_tracker.main: DELETE /expenses/2 → 204 (4.3ms)
```

Thử chế độ production: log JSON và bắt buộc API key:

```bash
EXPENSE_LOG_JSON=true EXPENSE_API_KEY=k123 expense-tracker
# Ở terminal khác:
curl -s -X POST http://127.0.0.1:8000/expenses -H "Content-Type: application/json" -d '{"amount":1000,"category":"x"}'
# Output: {"detail":"API key không hợp lệ"}
curl -s -X POST http://127.0.0.1:8000/expenses -H "X-API-Key: k123" -H "Content-Type: application/json" -d '{"amount":1000,"category":"x"}'
# Output (ví dụ): {"id":4,"amount":1000,"category":"x","note":"","spent_on":"2025-03-15"}
# Log phía server (ví dụ):
# {"time": "2025-03-15T07:10:02+00:00", "level": "INFO", "logger": "expense_tracker.main", "message": "POST /expenses → 401 (1.8ms)", "request_id": "bcedb448", "duration_ms": 1.8}
# {"time": "2025-03-15T07:10:05+00:00", "level": "INFO", "logger": "expense_tracker.main", "message": "POST /expenses → 201 (10.4ms)", "request_id": "29a0cd04", "duration_ms": 10.4}
```

### Bước 12: Docker và CI

1. Tạo `Dockerfile` và `.dockerignore` như **mục 12**, `.github/workflows/ci.yml` như **mục 13**
2. Sinh file lock: `pip install pip-tools && pip-compile pyproject.toml -o requirements.lock`
3. Build và chạy:

```bash
docker build -t expense-tracker:1.0 .
docker run -d --name expense -p 8000:8000 -v expense-data:/app/data \
  -e EXPENSE_API_KEY="doi-thanh-chuoi-bi-mat-dai" expense-tracker:1.0
curl -s http://localhost:8000/health
# Output: {"status":"ok","version":"1.0.0","environment":"prod"}
```

4. Tạo repo GitHub, `git init`, commit (kiểm tra `.env` **không** nằm trong commit!), push → tab **Actions** chạy CI tự động
5. (Tùy chọn) `pre-commit install` với file `.pre-commit-config.yaml` ở mục 5

### Hướng mở rộng capstone

- **PostgreSQL**: `pip install "psycopg[binary]"`, đặt `EXPENSE_DATABASE_URL=postgresql+psycopg://user:pass@host/db`, thêm service `db` trong `compose.yaml`
- **Alembic** để quản lý migration thay cho `create_all` (thêm cột mới mà không mất dữ liệu)
- **Người dùng & đăng nhập**: bảng `users`, mật khẩu băm bằng argon2, JWT (`OAuth2PasswordBearer` của FastAPI) - mỗi người chỉ thấy chi tiêu của mình
- **Ngân sách**: đặt hạn mức theo danh mục/tháng, cảnh báo khi vượt 80%
- **Xuất báo cáo Excel/biểu đồ** theo tháng (kỹ năng [Bài 15](./15-data-processing.md)) qua endpoint `GET /reports/monthly.xlsx`
- **Rate limiting** chống spam (ý tưởng token bucket ở [Bài 14](./14-concurrency-parallelism.md))

## ⚠️ Lỗi thường gặp

### 1. `ModuleNotFoundError` với src layout

Quên `pip install -e .` (hoặc cài vào venv khác). Kiểm tra: `pip show expense-tracker` và `which python` (Windows: `where python`) phải trỏ vào `.venv`.

### 2. Commit file `.env` hoặc mật khẩu lên Git

Thêm `.env` vào `.gitignore` **trước** commit đầu tiên. Nếu lỡ commit: đổi (rotate) mật khẩu/key ngay lập tức - xóa khỏi lịch sử Git thôi là không đủ.

### 3. Test dùng chung database thật

Test chạy trên DB dev/production → xóa nhầm dữ liệu, test phụ thuộc lẫn nhau. Luôn dùng DB tạm (`tmp_path`, `sqlite://` in-memory) và app factory để mỗi test một DB riêng.

### 4. `requirements.txt` không khóa phiên bản

"Máy em chạy được" nhưng CI/Docker cài bản mới hơn → lỗi. Commit **file lock** và cài theo nó khi triển khai.

### 5. Mock sai chỗ

```text
# app.py: from pricing import get_usd_rate
patch("pricing.get_usd_rate")   # ❌ app.get_usd_rate vẫn trỏ tới hàm gốc
patch("app.get_usd_rate")       # ✅ Patch nơi tên được tra cứu
```

### 6. Retry mọi lỗi / retry thao tác không idempotent

Retry lỗi `ValueError` là vô nghĩa; retry lệnh "thanh toán" bị timeout có thể trừ tiền 2 lần. Chỉ retry **lỗi tạm thời** trên thao tác **idempotent**.

### 7. Chạy container bằng root, dùng `print` thay log

Luôn tạo user thường trong Dockerfile (`USER appuser`). Dùng `logging` ra stdout, không dùng `print` - không có mức độ, không có thời gian, không lọc được.

### 8. Tối ưu trước khi đo

Viết lại cả module bằng thread/cache "cho nhanh" mà không profile → phức tạp hơn, không nhanh hơn. **Đo bằng `cProfile` trước**, tối ưu đúng chỗ nghẽn.

### 9. `pydantic-settings` không đọc được biến

Quên tiền tố (`env_prefix="EXPENSE_"` → phải đặt `EXPENSE_API_KEY`, không phải `API_KEY`); file `.env` không nằm ở **thư mục đang chạy lệnh**; hoặc `get_settings()` đã được cache trước khi đổi biến (gọi `get_settings.cache_clear()`).

## 🏋️ Bài tập

### Bài tập 1 (Dễ): Đưa project cũ lên chuẩn

Chuyển project Todo CLI ([Bài 10](./10-final-project.md)) sang **src layout** với `pyproject.toml` đầy đủ, `[project.scripts]` tạo lệnh `todo`, cài bằng `pip install -e ".[dev]"`. Chạy `ruff check`, `ruff format`, `mypy --strict` và sửa hết lỗi.

### Bài tập 2 (Dễ): Settings cho app của bạn

Viết `Settings` (pydantic-settings) cho script báo cáo ở [Bài 15](./15-data-processing.md): SMTP host/port/user/password (`SecretStr`), danh sách người nhận (`list[str]`), thư mục xuất file (`Path`), `DRY_RUN` (`bool`). Viết test dùng `monkeypatch.setenv` kiểm tra đọc đúng và báo lỗi khi thiếu mật khẩu.

### Bài tập 3 (Trung bình): Test với mock

Viết module `weather.py` có hàm `get_forecast(city)` gọi API thời tiết bằng `httpx` và hàm `should_bring_umbrella(city)`. Viết test **không gọi mạng** bằng 3 cách: `httpx.MockTransport`, `unittest.mock.patch`, `monkeypatch.setattr`. Đạt coverage 100%.

### Bài tập 4 (Trung bình): Profiling thực tế

Lấy một script bất kỳ của bạn (hoặc Ứng dụng 2 ở Bài 15 với 100.000 khách hàng). Chạy `cProfile`, tìm 3 hàm tốn thời gian nhất, tối ưu và ghi lại thời gian trước/sau.

### Bài tập 5 (Khó): Mở rộng Expense Tracker

Thêm tính năng **ngân sách**: bảng `budgets` (category, month, limit), endpoint `PUT /budgets/{category}/{month}`, `GET /budgets/{month}/status` trả về đã chi bao nhiêu % mỗi ngân sách. Viết đầy đủ schemas, repository, API, test. Giữ coverage ≥ 90%, ruff và mypy sạch.

### Bài tập 6 (Khó): Docker Compose + PostgreSQL

Viết `compose.yaml` chạy Expense Tracker với **PostgreSQL** (image `postgres:16`), dùng biến môi trường cho mật khẩu DB, volume cho dữ liệu, `depends_on` với healthcheck. Thêm một job CI chạy test với service PostgreSQL (`services:` trong GitHub Actions).

<details>
<summary>💡 Gợi ý Bài tập 6</summary>

```yaml
# compose.yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: expense
      POSTGRES_PASSWORD: ${DB_PASSWORD:?Cần đặt DB_PASSWORD}
      POSTGRES_DB: expense
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U expense"]
      interval: 5s
      retries: 10
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      EXPENSE_DATABASE_URL: postgresql+psycopg://expense:${DB_PASSWORD}@db:5432/expense
      EXPENSE_API_KEY: ${API_KEY:?Cần đặt API_KEY}
    depends_on:
      db:
        condition: service_healthy
volumes:
  pgdata:
```

Nhớ thêm `psycopg[binary]` vào `dependencies` và sinh lại `requirements.lock`.

</details>

## ✅ Checklist hoàn thành

- [ ] Giải thích được sự khác nhau giữa script cá nhân và ứng dụng production
- [ ] Tổ chức project theo src layout, viết `pyproject.toml` đầy đủ, cài bằng `pip install -e ".[dev]"`
- [ ] Tạo file lock bằng pip-tools hoặc uv; hiểu khi nào dùng khoảng phiên bản, khi nào dùng phiên bản chính xác
- [ ] Dùng `ruff check`, `ruff format`, `mypy --strict` và cài `pre-commit`
- [ ] Viết test với fixture (có `yield`), `conftest.py`, `parametrize` + `ids`, `tmp_path`, `monkeypatch`
- [ ] Dùng `Mock`, `patch`, `side_effect`, `assert_called_once_with`; biết "patch nơi tên được tra cứu"
- [ ] Đo coverage và hiểu giới hạn của nó
- [ ] Test API FastAPI bằng `TestClient` và `dependency_overrides` / app factory
- [ ] Cấu hình bằng biến môi trường, `.env`, `pydantic-settings`, `SecretStr`
- [ ] Cấu hình logging bằng `dictConfig`, log JSON có trường `extra`
- [ ] Viết retry có exponential backoff + jitter, chỉ retry lỗi tạm thời
- [ ] Dùng `timeit` và `cProfile` để tìm điểm nghẽn
- [ ] Dùng `secrets`, tham số hóa SQL, không commit bí mật
- [ ] Viết Dockerfile (user thường, cache layer, healthcheck) và workflow GitHub Actions
- [ ] Hoàn thành capstone Expense Tracker: ruff + mypy sạch, test pass, coverage ≥ 90%
- [ ] Hoàn thành ít nhất 2 bài tập mở rộng

## 🗺️ Lộ trình học tiếp

Hoàn thành 16 bài, bạn đã có nền tảng vững chắc. Chọn một (hoặc hai) hướng dưới đây và **xây project thật** trong 2-3 tháng tới:

### 🌐 Web Backend

- **Django** (+ Django REST Framework): framework "đủ pin" - admin, ORM, auth, migration có sẵn. Rất phổ biến ở doanh nghiệp. Bắt đầu với [Django tutorial chính thức](https://docs.djangoproject.com/en/stable/intro/tutorial01/)
- **FastAPI nâng cao**: async SQLAlchemy, background tasks, WebSocket, OAuth2/JWT, Celery/RQ cho tác vụ nền
- **Database**: PostgreSQL, Redis, thiết kế schema, index, Alembic migration
- 📖 Sách: *Architecture Patterns with Python* (Percival & Gregory - đọc miễn phí tại [cosmicpython.com](https://www.cosmicpython.com)), *Two Scoops of Django*

### 📊 Data Science / Machine Learning

- **NumPy, pandas nâng cao, Polars**, trực quan hóa với **seaborn/plotly**, làm việc trong **Jupyter**
- **Thống kê** cơ bản, **scikit-learn** (hồi quy, phân loại, phân cụm), rồi **PyTorch** cho deep learning
- **LLM & AI apps**: gọi API mô hình ngôn ngữ, RAG, agent
- 📖 Sách: *Python for Data Analysis* (Wes McKinney - tác giả pandas, đọc miễn phí tại [wesmckinney.com/book](https://wesmckinney.com/book/)), *Hands-On Machine Learning with Scikit-Learn and PyTorch* (Aurélien Géron)
- 🎓 Khóa học: [fast.ai](https://www.fast.ai), [Kaggle Learn](https://www.kaggle.com/learn)

### ⚙️ DevOps / Automation / Cloud

- **Linux & shell**, **Docker** sâu hơn, **docker compose**, **Kubernetes** cơ bản
- **CI/CD** với GitHub Actions, **Infrastructure as Code** (Terraform, Pulumi - có thể viết bằng Python!), **Ansible**
- Cloud: AWS/GCP/Azure (bắt đầu với một dịch vụ: Lambda/Cloud Run để chạy app Python)
- Giám sát: Prometheus, Grafana, OpenTelemetry

### 🐍 Làm chủ chính ngôn ngữ Python

- 📖 *Fluent Python* (Luciano Ramalho) - cuốn sách hay nhất để hiểu Python "sâu" và "chuẩn"
- 📖 *Effective Python* (Brett Slatkin) - 125 lời khuyên ngắn gọn, thực tế
- 📖 *Python Testing with pytest* (Brian Okken)
- 📖 *Robust Python* (Patrick Viafore) - type hints và thiết kế code dễ bảo trì
- 🌐 [Real Python](https://realpython.com), [docs.python.org](https://docs.python.org/3/), các bài nói chuyện PyCon trên YouTube
- 🤝 **Đóng góp mã nguồn mở**: tìm issue gắn nhãn `good first issue` trên GitHub - cách học nhanh nhất từ những lập trình viên giỏi

> 💡 **Lời khuyên cuối**: Kiến thức chỉ thật sự là của bạn khi bạn **dùng** nó. Hãy chọn một vấn đề **thật** của chính bạn (quản lý chi tiêu gia đình, tự động hóa báo cáo ở công ty, bot nhắc lịch học...) và giải nó bằng Python - từ script nhỏ, đến có test, đến Docker, đến CI. Đưa lên GitHub. Đó chính là portfolio tốt nhất.

## 🚀 Tiếp theo

🎉 **Chúc mừng bạn đã hoàn thành toàn bộ khóa học Python!**

Bạn đã đi từ `print("Xin chào")` đến một API production-ready có kiểm thử tự động, cấu hình chuẩn, logging, Docker và CI - những kỹ năng mà các team phần mềm chuyên nghiệp dùng hằng ngày. Hãy quay lại tổng quan khóa học để ôn tập những phần còn chưa chắc, và bắt đầu project tiếp theo của riêng bạn!

**Quay lại**: [Tổng quan khóa học](./README.md)

---

💡 **Tips nhớ lâu**:

- **src layout + `pyproject.toml` + file lock** = project ai cũng cài được
- **ruff + mypy + pytest chạy trong CI** = không ai phải "tin lời" nhau
- **Cấu hình trong môi trường, bí mật ngoài Git**
- **Log có cấu trúc, ra stdout, không log bí mật**
- **Chỉ retry lỗi tạm thời trên thao tác idempotent**
- **Đo trước, tối ưu sau**
- **App factory + DB tạm** = test nhanh, độc lập, an toàn
