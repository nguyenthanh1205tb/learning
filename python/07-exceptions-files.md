# 📚 Bài 7: Exceptions & Làm việc với File

## 🎯 Mục tiêu bài học

- Hiểu **exception** (ngoại lệ) là gì và cách Python báo lỗi
- Xử lý lỗi với `try` / `except` / `else` / `finally`
- Chủ động báo lỗi với `raise`, tạo **custom exception**
- Hiểu `with` và **context manager** - tại sao luôn dùng `with open(...)`
- Đọc và ghi **file văn bản** với các chế độ `r`, `w`, `a`
- Làm việc với đường dẫn hiện đại bằng **pathlib**
- Đọc/ghi dữ liệu **JSON** và **CSV**
- Hiểu **encoding** và tại sao phải dùng `encoding="utf-8"` với tiếng Việt

## 📖 1. Exception là gì?

### Hai loại lỗi

**1. Syntax Error (lỗi cú pháp)**: code viết sai ngữ pháp, Python **không chạy được dòng nào**:

```text
print("Hello"
# SyntaxError: '(' was never closed
```

**2. Exception (ngoại lệ)**: code đúng cú pháp nhưng **gặp sự cố khi đang chạy**:

```python
numbers = [1, 2, 3]
print("Bắt đầu")
# print(numbers[10])     # IndexError: list index out of range
# print(10 / 0)          # ZeroDivisionError: division by zero
# int("abc")             # ValueError: invalid literal for int() with base 10: 'abc'
print("Nếu bỏ comment các dòng trên, dòng này sẽ không bao giờ chạy")
# Output:
# Bắt đầu
# Nếu bỏ comment các dòng trên, dòng này sẽ không bao giờ chạy
```

> 🧠 **Ví dụ dễ hiểu**: Exception giống **chuông báo cháy** 🚨. Khi có sự cố, chuông reo (exception được "raise"). Nếu không ai xử lý (không có `try/except`), cả tòa nhà phải sơ tán (chương trình dừng). Nếu có đội cứu hỏa (`except`), họ dập lửa và mọi người tiếp tục làm việc.

### Các exception thường gặp

| Exception | Khi nào xảy ra | Ví dụ |
| --- | --- | --- |
| `ValueError` | Giá trị sai (đúng kiểu nhưng không hợp lệ) | `int("abc")` |
| `TypeError` | Sai kiểu dữ liệu | `"a" + 1` |
| `KeyError` | Key không có trong dict | `{}["x"]` |
| `IndexError` | Chỉ số vượt phạm vi | `[1, 2][5]` |
| `ZeroDivisionError` | Chia cho 0 | `1 / 0` |
| `FileNotFoundError` | File không tồn tại | `open("khong_co.txt")` |
| `AttributeError` | Object không có attribute/method | `"abc".push()` |
| `NameError` | Biến chưa được định nghĩa | `print(xyz)` |
| `ImportError` / `ModuleNotFoundError` | Không import được module | `import khong_co` |
| `PermissionError` | Không có quyền truy cập file | Ghi vào thư mục hệ thống |

### Cây phân cấp exception

Exception trong Python cũng là **class** và có quan hệ **kế thừa** ([Bài 6](./06-oop.md)):

```text
BaseException
 ├── SystemExit, KeyboardInterrupt   ← KHÔNG nên bắt những cái này
 └── Exception                       ← Gốc của mọi lỗi "thông thường"
      ├── ArithmeticError
      │    └── ZeroDivisionError
      ├── LookupError
      │    ├── IndexError
      │    └── KeyError
      ├── OSError
      │    ├── FileNotFoundError
      │    └── PermissionError
      ├── ValueError
      └── TypeError
```

```python
print(issubclass(ZeroDivisionError, ArithmeticError))
# Output: True
print(issubclass(KeyError, LookupError))
# Output: True
print(issubclass(FileNotFoundError, OSError))
# Output: True
```

Nhờ vậy, `except LookupError` sẽ bắt được cả `IndexError` lẫn `KeyError`.

## 📖 2. try / except

### Cú pháp cơ bản

```python
try:
    # Code có thể gây lỗi
    result = 10 / 0
    print("Dòng này không chạy")
except ZeroDivisionError:
    # Code xử lý khi có lỗi
    print("Không thể chia cho 0!")

print("Chương trình tiếp tục chạy bình thường")
# Output:
# Không thể chia cho 0!
# Chương trình tiếp tục chạy bình thường
```

Luồng chạy:

1. Python chạy khối `try` từng dòng
2. Nếu **không lỗi** → bỏ qua `except`
3. Nếu **có lỗi** → dừng khối `try` ngay tại dòng lỗi, nhảy tới `except` **khớp loại lỗi**
4. Nếu không có `except` nào khớp → lỗi "bay" ra ngoài, chương trình dừng

### Lấy thông tin lỗi với `as`

```python
try:
    age = int("hai mươi")
except ValueError as error:
    print(f"Loại lỗi: {type(error).__name__}")
    print(f"Chi tiết: {error}")
# Output:
# Loại lỗi: ValueError
# Chi tiết: invalid literal for int() with base 10: 'hai mươi'
```

### Bắt nhiều loại exception

```python
def safe_divide(a, b):
    try:
        return a / b
    except ZeroDivisionError:
        print("❌ Chia cho 0")
    except TypeError:
        print("❌ Phải là số")
    return None


safe_divide(10, 0)
# Output: ❌ Chia cho 0
safe_divide(10, "2")
# Output: ❌ Phải là số
print(safe_divide(10, 4))
# Output: 2.5
```

Gộp nhiều loại lỗi xử lý giống nhau bằng tuple:

```python
def parse_item(data, key):
    try:
        return int(data[key])
    except (KeyError, ValueError) as error:
        print(f"Dữ liệu không hợp lệ: {type(error).__name__}")
        return 0


print(parse_item({"qty": "5"}, "qty"))
# Output: 5
print(parse_item({"qty": "năm"}, "qty"))
# Output:
# Dữ liệu không hợp lệ: ValueError
# 0
print(parse_item({}, "qty"))
# Output:
# Dữ liệu không hợp lệ: KeyError
# 0
```

> ⚠️ **Thứ tự `except` quan trọng**: đặt exception **cụ thể trước**, **tổng quát sau**. Nếu `except Exception` đứng đầu, nó sẽ "nuốt" mọi lỗi và các `except` bên dưới không bao giờ chạy.

### Ví dụ thực tế: Nhập số an toàn

```python
def ask_number(prompt: str) -> int:
    while True:
        text = input(prompt)
        try:
            return int(text)
        except ValueError:
            print(f"❌ '{text}' không phải số nguyên. Nhập lại!")


age = ask_number("Nhập tuổi: ")
print(f"Tuổi: {age}")
```

```text
Nhập tuổi: hai mươi
❌ 'hai mươi' không phải số nguyên. Nhập lại!
Nhập tuổi: 20
Tuổi: 20
```

### ❌ Đừng bao giờ dùng "bare except"

```python
# ❌ TỆ: bắt MỌI THỨ, kể cả Ctrl+C (KeyboardInterrupt) và lỗi gõ nhầm tên biến
try:
    reslt = 10 / 2
    print(result)               # Gõ nhầm tên biến → NameError
except:
    print("Có lỗi gì đó...")    # Che giấu lỗi thật → cực khó debug!
# Output: Có lỗi gì đó...
```

> ✅ **Quy tắc vàng**: Chỉ bắt những exception **bạn biết cách xử lý**. Bắt càng cụ thể càng tốt. Nếu thật sự cần bắt tổng quát, dùng `except Exception as error:` và **luôn log/in lỗi ra**.

## 📖 3. else và finally

### Cấu trúc đầy đủ

```python
try:
    ...     # Code có thể lỗi
except ValueError:
    ...     # Chạy khi CÓ lỗi ValueError
else:
    ...     # Chạy khi KHÔNG có lỗi nào
finally:
    ...     # LUÔN LUÔN chạy, dù có lỗi hay không
```

```python
def convert(text):
    print(f"--- Chuyển đổi {text!r} ---")
    try:
        number = int(text)
    except ValueError:
        print("❌ Thất bại")
    else:
        print(f"✅ Thành công: {number}")      # Chỉ chạy khi try không lỗi
    finally:
        print("🧹 Dọn dẹp (luôn chạy)")


convert("42")
# Output:
# --- Chuyển đổi '42' ---
# ✅ Thành công: 42
# 🧹 Dọn dẹp (luôn chạy)
convert("abc")
# Output:
# --- Chuyển đổi 'abc' ---
# ❌ Thất bại
# 🧹 Dọn dẹp (luôn chạy)
```

### Tại sao cần `else`? Sao không viết luôn vào `try`?

Để **khối `try` càng nhỏ càng tốt** - chỉ chứa đúng dòng có thể gây lỗi bạn muốn bắt. Nếu nhét thêm code vào `try`, bạn có thể **vô tình bắt nhầm** lỗi từ code khác.

### Tại sao cần `finally`?

`finally` dùng để **giải phóng tài nguyên** (đóng file, đóng kết nối database, tắt khóa...) - **chạy kể cả khi có `return` hoặc lỗi không được bắt**:

```python
def risky():
    try:
        print("Mở kết nối")
        return "kết quả"          # Có return...
    finally:
        print("Đóng kết nối")    # ...finally VẪN chạy trước khi hàm thoát


print(risky())
# Output:
# Mở kết nối
# Đóng kết nối
# kết quả
```

> 🧠 **Ví dụ dễ hiểu**: `finally` giống **tắt bếp trước khi ra khỏi nhà**. Dù bạn đi chơi vui vẻ (thành công) hay đi cấp cứu (lỗi), bạn **luôn** phải tắt bếp.

## 📖 4. raise - Chủ động báo lỗi

### Khi nào cần raise?

Khi hàm nhận dữ liệu **không hợp lệ** và **không thể tiếp tục** một cách có ý nghĩa, hãy **báo lỗi rõ ràng** thay vì trả về giá trị sai lặng lẽ:

```python
def set_age(age: int) -> int:
    if not isinstance(age, int):
        raise TypeError(f"Tuổi phải là số nguyên, nhận được {type(age).__name__}")
    if age < 0 or age > 150:
        raise ValueError(f"Tuổi không hợp lệ: {age}")
    return age


for value in [25, -5, "20"]:
    try:
        print("OK:", set_age(value))
    except (TypeError, ValueError) as error:
        print(f"{type(error).__name__}: {error}")
# Output:
# OK: 25
# ValueError: Tuổi không hợp lệ: -5
# TypeError: Tuổi phải là số nguyên, nhận được str
```

> 💡 **Fail fast** (thất bại sớm): Phát hiện lỗi càng sớm, càng gần nơi gây ra lỗi → càng dễ sửa. Trả về `None` hoặc `-1` âm thầm thường khiến lỗi xuất hiện ở một nơi xa và khó hiểu.

### Re-raise: bắt, xử lý một phần, rồi ném tiếp

```python
def load_config():
    try:
        return {"debug": True}["port"]
    except KeyError:
        print("📝 Ghi log: thiếu cấu hình port")
        raise                       # Ném lại CHÍNH lỗi đó cho tầng trên xử lý


try:
    load_config()
except KeyError as error:
    print("Tầng trên nhận được lỗi:", repr(error))
# Output:
# 📝 Ghi log: thiếu cấu hình port
# Tầng trên nhận được lỗi: KeyError('port')
```

### Exception chaining: raise ... from ...

Chuyển đổi lỗi "cấp thấp" thành lỗi "có ý nghĩa nghiệp vụ", nhưng vẫn giữ nguyên nhân gốc:

```python
class ConfigError(Exception):
    pass


def read_port(config: dict) -> int:
    try:
        return int(config["port"])
    except (KeyError, ValueError) as error:
        raise ConfigError("Cấu hình port không hợp lệ") from error


try:
    read_port({"port": "abc"})
except ConfigError as error:
    print(error)
    print("Nguyên nhân gốc:", repr(error.__cause__))
# Output:
# Cấu hình port không hợp lệ
# Nguyên nhân gốc: ValueError("invalid literal for int() with base 10: 'abc'")
```

## 📖 5. Custom Exceptions

### Tại sao tự tạo exception?

- **Rõ nghĩa hơn**: `InsufficientFundsError` dễ hiểu hơn `ValueError`
- **Bắt chính xác**: người dùng code của bạn có thể bắt riêng lỗi nghiệp vụ
- **Mang thêm dữ liệu**: số dư hiện tại, số tiền thiếu...

### Tạo custom exception

Chỉ cần kế thừa từ `Exception` (hoặc một exception con phù hợp):

```python
class BankError(Exception):
    """Lỗi gốc cho mọi lỗi của hệ thống ngân hàng."""


class InsufficientFundsError(BankError):
    def __init__(self, balance: int, amount: int):
        self.balance = balance
        self.amount = amount
        self.shortage = amount - balance
        super().__init__(f"Số dư {balance:,}đ không đủ để rút {amount:,}đ (thiếu {self.shortage:,}đ)")


class AccountLockedError(BankError):
    pass


class Account:
    def __init__(self, balance: int, locked: bool = False):
        self.balance = balance
        self.locked = locked

    def withdraw(self, amount: int) -> None:
        if self.locked:
            raise AccountLockedError("Tài khoản đang bị khóa")
        if amount > self.balance:
            raise InsufficientFundsError(self.balance, amount)
        self.balance -= amount


acc = Account(500_000)
try:
    acc.withdraw(800_000)
except InsufficientFundsError as error:
    print("❌", error)
    print("Cần nạp thêm:", f"{error.shortage:,}đ")
# Output:
# ❌ Số dư 500,000đ không đủ để rút 800,000đ (thiếu 300,000đ)
# Cần nạp thêm: 300,000đ

# Bắt tất cả lỗi ngân hàng bằng class cha
for account in [Account(0, locked=True), Account(100)]:
    try:
        account.withdraw(1_000)
    except BankError as error:
        print(f"[{type(error).__name__}] {error}")
# Output:
# [AccountLockedError] Tài khoản đang bị khóa
# [InsufficientFundsError] Số dư 100đ không đủ để rút 1,000đ (thiếu 900đ)
```

> 💡 **Quy ước**: Tên exception kết thúc bằng `Error`. Với thư viện/ứng dụng lớn, tạo **một exception gốc** (như `BankError`) rồi cho các lỗi cụ thể kế thừa từ nó.

### EAFP vs LBYL

Hai triết lý xử lý lỗi:

```python
data = {"name": "An"}

# LBYL - Look Before You Leap (Nhìn trước khi nhảy): kiểm tra trước
if "age" in data:
    age = data["age"]
else:
    age = 0

# EAFP - Easier to Ask Forgiveness than Permission (Xin lỗi dễ hơn xin phép): cứ làm, lỗi thì xử lý
try:
    age = data["age"]
except KeyError:
    age = 0

print(age)
# Output: 0
```

Python thường ưa chuộng **EAFP** - đặc biệt với file (file có thể bị xóa **giữa lúc** bạn kiểm tra và lúc bạn mở).

## 📖 6. Context Manager và câu lệnh `with`

### Vấn đề: quên đóng tài nguyên

```python
f = open("demo.txt", "w", encoding="utf-8")
f.write("Hello")
# Nếu có lỗi ở đây → f.close() không bao giờ được gọi!
f.close()
```

Không đóng file có thể gây: **mất dữ liệu** (dữ liệu còn trong bộ đệm chưa ghi xuống đĩa), **rò rỉ tài nguyên**, **file bị khóa** (trên Windows).

Cách an toàn với `try/finally` - nhưng dài dòng:

```python
f = open("demo.txt", "w", encoding="utf-8")
try:
    f.write("Hello")
finally:
    f.close()
```

### Giải pháp: `with`

```python
with open("demo.txt", "w", encoding="utf-8") as f:
    f.write("Hello, with!")
# Ra khỏi khối with → file TỰ ĐỘNG đóng, kể cả khi có lỗi

print(f.closed)
# Output: True
```

> 🧠 **Ví dụ dễ hiểu**: `with` giống **cửa tự động đóng** 🚪. Bạn đi vào phòng, làm việc, đi ra - cửa tự đóng sau lưng, dù bạn bước ra bình thường hay chạy ra vì có cháy.

**Context manager** là object biết cách **"vào"** (`__enter__`) và **"ra"** (`__exit__`). Ngoài file, nhiều thứ khác cũng là context manager: kết nối database, khóa (lock) trong đa luồng, `decimal.localcontext()`... Bạn sẽ tự viết context manager ở [Bài 9](./09-advanced-python.md).

## 📖 7. Đọc và ghi file văn bản

### Các chế độ mở file

| Chế độ | Ý nghĩa | File chưa có | File đã có |
| --- | --- | --- | --- |
| `"r"` | Đọc (mặc định) | ❌ Lỗi | Đọc từ đầu |
| `"w"` | Ghi | Tạo mới | ⚠️ **XÓA SẠCH** nội dung cũ |
| `"a"` | Ghi thêm (append) | Tạo mới | Ghi tiếp vào cuối |
| `"x"` | Tạo mới độc quyền | Tạo mới | ❌ Lỗi `FileExistsError` |
| `"r+"` | Đọc + ghi | ❌ Lỗi | Không xóa |
| thêm `"b"` | Chế độ nhị phân (`"rb"`, `"wb"`) | | Dùng cho ảnh, file zip... |

### Ghi file

```python
# "w": tạo mới hoặc GHI ĐÈ
with open("notes.txt", "w", encoding="utf-8") as f:
    f.write("Dòng 1: Học Python\n")         # write() KHÔNG tự thêm \n
    f.write("Dòng 2: Làm bài tập\n")
    f.writelines(["Dòng 3: Ôn tập\n", "Dòng 4: Nghỉ ngơi\n"])

# "a": ghi thêm vào cuối
with open("notes.txt", "a", encoding="utf-8") as f:
    f.write("Dòng 5: Được thêm vào sau\n")
    print("Dòng 6: print cũng ghi được vào file!", file=f)

print("Đã ghi xong")
# Output: Đã ghi xong
```

### Đọc file

```python
# Chuẩn bị file mẫu
with open("poem.txt", "w", encoding="utf-8") as f:
    f.write("Trăm năm trong cõi người ta\nChữ tài chữ mệnh khéo là ghét nhau\nTrải qua một cuộc bể dâu\n")

# Cách 1: read() - đọc TOÀN BỘ thành một chuỗi
with open("poem.txt", encoding="utf-8") as f:       # "r" là mặc định
    content = f.read()
print(len(content.splitlines()))
# Output: 3

# Cách 2: duyệt từng dòng - TIẾT KIỆM BỘ NHỚ, tốt nhất cho file lớn
with open("poem.txt", encoding="utf-8") as f:
    for line_number, line in enumerate(f, start=1):
        print(f"{line_number}: {line.rstrip()}")    # rstrip() bỏ \n ở cuối
# Output:
# 1: Trăm năm trong cõi người ta
# 2: Chữ tài chữ mệnh khéo là ghét nhau
# 3: Trải qua một cuộc bể dâu

# Cách 3: readlines() - list các dòng (vẫn còn \n)
with open("poem.txt", encoding="utf-8") as f:
    lines = f.readlines()
print(lines[0])
# Output: Trăm năm trong cõi người ta
print(repr(lines[0]))
# Output: 'Trăm năm trong cõi người ta\n'

# readline() - đọc từng dòng một
with open("poem.txt", encoding="utf-8") as f:
    first = f.readline().strip()
    second = f.readline().strip()
print(second)
# Output: Chữ tài chữ mệnh khéo là ghét nhau
```

> 💡 Khi duyệt `for line in f`, Python chỉ đọc **một dòng mỗi lần** vào bộ nhớ → đọc được cả file log vài GB. Còn `f.read()` nạp **toàn bộ** file vào RAM.

### Ví dụ: Đếm từ trong file

```python
from collections import Counter

with open("poem.txt", encoding="utf-8") as f:
    words = f.read().lower().split()

print(f"Tổng số từ: {len(words)}")
print(Counter(words).most_common(1))
# Output:
# Tổng số từ: 20
# [('chữ', 2)]
```

## 📖 8. Encoding - Tại sao phải dùng UTF-8?

### Vấn đề với tiếng Việt

Máy tính chỉ lưu **số** (byte). **Encoding** là "bảng quy đổi" giữa ký tự và byte. Có nhiều bảng quy đổi khác nhau:

- **UTF-8**: chuẩn quốc tế, hỗ trợ **mọi ngôn ngữ** và emoji - chuẩn của web, Linux, macOS
- **cp1252**, **cp1258**...: bảng mã cũ của Windows, **không đầy đủ** tiếng Việt

```python
text = "Tiếng Việt"
data = text.encode("utf-8")         # str → bytes
print(data)
# Output: b'Ti\xe1\xba\xbfng Vi\xe1\xbb\x87t'
print(len(text), len(data))         # "ế" chiếm 3 byte trong UTF-8
# Output: 10 14
print(data.decode("utf-8"))         # bytes → str
# Output: Tiếng Việt

# Đọc bằng sai encoding (cp1252 của Windows) → chữ "lỗi font" (mojibake)
print(data.decode("cp1252"))
# Output: Tiáº¿ng Viá»‡t
```

### ⚠️ Mặc định của `open()` phụ thuộc hệ điều hành!

Nếu không truyền `encoding`, `open()` dùng encoding mặc định **của hệ điều hành**: Linux/macOS thường là UTF-8, nhưng **Windows thường là một bảng mã cũ** (cp1252, cp1258... tùy ngôn ngữ hệ thống) → khi đọc/ghi tiếng Việt sẽ gặp:

```text
UnicodeEncodeError: 'charmap' codec can't encode character '\u1ebf' in position 3
UnicodeDecodeError: 'charmap' codec can't decode byte 0x81 in position 12
```

> ✅ **Quy tắc**: **LUÔN** viết `encoding="utf-8"` khi mở file văn bản. Code của bạn sẽ chạy giống nhau trên mọi máy.

### File có BOM (từ Excel/Notepad)

Một số phần mềm Windows (như Excel khi "Save as CSV UTF-8") thêm 3 byte đặc biệt **BOM** ở đầu file. Dùng `encoding="utf-8-sig"` để tự bỏ BOM khi đọc:

```python
with open("bom.txt", "w", encoding="utf-8-sig") as f:   # Ghi có BOM
    f.write("tên,tuổi")

with open("bom.txt", encoding="utf-8") as f:
    print(repr(f.read()[:4]))           # Ký tự lạ \ufeff ở đầu
# Output: '\ufefftên'

with open("bom.txt", encoding="utf-8-sig") as f:
    print(repr(f.read()[:3]))           # ✅ Đã bỏ BOM
# Output: 'tên'
```

## 📖 9. pathlib - Làm việc với đường dẫn

### Tại sao dùng pathlib?

Đường dẫn trên Windows dùng `\` (`C:\Users\an\file.txt`), macOS/Linux dùng `/` (`/home/an/file.txt`). Ghép chuỗi bằng tay rất dễ sai. `pathlib` (Python 3.4+) xử lý mọi thứ cho bạn bằng các **object Path**.

```python
from pathlib import Path

# Tạo đường dẫn - dùng toán tử / để nối (chạy đúng trên MỌI hệ điều hành)
base = Path("data")
file_path = base / "reports" / "2026" / "summary.txt"
print(file_path.as_posix())                 # as_posix(): hiển thị bằng dấu /
# Output: data/reports/2026/summary.txt

# Các thành phần của đường dẫn
print(file_path.name)       # Tên file đầy đủ
# Output: summary.txt
print(file_path.stem)       # Tên không có đuôi
# Output: summary
print(file_path.suffix)     # Đuôi file
# Output: .txt
print(file_path.parent.as_posix())   # Thư mục cha
# Output: data/reports/2026
print(file_path.with_suffix(".csv").name)   # Đổi đuôi
# Output: summary.csv

print(Path.cwd().is_absolute())             # Thư mục làm việc hiện tại
# Output: True
print(Path.home().exists())                 # Thư mục home của người dùng
# Output: True
```

### Kiểm tra, tạo, đọc, ghi

```python
from pathlib import Path

folder = Path("demo_folder")
folder.mkdir(exist_ok=True)                 # Tạo thư mục (không lỗi nếu đã có)
(folder / "sub" / "deep").mkdir(parents=True, exist_ok=True)   # Tạo cả cây

note = folder / "note.txt"
note.write_text("Xin chào pathlib!\n", encoding="utf-8")       # Ghi nhanh (mode "w")
print(note.read_text(encoding="utf-8").strip())                 # Đọc nhanh
# Output: Xin chào pathlib!

print(note.exists(), note.is_file(), folder.is_dir())
# Output: True True True
print(note.stat().st_size, "bytes")
# Output: 19 bytes

# Path cũng dùng được với open()
with note.open("a", encoding="utf-8") as f:
    f.write("Dòng thêm\n")
print(len(note.read_text(encoding="utf-8").splitlines()))
# Output: 2
```

### Duyệt thư mục

```python
from pathlib import Path

project = Path("my_project")
for name in ["main.py", "utils.py", "README.md", "src/app.py", "src/models/user.py"]:
    path = project / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("# demo\n", encoding="utf-8")

# iterdir(): liệt kê con trực tiếp
print(sorted(p.name for p in project.iterdir()))
# Output: ['README.md', 'main.py', 'src', 'utils.py']

# glob(): tìm theo mẫu ở thư mục hiện tại
print(sorted(p.name for p in project.glob("*.py")))
# Output: ['main.py', 'utils.py']

# rglob(): tìm ĐỆ QUY trong mọi thư mục con
print(sorted(p.relative_to(project).as_posix() for p in project.rglob("*.py")))
# Output: ['main.py', 'src/app.py', 'src/models/user.py', 'utils.py']
```

### Đổi tên, xóa

```python
from pathlib import Path

old = Path("old_name.txt")
old.write_text("data", encoding="utf-8")
new = old.rename("new_name.txt")        # Đổi tên / di chuyển
print(old.exists(), new.exists())
# Output: False True

new.unlink()                            # Xóa file
new.unlink(missing_ok=True)             # Không lỗi nếu file đã không còn (3.8+)

empty_dir = Path("empty_dir")
empty_dir.mkdir(exist_ok=True)
empty_dir.rmdir()                       # Xóa thư mục RỖNG
# Xóa thư mục có nội dung: import shutil; shutil.rmtree(path)  ⚠️ cẩn thận!
print(empty_dir.exists())
# Output: False
```

### Đường dẫn tương đối và `__file__`

⚠️ Đường dẫn tương đối (`"data.txt"`) được tính từ **thư mục làm việc hiện tại** (nơi bạn gõ lệnh `python`), **không phải** thư mục chứa file `.py`. Để luôn tìm đúng file nằm cạnh script:

```python
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent     # Thư mục chứa file .py này
DATA_FILE = SCRIPT_DIR / "data.txt"
print(DATA_FILE.name)
# Output: data.txt
```

## 📖 10. JSON

### JSON là gì?

**JSON** (JavaScript Object Notation) là định dạng văn bản phổ biến nhất để **lưu trữ và trao đổi dữ liệu** (API web, file cấu hình...). Nó trông gần giống dict/list của Python:

```json
{
  "name": "An",
  "age": 25,
  "skills": ["Python", "SQL"],
  "is_active": true,
  "manager": null
}
```

| JSON | Python |
| --- | --- |
| object `{}` | `dict` |
| array `[]` | `list` |
| string `"..."` | `str` |
| number | `int` / `float` |
| `true` / `false` | `True` / `False` |
| `null` | `None` |

### Chuyển đổi giữa Python và chuỗi JSON

```python
import json

user = {"name": "Ánh", "age": 25, "skills": ["Python", "SQL"], "is_active": True, "manager": None}

# dumps: Python → chuỗi JSON ("dump string")
text = json.dumps(user)
print(text)
# Output: {"name": "\u00c1nh", "age": 25, "skills": ["Python", "SQL"], "is_active": true, "manager": null}

# ensure_ascii=False: giữ nguyên tiếng Việt; indent: format đẹp
print(json.dumps(user, ensure_ascii=False, indent=2))
# Output:
# {
#   "name": "Ánh",
#   "age": 25,
#   "skills": [
#     "Python",
#     "SQL"
#   ],
#   "is_active": true,
#   "manager": null
# }

# loads: chuỗi JSON → Python ("load string")
data = json.loads('{"x": 1, "ok": false, "items": [1, 2]}')
print(data, type(data))
# Output: {'x': 1, 'ok': False, 'items': [1, 2]} <class 'dict'>
```

> 🧠 **Mẹo nhớ**: hàm có chữ **`s`** (`dumps`, `loads`) làm việc với **s**tring. Không có `s` (`dump`, `load`) làm việc với **file**.

### Đọc/ghi file JSON

```python
import json
from pathlib import Path

todos = [
    {"id": 1, "title": "Học Python", "done": True},
    {"id": 2, "title": "Làm bài tập JSON", "done": False},
]

path = Path("todos.json")

# Ghi file JSON
with path.open("w", encoding="utf-8") as f:
    json.dump(todos, f, ensure_ascii=False, indent=2)

# Đọc file JSON
with path.open(encoding="utf-8") as f:
    loaded = json.load(f)

for todo in loaded:
    mark = "✅" if todo["done"] else "⬜"
    print(f"{mark} {todo['id']}. {todo['title']}")
# Output:
# ✅ 1. Học Python
# ⬜ 2. Làm bài tập JSON

# Cách ngắn gọn với pathlib
path.write_text(json.dumps(loaded, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.loads(path.read_text(encoding="utf-8")) == todos)
# Output: True
```

### Xử lý lỗi khi đọc JSON

```python
import json
from pathlib import Path


def load_json(path: Path, default=None):
    """Đọc file JSON an toàn: trả về default nếu file không có hoặc hỏng."""
    try:
        with path.open(encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"⚠️ Không tìm thấy {path}, dùng giá trị mặc định")
        return default
    except json.JSONDecodeError as error:
        print(f"❌ File JSON hỏng: dòng {error.lineno}, cột {error.colno}")
        return default


Path("broken.json").write_text('{"name": "An",}', encoding="utf-8")   # Dấu phẩy thừa

print(load_json(Path("missing.json"), default=[]))
# Output:
# ⚠️ Không tìm thấy missing.json, dùng giá trị mặc định
# []
print(load_json(Path("broken.json"), default={}))
# Output:
# ❌ File JSON hỏng: dòng 1, cột 15
# {}
```

### Lưu object tự định nghĩa

JSON không biết cách lưu object của class bạn tạo. Với **dataclass**, dùng `asdict()`:

```python
import json
from dataclasses import dataclass, asdict


@dataclass
class Task:
    title: str
    done: bool = False


tasks = [Task("Viết code"), Task("Test", done=True)]

text = json.dumps([asdict(t) for t in tasks], ensure_ascii=False)   # Object → dict → JSON
print(text)
# Output: [{"title": "Viết code", "done": false}, {"title": "Test", "done": true}]

restored = [Task(**item) for item in json.loads(text)]              # JSON → dict → Object
print(restored)
# Output: [Task(title='Viết code', done=False), Task(title='Test', done=True)]
```

Bạn sẽ dùng chính kỹ thuật này trong [dự án Todo CLI ở Bài 10](./10-final-project.md)!

## 📖 11. CSV

### CSV là gì?

**CSV** (Comma-Separated Values) là file bảng tính dạng văn bản, mỗi dòng là một hàng, các cột ngăn cách bởi dấu phẩy. Mở được bằng Excel/Google Sheets.

```text
name,math,physics
An,8.5,7
Bình,9,8.5
```

> ⚠️ Đừng tự `split(",")` - dữ liệu có thể chứa dấu phẩy trong ngoặc kép (`"Nguyễn, An"`). Hãy dùng module `csv`.

### Ghi và đọc CSV với csv.writer / csv.reader

```python
import csv

rows = [
    ["name", "city", "score"],
    ["An", "Hà Nội", 8.5],
    ["Bình", "Huế, Việt Nam", 9],       # Có dấu phẩy trong dữ liệu
]

# newline="" là BẮT BUỘC khi ghi CSV (tránh dòng trống thừa trên Windows)
with open("students.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerows(rows)

with open("students.csv", encoding="utf-8") as f:
    print(f.read())
# Output:
# name,city,score
# An,Hà Nội,8.5
# Bình,"Huế, Việt Nam",9

with open("students.csv", newline="", encoding="utf-8") as f:
    reader = csv.reader(f)
    header = next(reader)                # Đọc dòng tiêu đề
    for row in reader:
        print(row)                       # ⚠️ Mọi giá trị đều là CHUỖI
# Output:
# ['An', 'Hà Nội', '8.5']
# ['Bình', 'Huế, Việt Nam', '9']
```

### DictReader / DictWriter - Làm việc bằng tên cột (khuyến khích)

```python
import csv

products = [
    {"name": "Bút bi", "price": 5000, "qty": 100},
    {"name": "Vở 200 trang", "price": 18000, "qty": 50},
    {"name": "Thước kẻ", "price": 7000, "qty": 0},
]

with open("products.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=["name", "price", "qty"])
    writer.writeheader()
    writer.writerows(products)

total_value = 0
with open("products.csv", newline="", encoding="utf-8") as f:
    for row in csv.DictReader(f):                    # Mỗi hàng là một dict
        price, qty = int(row["price"]), int(row["qty"])   # Nhớ ép kiểu!
        total_value += price * qty
        status = "Còn hàng" if qty > 0 else "Hết hàng"
        print(f"{row['name']:<14}{price:>8,}đ  x{qty:<4}{status}")
print(f"Tổng giá trị kho: {total_value:,}đ")
# Output:
# Bút bi           5,000đ  x100 Còn hàng
# Vở 200 trang    18,000đ  x50  Còn hàng
# Thước kẻ         7,000đ  x0   Hết hàng
# Tổng giá trị kho: 1,400,000đ
```

> 💡 Muốn Excel trên Windows mở file CSV tiếng Việt không bị lỗi font, hãy ghi với `encoding="utf-8-sig"`.

## 🌍 Ứng dụng thực tế

Dữ liệu thực tế **luôn có lỗi**: file thiếu, dòng hỏng, người dùng gõ nhầm. Chương trình tốt không "chết" vì một dòng sai, mà **ghi nhận lỗi, bỏ qua và báo cáo rõ ràng**.

### 1. Đọc bảng điểm CSV → báo cáo JSON

Giáo viên xuất bảng điểm từ Excel/Google Sheets ra CSV; script đọc, kiểm tra từng dòng, rồi xuất báo cáo JSON cho hệ thống khác dùng:

```python
# grades_report.py - Đọc bảng điểm CSV (xuất từ Excel/Google Sheets) → báo cáo JSON theo lớp
import csv
import json
from pathlib import Path


class InvalidRowError(ValueError):
    """Một dòng trong file CSV có dữ liệu sai."""


# Tạo file CSV mẫu - dữ liệu thật thường có dòng lỗi như thế này
Path("grades.csv").write_text(
    "student_id,name,class,score\n"
    "HS01,Nguyễn An,10A1,8.5\n"
    "HS02,Trần Bình,10A1,\n"          # Thiếu điểm
    "HS03,Lê Chi,10A2,9.25\n"
    "HS04,Phạm Dũng,10A1,abc\n"       # Điểm không phải số
    "HS05,Võ Em,10A2,4.5\n"
    "HS06,Đỗ Giang,10A2,11\n"         # Điểm ngoài thang 0-10
    "HS07,Hồ Hà,10A1,6\n",
    encoding="utf-8",
)


def parse_row(row: dict) -> dict:
    """Kiểm tra & chuyển kiểu một dòng. Sai thì raise InvalidRowError."""
    raw = row["score"].strip()
    if not raw:
        raise InvalidRowError("thiếu điểm")
    try:
        score = float(raw)
    except ValueError as error:
        raise InvalidRowError(f"điểm '{raw}' không phải số") from error
    if not 0 <= score <= 10:
        raise InvalidRowError(f"điểm {score} ngoài thang 0-10")
    return {"id": row["student_id"], "name": row["name"], "class": row["class"], "score": score}


classes: dict[str, list[dict]] = {}
errors = []
with open("grades.csv", newline="", encoding="utf-8-sig") as f:   # utf-8-sig: an toàn với BOM từ Excel
    # start=2 vì dòng 1 là tiêu đề → số dòng khớp khi mở file bằng Excel
    for line_no, row in enumerate(csv.DictReader(f), start=2):
        try:
            student = parse_row(row)
        except InvalidRowError as error:
            errors.append({"line": line_no, "id": row["student_id"], "error": str(error)})
            continue
        classes.setdefault(student["class"], []).append(student)

report = {
    "classes": {
        name: {
            "count": len(students),
            "average": round(sum(s["score"] for s in students) / len(students), 2),
            "top": max(students, key=lambda s: s["score"])["name"],
            "failed": [s["name"] for s in students if s["score"] < 5],
        }
        for name, students in sorted(classes.items())
    },
    "errors": errors,
}
Path("report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

print(f"Đã xử lý {sum(len(s) for s in classes.values())} dòng hợp lệ, {len(errors)} dòng lỗi")
for err in errors:
    print(f"  ⚠️ Dòng {err['line']} ({err['id']}): {err['error']}")
saved = json.loads(Path("report.json").read_text(encoding="utf-8"))   # Đọc lại để kiểm tra
for name, info in saved["classes"].items():
    print(f"📊 {name}: {info}")

# Output:
# Đã xử lý 4 dòng hợp lệ, 3 dòng lỗi
#   ⚠️ Dòng 3 (HS02): thiếu điểm
#   ⚠️ Dòng 5 (HS04): điểm 'abc' không phải số
#   ⚠️ Dòng 7 (HS06): điểm 11.0 ngoài thang 0-10
# 📊 10A1: {'count': 2, 'average': 7.25, 'top': 'Nguyễn An', 'failed': []}
# 📊 10A2: {'count': 2, 'average': 6.88, 'top': 'Lê Chi', 'failed': ['Võ Em']}
```

> 💡 **Mẫu "collect errors"**: thay vì dừng ở dòng lỗi đầu tiên, ta gom tất cả lỗi kèm **số dòng** - người dùng sửa một lần là xong, không phải chạy đi chạy lại. Encoding `utf-8-sig` đọc được cả file có BOM do Excel tạo ra (xem phần 8).

### 2. Đọc file cấu hình an toàn

Gần như ứng dụng nào cũng có file cấu hình. Hàm `load_config` dưới đây xử lý đủ các tình huống: chưa có file, JSON sai cú pháp, sai kiểu dữ liệu, gõ nhầm tên khóa:

```python
# config_loader.py - Đọc file cấu hình JSON an toàn: thiếu file, hỏng file, sai giá trị
import json
from pathlib import Path

DEFAULT_CONFIG = {"app_name": "Shop Online", "port": 8000, "debug": False, "currency": "VND"}


class ConfigError(Exception):
    """Lỗi cấu hình - thông báo rõ ràng cho người vận hành."""


def load_config(path: Path) -> dict:
    try:
        with open(path, encoding="utf-8") as f:
            user_config = json.load(f)
    except FileNotFoundError:
        # Lần chạy đầu tiên: tạo file mẫu để người dùng chỉnh sửa, rồi dùng cấu hình mặc định
        path.write_text(json.dumps(DEFAULT_CONFIG, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"ℹ️  Chưa có {path.name}, đã tạo file mặc định")
        return dict(DEFAULT_CONFIG)
    except json.JSONDecodeError as error:
        raise ConfigError(f"{path.name} sai cú pháp JSON ở dòng {error.lineno}, cột {error.colno}") from error

    if not isinstance(user_config, dict):
        raise ConfigError(f"{path.name} phải là một object JSON {{...}}")
    unknown = set(user_config) - set(DEFAULT_CONFIG)
    if unknown:
        raise ConfigError(f"Khóa không hợp lệ: {sorted(unknown)} (gõ nhầm tên?)")

    config = {**DEFAULT_CONFIG, **user_config}        # Giá trị của người dùng ghi đè mặc định
    port = config["port"]
    if not isinstance(port, int) or not 1024 <= port <= 65535:
        raise ConfigError(f"port phải là số nguyên 1024-65535, nhận được {port!r}")
    return config


config_file = Path("config.json")
config_file.unlink(missing_ok=True)                   # Dọn file cũ để demo chạy lại được

scenarios = [
    None,                                             # 1. File chưa tồn tại
    '{"port": 9000, "debug": true}',                  # 2. File hợp lệ, ghi đè 2 giá trị
    '{"port": 9000, "debug": true,}',                 # 3. Dấu phẩy thừa → JSON hỏng
    '{"port": "80"}',                                 # 4. Sai kiểu dữ liệu
    '{"prot": 9000}',                                 # 5. Gõ nhầm tên khóa
]
for number, content in enumerate(scenarios, start=1):
    if content is not None:
        config_file.write_text(content, encoding="utf-8")
    try:
        config = load_config(config_file)
    except ConfigError as error:
        print(f"{number}. ❌ Lỗi cấu hình: {error}")
    else:
        print(f"{number}. ✅ port={config['port']}, debug={config['debug']}")

# Output:
# ℹ️  Chưa có config.json, đã tạo file mặc định
# 1. ✅ port=8000, debug=False
# 2. ✅ port=9000, debug=True
# 3. ❌ Lỗi cấu hình: config.json sai cú pháp JSON ở dòng 1, cột 30
# 4. ❌ Lỗi cấu hình: port phải là số nguyên 1024-65535, nhận được '80'
# 5. ❌ Lỗi cấu hình: Khóa không hợp lệ: ['prot'] (gõ nhầm tên?)
```

> 🧠 **Fail fast**: báo lỗi cấu hình **ngay khi khởi động** với thông báo chỉ rõ dòng/cột/khóa sai, tốt hơn nhiều so với để ứng dụng chạy rồi mới hỏng lúc nửa đêm vì `port = "80"` là chuỗi.

## ⚠️ Lỗi thường gặp

### 1. Quên `encoding="utf-8"`

```text
# ❌ Chạy tốt trên Mac/Linux nhưng lỗi trên Windows
with open("data.txt", "w") as f:
    f.write("Xin chào Việt Nam")
# UnicodeEncodeError: 'charmap' codec can't encode character...

# ✅
with open("data.txt", "w", encoding="utf-8") as f:
    f.write("Xin chào Việt Nam")
```

### 2. Dùng `"w"` khi muốn ghi thêm

```python
with open("log.txt", "w", encoding="utf-8") as f:
    f.write("Log 1\n")
with open("log.txt", "w", encoding="utf-8") as f:     # ❌ Xóa mất Log 1!
    f.write("Log 2\n")
with open("log.txt", encoding="utf-8") as f:
    print(f.read().strip())
# Output: Log 2
# ✅ Dùng "a" để ghi thêm vào cuối
```

### 3. FileNotFoundError vì sai thư mục làm việc

```python
from pathlib import Path

try:
    open("khong_ton_tai.txt", encoding="utf-8")
except FileNotFoundError as error:
    print(error)
    print("Thư mục hiện tại có phải tuyệt đối?", Path.cwd().is_absolute())
# Output:
# [Errno 2] No such file or directory: 'khong_ton_tai.txt'
# Thư mục hiện tại có phải tuyệt đối? True
```

**Cách sửa**: In `Path.cwd()` để biết Python đang đứng ở đâu, hoặc dùng `Path(__file__).parent / "file.txt"`.

### 4. Bắt exception quá rộng và "nuốt" lỗi

```text
try:
    process_data()
except Exception:
    pass            # ❌ Lỗi biến mất không dấu vết - debug trong vô vọng

try:
    process_data()
except ValueError as error:          # ✅ Cụ thể
    print(f"Dữ liệu sai: {error}")
```

### 5. Quên `\n` khi dùng write()

```python
with open("lines.txt", "w", encoding="utf-8") as f:
    f.write("A")
    f.write("B")                     # ❌ Dính liền "AB"
with open("lines.txt", encoding="utf-8") as f:
    print(f.read())
# Output: AB
```

### 6. Quên ép kiểu dữ liệu đọc từ CSV/file

```python
row = {"price": "5000", "qty": "3"}
print(row["price"] * 2)                      # ❌ Nhân chuỗi
# Output: 50005000
print(int(row["price"]) * int(row["qty"]))   # ✅
# Output: 15000
```

### 7. Dùng `json.load` với chuỗi (hoặc `json.loads` với file)

```text
json.load('{"a": 1}')     # ❌ AttributeError: 'str' object has no attribute 'read'
json.loads('{"a": 1}')    # ✅ loads cho string
json.load(f)              # ✅ load cho file object
```

### 8. Đọc file 2 lần mà không mở lại

```python
with open("poem2.txt", "w", encoding="utf-8") as f:
    f.write("abc")
with open("poem2.txt", encoding="utf-8") as f:
    first = f.read()
    second = f.read()           # ❌ "Con trỏ" đã ở cuối file → chuỗi rỗng
print(repr(first), repr(second))
# Output: 'abc' ''
```

**Cách sửa**: lưu kết quả vào biến và dùng lại, hoặc gọi `f.seek(0)` để quay về đầu file.

## 🏋️ Bài tập

### Bài tập 1: Máy tính an toàn

Viết chương trình nhận 2 số và phép toán từ người dùng. Xử lý: nhập không phải số (`ValueError`), chia cho 0 (`ZeroDivisionError`), phép toán không hợp lệ (tự `raise ValueError`). Chương trình không bao giờ bị crash.

### Bài tập 2: Nhật ký (Journal)

Viết chương trình ghi nhật ký: mỗi lần chạy, cho người dùng nhập một dòng, ghi thêm vào `journal.txt` kèm ngày giờ (`from datetime import datetime` rồi dùng `datetime.now()` - module `datetime` sẽ học kỹ ở [Bài 8](./08-modules-packages.md)). Thêm lệnh `show` để in toàn bộ nhật ký.

### Bài tập 3: Custom exception cho kho hàng

Tạo `InventoryError` (gốc), `OutOfStockError`, `ProductNotFoundError`. Viết class `Inventory` với method `remove(product, qty)` raise lỗi phù hợp.

### Bài tập 4: Dọn dẹp thư mục

Dùng `pathlib` viết script sắp xếp các file trong thư mục `Downloads` giả lập (tự tạo file mẫu) vào các thư mục con theo đuôi file: `images/` (.jpg, .png), `documents/` (.pdf, .docx, .txt), `others/`.

### Bài tập 5: Sổ điểm JSON ↔ CSV

1. Tạo list dict điểm học sinh, lưu ra `grades.json`
2. Đọc `grades.json`, tính điểm trung bình, xuất ra `grades.csv` có thêm cột `average` và `rank`
3. Xử lý trường hợp file JSON không tồn tại hoặc bị hỏng

<details>
<summary>💡 Xem đáp án Bài tập 4</summary>

```python
from pathlib import Path

CATEGORIES = {
    "images": {".jpg", ".png", ".gif"},
    "documents": {".pdf", ".docx", ".txt"},
}

downloads = Path("fake_downloads")
downloads.mkdir(exist_ok=True)
for name in ["cat.jpg", "cv.pdf", "notes.txt", "song.mp3", "logo.png"]:
    (downloads / name).write_text("demo", encoding="utf-8")


def category_of(path: Path) -> str:
    for folder, suffixes in CATEGORIES.items():
        if path.suffix.lower() in suffixes:
            return folder
    return "others"


for file in list(downloads.iterdir()):
    if file.is_file():
        target_dir = downloads / category_of(file)
        target_dir.mkdir(exist_ok=True)
        file.rename(target_dir / file.name)

for folder in sorted(p for p in downloads.iterdir() if p.is_dir()):
    print(folder.name, sorted(f.name for f in folder.iterdir()))
# Output:
# documents ['cv.pdf', 'notes.txt']
# images ['cat.jpg', 'logo.png']
# others ['song.mp3']
```

</details>

## ✅ Checklist hoàn thành

- [ ] Phân biệt SyntaxError và exception lúc chạy
- [ ] Biết các exception phổ biến: `ValueError`, `TypeError`, `KeyError`, `IndexError`, `FileNotFoundError`
- [ ] Viết `try/except/else/finally` và hiểu khi nào mỗi khối chạy
- [ ] Không dùng bare `except:`
- [ ] Dùng `raise` để báo lỗi, `raise ... from ...` để giữ nguyên nhân
- [ ] Tạo custom exception có cây phân cấp
- [ ] Luôn dùng `with open(...)` và `encoding="utf-8"`
- [ ] Phân biệt các chế độ `r`, `w`, `a`, `x`
- [ ] Dùng `pathlib`: `/`, `exists()`, `mkdir()`, `read_text()`, `glob()`
- [ ] Đọc/ghi JSON với `json.dump/load` và `dumps/loads`
- [ ] Đọc/ghi CSV với `DictReader`/`DictWriter`
- [ ] Xử lý được dữ liệu "bẩn": gom lỗi theo số dòng, đọc file cấu hình an toàn (phần 🌍 Ứng dụng thực tế)
- [ ] Hoàn thành ít nhất 3 bài tập

## 🚀 Tiếp theo

Code của bạn giờ đã vững vàng trước lỗi và biết lưu dữ liệu xuống file. Khi project lớn dần, một file `.py` sẽ không đủ nữa. Bài tiếp theo sẽ dạy bạn cách **chia code thành module, package** và tận dụng kho **standard library** khổng lồ của Python.

**Bài tiếp theo**: [Modules & Packages](./08-modules-packages.md)

---

💡 **Tips nhớ lâu**:

- **Bắt exception cụ thể**, không dùng `except:` trống
- **`try` nhỏ gọn**, phần còn lại để vào `else`
- **`finally` / `with`** để dọn dẹp tài nguyên
- **Luôn `encoding="utf-8"`** khi mở file văn bản
- **`pathlib`** thay cho ghép chuỗi đường dẫn
- **`json.dumps(..., ensure_ascii=False, indent=2)`** để JSON tiếng Việt đẹp và dễ đọc
