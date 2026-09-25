# 📚 Bài 9: Python nâng cao

## 🎯 Mục tiêu bài học

- Hiểu **iterable** và **iterator**, giao thức `__iter__` / `__next__`
- Viết **generator** với `yield` - xử lý dữ liệu lớn mà tốn rất ít bộ nhớ
- Dùng **generator expression** và ghép các generator thành "pipeline"
- Hiểu **closure** - hàm "nhớ" môi trường nơi nó được tạo
- Viết **decorator** từ cơ bản đến có tham số, dùng `functools.wraps`
- Tự viết **context manager** bằng class (`__enter__`/`__exit__`) và bằng `contextlib`
- Làm quen **lập trình bất đồng bộ** với `asyncio`: `async`/`await`, `asyncio.gather`

> 💡 Đây là bài khó nhất khóa học. Đừng lo nếu chưa hiểu hết ngay lần đầu - hãy chạy thử từng ví dụ, thay đổi code và quan sát kết quả. Những khái niệm này sẽ "thấm" dần khi bạn dùng chúng trong thực tế.

## 📖 1. Iterable và Iterator

### Chuyện gì xảy ra trong vòng for?

Bạn đã dùng `for` với list, chuỗi, dict, file, range... Làm sao một câu lệnh `for` lại hoạt động với nhiều kiểu khác nhau như vậy? Câu trả lời là **giao thức iterator** (iterator protocol).

Hai khái niệm:

- **Iterable** (có thể lặp): object **có thể đưa ra một iterator** - có method `__iter__()`. Ví dụ: list, str, dict, set, file, range
- **Iterator** (bộ lặp): object **trả về từng phần tử một** qua method `__next__()`, và báo hết bằng exception `StopIteration`

> 🧠 **Ví dụ dễ hiểu**:
>
> - **Iterable** = **cuốn sách** 📕. Bạn có thể đọc nó nhiều lần, nhiều người có thể cùng đọc
> - **Iterator** = **chiếc thẻ đánh dấu trang** 🔖 kẹp trong sách. Nó chỉ biết "trang tiếp theo là gì". Khi đến trang cuối, nó hết tác dụng
> - Mỗi lần bắt đầu đọc (`for`), bạn lấy **một thẻ đánh dấu mới** (`iter()`)

### Làm thủ công những gì `for` làm

```python
fruits = ["táo", "cam", "xoài"]

iterator = iter(fruits)         # Gọi fruits.__iter__() → lấy "thẻ đánh dấu"
print(type(iterator).__name__)
# Output: list_iterator

print(next(iterator))           # Gọi iterator.__next__()
# Output: táo
print(next(iterator))
# Output: cam
print(next(iterator))
# Output: xoài

try:
    next(iterator)              # Hết phần tử
except StopIteration:
    print("StopIteration: hết rồi!")
# Output: StopIteration: hết rồi!
```

Vòng `for fruit in fruits:` thực chất tương đương với:

```python
fruits = ["táo", "cam", "xoài"]

_iterator = iter(fruits)
while True:
    try:
        fruit = next(_iterator)
    except StopIteration:
        break
    print(fruit)                # Thân vòng for
# Output:
# táo
# cam
# xoài
```

### Iterator chỉ dùng được MỘT lần

```python
numbers = [1, 2, 3]
it = iter(numbers)

print(list(it))         # Lần đầu: lấy hết
# Output: [1, 2, 3]
print(list(it))         # Lần hai: rỗng! Thẻ đánh dấu đã ở cuối sách
# Output: []
print(list(numbers))    # List (iterable) vẫn dùng lại được thoải mái
# Output: [1, 2, 3]

# Nhiều hàm có sẵn trả về iterator: zip, map, filter, enumerate, reversed...
pairs = zip([1, 2], ["a", "b"])
print(list(pairs))
# Output: [(1, 'a'), (2, 'b')]
print(list(pairs))      # ⚠️ Đã dùng hết
# Output: []
```

### Tự viết iterator bằng class

```python
class Countdown:
    """Iterator đếm ngược từ start về 1."""

    def __init__(self, start: int):
        self.current = start

    def __iter__(self):
        return self                     # Iterator trả về chính nó

    def __next__(self) -> int:
        if self.current <= 0:
            raise StopIteration         # Báo hiệu kết thúc
        value = self.current
        self.current -= 1
        return value


for n in Countdown(3):
    print(n, end=" ")
print("🚀")
# Output: 3 2 1 🚀
```

Cách này hoạt động nhưng khá dài dòng: phải nhớ trạng thái (`self.current`), tự raise `StopIteration`... **Generator** sẽ giúp bạn viết điều tương tự chỉ trong vài dòng!

## 📖 2. Generator và yield

### Generator function

**Generator** là hàm dùng `yield` thay vì (hoặc cùng với) `return`. Mỗi lần gặp `yield`, hàm **trả ra một giá trị và TẠM DỪNG**, giữ nguyên mọi biến local. Lần gọi `next()` tiếp theo, hàm **chạy tiếp từ chỗ đã dừng**.

```python
def countdown(start: int):
    while start > 0:
        yield start         # Trả ra giá trị và tạm dừng tại đây
        start -= 1


for n in countdown(3):
    print(n, end=" ")
print("🚀")
# Output: 3 2 1 🚀
```

So với class `Countdown` ở trên: ngắn hơn rất nhiều, Python tự lo `__iter__`, `__next__` và `StopIteration`!

> 🧠 **Ví dụ dễ hiểu**:
>
> - **Hàm thường** (`return`) giống **nhà hàng buffet**: nấu **tất cả** món một lúc, bày hết ra bàn → tốn nhiều chỗ (bộ nhớ)
> - **Generator** (`yield`) giống **đầu bếp gọi món**: bạn gọi món nào, đầu bếp **nấu món đó** rồi đưa ra, sau đó **nghỉ chờ** bạn gọi món tiếp theo → không tốn chỗ bày

### Quan sát generator tạm dừng và chạy tiếp

```python
def demo():
    print("  [Bắt đầu]")
    yield 1
    print("  [Tiếp tục sau yield 1]")
    yield 2
    print("  [Tiếp tục sau yield 2]")
    yield 3
    print("  [Kết thúc]")


gen = demo()                    # ⚠️ Gọi hàm generator CHƯA chạy dòng nào cả!
print(type(gen).__name__)
# Output: generator

print("Lấy:", next(gen))
print("Lấy:", next(gen))
print("Lấy:", next(gen))
# Output:
#   [Bắt đầu]
# Lấy: 1
#   [Tiếp tục sau yield 1]
# Lấy: 2
#   [Tiếp tục sau yield 2]
# Lấy: 3

print(list(gen))                # Chạy nốt phần còn lại → không còn yield nào
# Output:
#   [Kết thúc]
# []
```

### Tại sao generator quan trọng? - Tiết kiệm bộ nhớ

```python
import sys


def squares_list(n):
    return [i * i for i in range(n)]    # Tạo TẤT CẢ phần tử ngay lập tức


def squares_gen(n):
    for i in range(n):
        yield i * i                     # Tạo TỪNG phần tử khi được yêu cầu


big_list = squares_list(1_000_000)
big_gen = squares_gen(1_000_000)

print(f"List:      {sys.getsizeof(big_list):>10,} bytes")
print(f"Generator: {sys.getsizeof(big_gen):>10,} bytes")
# Output (ví dụ):
# List:       8,448,728 bytes
# Generator:        208 bytes

print(sum(squares_gen(1_000_000)) == sum(big_list))     # Kết quả như nhau
# Output: True
print(sys.getsizeof(big_gen) < 1000)
# Output: True
```

Generator dùng **vài trăm byte** dù sinh ra **một triệu** phần tử, vì nó không lưu chúng - chỉ lưu "đang ở đâu".

### Generator vô hạn

Vì generator chỉ tính khi cần, nó có thể **vô hạn**:

```python
from itertools import islice


def fibonacci():
    a, b = 0, 1
    while True:                 # Vô hạn - nhưng an toàn vì chỉ chạy khi có ai gọi next()
        yield a
        a, b = b, a + b


print(list(islice(fibonacci(), 10)))    # Lấy 10 số đầu tiên
# Output: [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]

for f in fibonacci():
    if f > 100:
        break
    last = f
print("Số Fibonacci lớn nhất <= 100:", last)
# Output: Số Fibonacci lớn nhất <= 100: 89
```

### Ứng dụng thực tế: đọc file lớn

```python
from pathlib import Path

# Tạo file log mẫu
log = Path("server.log")
log.write_text(
    "INFO start\nERROR db timeout\nINFO request /home\nERROR disk full\nINFO stop\n",
    encoding="utf-8",
)


def read_lines(path: Path):
    """Đọc từng dòng - không bao giờ nạp cả file vào RAM."""
    with path.open(encoding="utf-8") as f:
        for line in f:
            yield line.rstrip("\n")


def only_errors(lines):
    for line in lines:
        if line.startswith("ERROR"):
            yield line


for error in only_errors(read_lines(log)):
    print(error)
# Output:
# ERROR db timeout
# ERROR disk full
```

Dù file log nặng 50GB, chương trình này vẫn chỉ dùng một lượng RAM rất nhỏ.

### yield from - Ủy quyền cho generator khác

```python
def flatten(items):
    for item in items:
        if isinstance(item, list):
            yield from flatten(item)    # "Yield hết mọi thứ mà flatten(item) yield"
        else:
            yield item


print(list(flatten([1, [2, [3, 4]], [5], 6])))
# Output: [1, 2, 3, 4, 5, 6]
```

## 📖 3. Generator Expression và Pipeline

### Generator expression

Giống list comprehension nhưng dùng **ngoặc tròn** `()`:

```python
numbers = range(1, 11)

squares_list = [n * n for n in numbers]     # List: tạo ngay 10 phần tử
squares_gen = (n * n for n in numbers)      # Generator: chưa tính gì cả

print(squares_list)
# Output: [1, 4, 9, 16, 25, 36, 49, 64, 81, 100]
print(squares_gen)
# Output (ví dụ): <generator object <genexpr> at 0x7f...>
print(next(squares_gen), next(squares_gen))
# Output: 1 4

# Khi truyền vào hàm, có thể bỏ ngoặc tròn thừa
print(sum(n * n for n in numbers))
# Output: 385
print(max(len(w) for w in ["Python", "là", "tuyệt"]))
# Output: 6
print(any(n > 9 for n in numbers))      # Dừng NGAY khi gặp phần tử đầu tiên thỏa mãn
# Output: True
```

| | List comprehension `[...]` | Generator expression `(...)` |
| --- | --- | --- |
| Tính toán | Ngay lập tức, tất cả | Lười (lazy), từng phần tử |
| Bộ nhớ | Tỉ lệ với số phần tử | Rất nhỏ, cố định |
| Dùng lại | ✅ Nhiều lần | ❌ Chỉ một lần |
| Truy cập `[i]`, `len()` | ✅ | ❌ |
| Dùng khi | Cần dùng lại / index / dữ liệu nhỏ | Duyệt một lần / dữ liệu lớn / đưa vào `sum`, `max`... |

### Pipeline - Dây chuyền xử lý dữ liệu

Ghép nhiều generator lại với nhau như **dây chuyền sản xuất**: mỗi công đoạn nhận từng món từ công đoạn trước, xử lý, rồi chuyển tiếp:

```python
raw_orders = [
    "An,120000",
    "",
    "Bình,abc",
    "Chi,450000",
    "# ghi chú",
    "Dũng,80000",
]

# Công đoạn 1: bỏ dòng rỗng và comment
lines = (line for line in raw_orders if line and not line.startswith("#"))
# Công đoạn 2: tách cột
rows = (line.split(",") for line in lines)
# Công đoạn 3: chỉ giữ dòng có số tiền hợp lệ
valid = ((name, int(amount)) for name, amount in rows if amount.isdigit())
# Công đoạn 4: lọc đơn lớn
big_orders = ((name, amount) for name, amount in valid if amount >= 100_000)

# Chưa có gì được tính cho đến dòng này!
for name, amount in big_orders:
    print(f"{name}: {amount:,}đ")
# Output:
# An: 120,000đ
# Chi: 450,000đ
```

> 🧠 Mỗi đơn hàng đi qua **toàn bộ** dây chuyền trước khi đơn tiếp theo được lấy ra. Không có list trung gian nào được tạo trong bộ nhớ.

## 📖 4. Closure

### Nhắc lại: hàm là first-class object

Ở [Bài 4](./04-functions.md), bạn đã biết hàm có thể được gán vào biến, truyền vào hàm khác, và **trả về từ hàm khác**. Ta cũng đã thấy `make_counter()` với `nonlocal`. Giờ hãy hiểu sâu hơn.

### Closure là gì?

**Closure** là một hàm bên trong **"nhớ" các biến của hàm bên ngoài**, ngay cả khi hàm bên ngoài **đã chạy xong**.

```python
def make_multiplier(factor):
    def multiply(x):
        return x * factor       # factor thuộc scope của make_multiplier (Enclosing)
    return multiply             # Trả về hàm (không gọi!)


double = make_multiplier(2)
triple = make_multiplier(3)

print(double(10), triple(10))
# Output: 20 30

# make_multiplier đã chạy xong, nhưng double vẫn "nhớ" factor = 2
print(double.__closure__[0].cell_contents)
# Output: 2
```

> 🧠 **Ví dụ dễ hiểu**: Closure giống **chiếc ba lô** 🎒. Khi hàm `multiply` được tạo ra bên trong `make_multiplier`, nó **bỏ vào ba lô** những biến nó cần (`factor`). Dù sau đó `make_multiplier` đã kết thúc, `multiply` vẫn mang ba lô theo mình đi khắp nơi.

### Closure có trạng thái

```python
def make_averager():
    numbers = []                # Biến "private" - chỉ hàm averager truy cập được

    def averager(value):
        numbers.append(value)   # Sửa NỘI DUNG list → không cần nonlocal
        return sum(numbers) / len(numbers)

    return averager


avg = make_averager()
print(avg(10))
# Output: 10.0
print(avg(20))
# Output: 15.0
print(avg(60))
# Output: 30.0
```

> 💡 **Nhớ**: Nếu chỉ **sửa nội dung** object mutable (list.append) → không cần `nonlocal`. Nếu **gán lại** biến (`count += 1`, `total = ...`) → cần `nonlocal`.

### Bẫy closure trong vòng lặp

```python
# ❌ Mọi lambda đều "nhớ" CÙNG MỘT biến i - giá trị cuối cùng của i
functions = [lambda: i for i in range(3)]
print([f() for f in functions])
# Output: [2, 2, 2]

# ✅ Dùng tham số mặc định để "chụp" giá trị tại thời điểm tạo
functions = [lambda i=i: i for i in range(3)]
print([f() for f in functions])
# Output: [0, 1, 2]
```

**Tại sao?** Closure nhớ **biến**, không phải **giá trị**. Khi các lambda được gọi, vòng lặp đã xong và `i` là 2.

## 📖 5. Decorator

### Vấn đề

Bạn có 20 hàm và muốn **đo thời gian chạy** của từng hàm. Thêm code đo thời gian vào đầu và cuối cả 20 hàm? Lặp lại code, và làm "bẩn" logic chính của hàm.

### Decorator là gì?

**Decorator** là một hàm **nhận vào một hàm**, và **trả về một hàm mới** "bọc" hàm cũ với thêm chức năng - **mà không sửa code hàm gốc**.

> 🧠 **Ví dụ dễ hiểu**: Decorator giống **gói quà** 🎁. Món quà bên trong (hàm gốc) không thay đổi, nhưng được bọc thêm giấy gói, nơ, thiệp (chức năng bổ sung như log, đo thời gian, kiểm tra quyền). Bạn có thể gói nhiều lớp.

### Decorator từ đầu

```python
def my_decorator(func):                 # Nhận hàm gốc
    def wrapper():                      # Hàm bọc (closure - nhớ func)
        print("🎁 Trước khi gọi hàm")
        func()                          # Gọi hàm gốc
        print("🎀 Sau khi gọi hàm")
    return wrapper                      # Trả về hàm bọc


def say_hello():
    print("Xin chào!")


say_hello = my_decorator(say_hello)     # "Bọc" say_hello bằng tay
say_hello()
# Output:
# 🎁 Trước khi gọi hàm
# Xin chào!
# 🎀 Sau khi gọi hàm
```

### Cú pháp @ - "Đường cú pháp" (syntactic sugar)

```python
def my_decorator(func):
    def wrapper():
        print("🎁 Trước")
        func()
        print("🎀 Sau")
    return wrapper


@my_decorator                   # Hoàn toàn tương đương: say_goodbye = my_decorator(say_goodbye)
def say_goodbye():
    print("Tạm biệt!")


say_goodbye()
# Output:
# 🎁 Trước
# Tạm biệt!
# 🎀 Sau
```

### Decorator cho hàm có tham số và giá trị trả về

Dùng `*args, **kwargs` ([Bài 4](./04-functions.md)) để wrapper nhận **mọi loại tham số**, và nhớ **return** kết quả:

```python
import time


def timer(func):
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)          # Truyền nguyên mọi tham số
        elapsed = time.perf_counter() - start
        print(f"⏱️ {func.__name__} chạy mất {elapsed:.4f}s")
        return result                           # ⚠️ Đừng quên return!
    return wrapper


@timer
def slow_sum(n):
    return sum(range(n))


@timer
def greet(name, greeting="Xin chào"):
    return f"{greeting}, {name}!"


print(slow_sum(1_000_000))
print(greet("An", greeting="Chào"))
# Output (ví dụ):
# ⏱️ slow_sum chạy mất 0.0123s
# 499999500000
# ⏱️ greet chạy mất 0.0000s
# Chào, An!
```

### ⚠️ Vấn đề: decorator làm mất thông tin hàm gốc - dùng `functools.wraps`

```python
from functools import wraps


def no_wraps(func):
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper


def with_wraps(func):
    @wraps(func)                        # ✅ Sao chép __name__, __doc__... từ func sang wrapper
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper


@no_wraps
def add(a, b):
    """Cộng hai số."""
    return a + b


@with_wraps
def multiply(a, b):
    """Nhân hai số."""
    return a * b


print(add.__name__, add.__doc__)                 # ❌ Mất tên và docstring
# Output: wrapper None
print(multiply.__name__, multiply.__doc__)       # ✅ Giữ nguyên
# Output: multiply Nhân hai số.
```

> ✅ **Quy tắc**: **LUÔN** dùng `@wraps(func)` khi viết decorator. Nếu không, `help()`, debugger, log, và các công cụ test sẽ thấy tên `wrapper` thay vì tên thật.

### Ví dụ thực tế: log và kiểm tra quyền

```python
from functools import wraps


def log_calls(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        params = ", ".join([repr(a) for a in args] + [f"{k}={v!r}" for k, v in kwargs.items()])
        print(f"📞 Gọi {func.__name__}({params})")
        result = func(*args, **kwargs)
        print(f"📤 {func.__name__} trả về {result!r}")
        return result
    return wrapper


def require_admin(func):
    @wraps(func)
    def wrapper(user, *args, **kwargs):
        if user.get("role") != "admin":
            raise PermissionError(f"{user['name']} không có quyền gọi {func.__name__}")
        return func(user, *args, **kwargs)
    return wrapper


@log_calls
def calculate_discount(price, percent=10):
    return price * (100 - percent) // 100


@require_admin
def delete_user(user, target):
    return f"{user['name']} đã xóa {target}"


calculate_discount(200_000, percent=20)
# Output:
# 📞 Gọi calculate_discount(200000, percent=20)
# 📤 calculate_discount trả về 160000

print(delete_user({"name": "Admin", "role": "admin"}, "spammer"))
# Output: Admin đã xóa spammer
try:
    delete_user({"name": "Khách", "role": "guest"}, "An")
except PermissionError as error:
    print("⛔", error)
# Output: ⛔ Khách không có quyền gọi delete_user
```

### Decorator có tham số

Muốn viết `@retry(times=3)` - decorator nhận tham số? Cần **thêm một tầng hàm** nữa:

```text
retry(times=3)   →  trả về decorator
decorator(func)  →  trả về wrapper
wrapper(...)     →  chạy func
```

```python
from functools import wraps


def retry(times: int = 3, exceptions: tuple = (Exception,)):
    """Thử lại hàm tối đa `times` lần nếu gặp lỗi."""
    def decorator(func):                            # Tầng 2: nhận hàm
        @wraps(func)
        def wrapper(*args, **kwargs):               # Tầng 3: chạy hàm
            for attempt in range(1, times + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as error:
                    print(f"  ⚠️ Lần {attempt}/{times} thất bại: {error}")
            raise RuntimeError(f"{func.__name__} thất bại sau {times} lần thử")
        return wrapper
    return decorator                                # Tầng 1: trả về decorator


attempts = {"count": 0}


@retry(times=3, exceptions=(ConnectionError,))      # retry(...) chạy trước, trả về decorator
def fetch_data():
    attempts["count"] += 1
    if attempts["count"] < 3:
        raise ConnectionError("Mất kết nối")
    return "📦 Dữ liệu"


print(fetch_data())
# Output:
#   ⚠️ Lần 1/3 thất bại: Mất kết nối
#   ⚠️ Lần 2/3 thất bại: Mất kết nối
# 📦 Dữ liệu
```

Một ví dụ khác - lặp lại hàm N lần:

```python
from functools import wraps


def repeat(n: int):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            return [func(*args, **kwargs) for _ in range(n)]
        return wrapper
    return decorator


@repeat(3)
def cheer(name):
    return f"Cố lên {name}!"


print(cheer("Việt Nam"))
# Output: ['Cố lên Việt Nam!', 'Cố lên Việt Nam!', 'Cố lên Việt Nam!']
```

### Chồng nhiều decorator

```python
from functools import wraps


def bold(func):
    @wraps(func)
    def wrapper():
        return f"<b>{func()}</b>"
    return wrapper


def italic(func):
    @wraps(func)
    def wrapper():
        return f"<i>{func()}</i>"
    return wrapper


@bold           # Áp dụng SAU (lớp ngoài cùng)
@italic         # Áp dụng TRƯỚC (gần hàm nhất)
def text():
    return "Python"


print(text())   # Tương đương: bold(italic(text))()
# Output: <b><i>Python</i></b>
```

### Decorator có sẵn bạn đã và sẽ gặp

| Decorator | Công dụng |
| --- | --- |
| `@property`, `@classmethod`, `@staticmethod` | Trong class ([Bài 6](./06-oop.md)) |
| `@dataclass` | Tự sinh `__init__`, `__repr__`... ([Bài 6](./06-oop.md)) |
| `@functools.lru_cache` / `@functools.cache` | Ghi nhớ kết quả (memoization) |
| `@functools.wraps` | Giữ metadata khi viết decorator |
| `@abstractmethod` | Method trừu tượng ([Bài 6](./06-oop.md)) |
| `@app.get("/")` | Định nghĩa route trong FastAPI/Flask |
| `@pytest.fixture` | Fixture trong pytest ([Bài 10](./10-final-project.md)) |

```python
from functools import lru_cache
import time


@lru_cache(maxsize=128)
def slow_square(n):
    time.sleep(0.2)             # Giả lập tính toán chậm
    return n * n


start = time.perf_counter()
slow_square(9)                  # Lần đầu: chậm
slow_square(9)                  # Lần hai: lấy từ cache, gần như tức thì
elapsed = time.perf_counter() - start
print(elapsed < 0.3)            # Chỉ tốn ~0.2s cho cả 2 lần gọi
# Output: True
print(slow_square.cache_info())
# Output: CacheInfo(hits=1, misses=1, maxsize=128, currsize=1)
```

## 📖 6. Context Manager tự viết

### Nhắc lại

Ở [Bài 7](./07-exceptions-files.md), bạn đã dùng `with open(...) as f:` để file tự đóng. Giờ hãy tự tạo context manager của riêng mình!

### Cách 1: Class với `__enter__` và `__exit__`

```python
import time


class Timer:
    """Đo thời gian chạy của một khối code."""

    def __init__(self, label: str):
        self.label = label

    def __enter__(self):                            # Chạy khi VÀO khối with
        self.start = time.perf_counter()
        print(f"▶️ Bắt đầu: {self.label}")
        return self                                 # Giá trị gán cho biến sau "as"

    def __exit__(self, exc_type, exc_value, traceback):    # Chạy khi RA khỏi khối with
        self.elapsed = time.perf_counter() - self.start
        status = "❌ lỗi" if exc_type else "✅ xong"
        print(f"⏹️ {self.label}: {status}")
        return False                                # False = không "nuốt" exception


with Timer("Tính tổng") as t:
    total = sum(range(1_000_000))

print(t.elapsed > 0)
# Output:
# ▶️ Bắt đầu: Tính tổng
# ⏹️ Tính tổng: ✅ xong
# True
```

Ba tham số của `__exit__` cho biết có exception xảy ra trong khối `with` hay không:

- Không có lỗi: cả ba đều là `None`
- Có lỗi: `exc_type` là class lỗi, `exc_value` là object lỗi, `traceback` là thông tin vị trí
- Nếu `__exit__` **trả về `True`** → exception bị "nuốt" (không lan ra ngoài). Trả về `False`/`None` → exception tiếp tục bay ra

```python
class SuppressErrors:
    """Bỏ qua các loại lỗi chỉ định (giống contextlib.suppress)."""

    def __init__(self, *error_types):
        self.error_types = error_types

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        if exc_type is not None and issubclass(exc_type, self.error_types):
            print(f"🙈 Bỏ qua lỗi: {exc_type.__name__}: {exc_value}")
            return True                             # Nuốt lỗi
        return False


with SuppressErrors(ZeroDivisionError, KeyError):
    result = 10 / 0
    print("Không bao giờ chạy tới đây")

print("Chương trình tiếp tục")
# Output:
# 🙈 Bỏ qua lỗi: ZeroDivisionError: division by zero
# Chương trình tiếp tục
```

### Cách 2: `@contextmanager` từ contextlib - Ngắn gọn hơn

Viết context manager bằng **một generator có đúng một `yield`**:

- Code **trước `yield`** ↔ `__enter__`
- Giá trị được `yield` ↔ giá trị gán cho `as`
- Code **sau `yield`** (đặt trong `finally`) ↔ `__exit__`

```python
from contextlib import contextmanager
import time


@contextmanager
def timer(label: str):
    start = time.perf_counter()
    print(f"▶️ Bắt đầu: {label}")
    try:
        yield                                       # Khối with chạy tại đây
    finally:                                        # Đảm bảo luôn chạy, kể cả khi lỗi
        elapsed = time.perf_counter() - start
        print(f"⏹️ {label} xong (>= 0s: {elapsed >= 0})")


with timer("Sắp xếp"):
    sorted(range(100_000), reverse=True)
# Output:
# ▶️ Bắt đầu: Sắp xếp
# ⏹️ Sắp xếp xong (>= 0s: True)
```

### Ví dụ thực tế: tạm đổi thư mục làm việc

```python
import os
from contextlib import contextmanager
from pathlib import Path


@contextmanager
def working_directory(path):
    """Tạm thời chuyển sang thư mục khác, tự quay về khi xong."""
    original = Path.cwd()
    os.chdir(path)
    try:
        yield Path(path)
    finally:
        os.chdir(original)                          # Luôn quay về, kể cả khi có lỗi


Path("temp_work").mkdir(exist_ok=True)
before = Path.cwd()

with working_directory("temp_work") as wd:
    Path("inside.txt").write_text("xin chào", encoding="utf-8")
    print("Đang ở:", Path.cwd().name)

print("Đã quay về:", Path.cwd() == before)
print((Path("temp_work") / "inside.txt").exists())
# Output:
# Đang ở: temp_work
# Đã quay về: True
# True
```

### Ví dụ thực tế: transaction "tất cả hoặc không có gì"

```python
from contextlib import contextmanager


@contextmanager
def transaction(data: dict):
    """Nếu có lỗi trong khối with, khôi phục data về trạng thái ban đầu."""
    backup = data.copy()
    try:
        yield data
    except Exception as error:
        data.clear()
        data.update(backup)                         # Rollback
        print(f"↩️ Rollback vì lỗi: {error}")
        raise


accounts = {"An": 1000, "Bình": 500}

try:
    with transaction(accounts) as acc:
        acc["An"] -= 700
        acc["Bình"] += 700
        raise ConnectionError("Mất điện giữa chừng!")
except ConnectionError:
    pass

print(accounts)                                     # Không mất tiền oan
# Output:
# ↩️ Rollback vì lỗi: Mất điện giữa chừng!
# {'An': 1000, 'Bình': 500}
```

### Context manager có sẵn hữu ích

```python
from contextlib import suppress
from pathlib import Path

# suppress: bỏ qua lỗi cụ thể - gọn hơn try/except/pass
with suppress(FileNotFoundError):
    Path("file_khong_ton_tai.txt").unlink()
print("Không lỗi")
# Output: Không lỗi

# Nhiều context manager trong một with
Path("a.txt").write_text("nội dung A", encoding="utf-8")
with open("a.txt", encoding="utf-8") as src, open("b.txt", "w", encoding="utf-8") as dst:
    dst.write(src.read().upper())
print(Path("b.txt").read_text(encoding="utf-8"))
# Output: NỘI DUNG A
```

## 📖 7. Lập trình bất đồng bộ với asyncio

### Vấn đề: chờ đợi lãng phí thời gian

Nhiều tác vụ phần lớn thời gian là **chờ**: chờ server trả lời, chờ đọc file, chờ database... (gọi là tác vụ **I/O-bound**). Với code thông thường (**đồng bộ** - synchronous), chương trình **đứng im** trong lúc chờ.

> 🧠 **Ví dụ dễ hiểu**: Bạn cần nấu cơm (20 phút), luộc rau (10 phút), rán trứng (5 phút).
>
> - **Đồng bộ**: nấu cơm, **đứng nhìn nồi cơm 20 phút**, rồi mới luộc rau, đứng chờ 10 phút, rồi rán trứng → **35 phút**
> - **Bất đồng bộ**: bấm nồi cơm, **trong lúc chờ** thì luộc rau, trong lúc chờ rau thì rán trứng → **~20 phút**
>
> Bạn vẫn chỉ có **một người** (một luồng), nhưng không lãng phí thời gian đứng chờ!

### async / await cơ bản

- `async def` định nghĩa một **coroutine function** (hàm bất đồng bộ)
- `await` nghĩa là: "chờ việc này xong, **trong lúc chờ thì cho phép việc khác chạy**"
- `asyncio.run(main())` khởi động **event loop** - "người điều phối" các coroutine

```python
import asyncio


async def say_after(delay: float, message: str) -> str:
    await asyncio.sleep(delay)          # Chờ KHÔNG chặn - khác với time.sleep()!
    print(message)
    return message


async def main():
    result = await say_after(0.1, "Xin chào")
    print("Kết quả:", result)


asyncio.run(main())
# Output:
# Xin chào
# Kết quả: Xin chào
```

> ⚠️ Gọi `say_after(1, "hi")` mà **không có `await`** chỉ tạo ra một **coroutine object**, **không chạy** gì cả (Python sẽ cảnh báo `coroutine was never awaited`).

### asyncio.gather - Chạy nhiều việc đồng thời

```python
import asyncio
import time


async def cook(dish: str, minutes: float) -> str:
    print(f"🍳 Bắt đầu {dish}")
    await asyncio.sleep(minutes / 10)   # 1 "phút" = 0.1 giây cho nhanh
    print(f"✅ Xong {dish}")
    return dish


async def main_sequential():
    start = time.perf_counter()
    await cook("cơm", 3)                # Chờ xong mới làm tiếp
    await cook("rau", 2)
    await cook("trứng", 1)
    return time.perf_counter() - start


async def main_concurrent():
    start = time.perf_counter()
    results = await asyncio.gather(     # Chạy ĐỒNG THỜI, chờ tất cả xong
        cook("cơm", 3),
        cook("rau", 2),
        cook("trứng", 1),
    )
    print("Món đã xong:", results)      # Kết quả theo ĐÚNG thứ tự truyền vào
    return time.perf_counter() - start


seq_time = asyncio.run(main_sequential())
print("---")
con_time = asyncio.run(main_concurrent())
print(f"Tuần tự: {seq_time:.1f}s | Đồng thời: {con_time:.1f}s")
# Output:
# 🍳 Bắt đầu cơm
# ✅ Xong cơm
# 🍳 Bắt đầu rau
# ✅ Xong rau
# 🍳 Bắt đầu trứng
# ✅ Xong trứng
# ---
# 🍳 Bắt đầu cơm
# 🍳 Bắt đầu rau
# 🍳 Bắt đầu trứng
# ✅ Xong trứng
# ✅ Xong rau
# ✅ Xong cơm
# Món đã xong: ['cơm', 'rau', 'trứng']
# Tuần tự: 0.6s | Đồng thời: 0.3s
```

Để ý: khi chạy đồng thời, cả 3 món **bắt đầu gần như cùng lúc**, món nhanh nhất (trứng) xong trước, và tổng thời gian ≈ thời gian của món **lâu nhất** (0.3s) thay vì **tổng** (0.6s).

### Xử lý lỗi trong gather

```python
import asyncio


async def fetch(url: str) -> str:
    await asyncio.sleep(0.05)
    if "bad" in url:
        raise ConnectionError(f"Không kết nối được {url}")
    return f"<html của {url}>"


async def main():
    urls = ["site-a.com", "bad-site.com", "site-c.com"]
    # return_exceptions=True: lỗi được trả về như một kết quả, các task khác vẫn chạy tiếp
    results = await asyncio.gather(*(fetch(u) for u in urls), return_exceptions=True)
    for url, result in zip(urls, results):
        if isinstance(result, Exception):
            print(f"❌ {url}: {result}")
        else:
            print(f"✅ {url}: {result}")


asyncio.run(main())
# Output:
# ✅ site-a.com: <html của site-a.com>
# ❌ bad-site.com: Không kết nối được bad-site.com
# ✅ site-c.com: <html của site-c.com>
```

### create_task và timeout

```python
import asyncio


async def background_job(name: str, seconds: float) -> str:
    await asyncio.sleep(seconds)
    return f"{name} hoàn thành"


async def main():
    # create_task: lên lịch chạy NGAY trong nền, lấy kết quả sau
    task = asyncio.create_task(background_job("Báo cáo", 0.1))
    print("Làm việc khác trong lúc task chạy...")
    print(await task)

    # wait_for: giới hạn thời gian chờ
    try:
        await asyncio.wait_for(background_job("Việc chậm", 5), timeout=0.1)
    except asyncio.TimeoutError:
        print("⏰ Hết thời gian chờ!")


asyncio.run(main())
# Output:
# Làm việc khác trong lúc task chạy...
# Báo cáo hoàn thành
# ⏰ Hết thời gian chờ!
```

### Khi nào dùng asyncio?

| Tình huống | Nên dùng |
| --- | --- |
| Gọi nhiều API/website, chat server, web server (FastAPI) - **chờ I/O** | ✅ `asyncio` |
| Tính toán nặng (xử lý ảnh, tính toán số học) - **CPU-bound** | ❌ asyncio không giúp gì → dùng `multiprocessing` |
| Script đơn giản, chạy một lần | ❌ Code đồng bộ bình thường là đủ |

> ⚠️ **Một hàm chặn (blocking) làm "đóng băng" cả event loop**: trong `async def`, **không dùng** `time.sleep()`, `requests.get()`... Hãy dùng phiên bản async: `await asyncio.sleep()`, thư viện `httpx`/`aiohttp`. Nếu buộc phải gọi hàm chặn, dùng `await asyncio.to_thread(func, ...)`.

## ⚠️ Lỗi thường gặp

### 1. Dùng lại iterator/generator đã cạn

```python
squares = (x * x for x in range(3))
print(sum(squares))
# Output: 5
print(sum(squares))         # ❌ Generator đã hết → 0
# Output: 0
# ✅ Nếu cần dùng nhiều lần: tạo list, hoặc tạo generator mới
```

### 2. Quên rằng gọi generator function chưa chạy code

```python
def gen():
    print("Chạy rồi!")
    yield 1


g = gen()                   # ❌ Không in gì - code chưa chạy
print("Đã tạo generator")
next(g)                     # Bây giờ mới chạy
# Output:
# Đã tạo generator
# Chạy rồi!
```

### 3. Decorator quên `return` kết quả

```python
def bad_decorator(func):
    def wrapper(*args, **kwargs):
        func(*args, **kwargs)           # ❌ Quên return
    return wrapper


@bad_decorator
def add(a, b):
    return a + b


print(add(2, 3))
# Output: None
```

### 4. Quên `@wraps(func)`

Hàm bị decorate sẽ có `__name__ == "wrapper"` → log, debug, `help()` đều sai. Luôn dùng `@functools.wraps(func)`.

### 5. Quên dấu `()` với decorator có tham số

```text
@repeat          # ❌ repeat cần tham số n → repeat(func) coi func là n!
def hello(): ...

@repeat(3)       # ✅
def hello(): ...
```

### 6. Quên `await`

```python
import asyncio


async def get_number():
    await asyncio.sleep(0)
    return 42


async def main():
    wrong = get_number()            # ❌ Chỉ là coroutine object
    print(type(wrong).__name__)
    wrong.close()                   # Dọn dẹp để tránh cảnh báo "never awaited"
    right = await get_number()      # ✅
    print(right)


asyncio.run(main())
# Output:
# coroutine
# 42
```

### 7. Dùng `time.sleep()` trong code async

```python
import asyncio
import time


async def bad_worker():
    time.sleep(0.1)                 # ❌ Chặn cả event loop - các task khác phải chờ


async def good_worker():
    await asyncio.sleep(0.1)        # ✅ Nhường quyền cho task khác


async def main():
    start = time.perf_counter()
    await asyncio.gather(*(bad_worker() for _ in range(3)))
    bad = time.perf_counter() - start

    start = time.perf_counter()
    await asyncio.gather(*(good_worker() for _ in range(3)))
    good = time.perf_counter() - start
    print(f"time.sleep: {bad:.1f}s | asyncio.sleep: {good:.1f}s")


asyncio.run(main())
# Output: time.sleep: 0.3s | asyncio.sleep: 0.1s
```

### 8. Context manager bằng @contextmanager thiếu try/finally

```text
@contextmanager
def opened(path):
    f = open(path)
    yield f
    f.close()          # ❌ Nếu khối with có lỗi, dòng này KHÔNG chạy → rò rỉ file

@contextmanager
def opened(path):
    f = open(path)
    try:
        yield f
    finally:
        f.close()      # ✅ Luôn chạy
```

## 🏋️ Bài tập

### Bài tập 1: Generator

1. Viết generator `primes()` sinh vô hạn số nguyên tố. Dùng `islice` lấy 20 số đầu tiên
2. Viết generator `chunked(items, size)` chia list thành các nhóm: `chunked([1,2,3,4,5], 2)` → `[1,2]`, `[3,4]`, `[5]`
3. Viết pipeline đọc file CSV lớn (tự tạo), lọc và tính tổng một cột mà không nạp cả file vào RAM

### Bài tập 2: Iterator class

Viết class `Range2D(rows, cols)` có thể dùng trong `for`, trả về các tuple `(r, c)`. Viết 2 phiên bản: dùng `__next__` và dùng `__iter__` là generator.

### Bài tập 3: Decorators

1. `@debug`: in tên hàm, tham số, kết quả trả về
2. `@validate_positive`: raise `ValueError` nếu có tham số số nào âm
3. `@rate_limit(calls=3)`: chỉ cho phép gọi hàm tối đa 3 lần, lần thứ 4 raise lỗi
4. `@cache` tự viết (không dùng `lru_cache`) dùng dict và closure

### Bài tập 4: Context managers

1. `Indenter`: mỗi lần lồng `with` thì in thụt lề thêm một mức
2. `@contextmanager` `temporary_file(content)`: tạo file tạm, yield đường dẫn, tự xóa khi xong

### Bài tập 5: Asyncio

Viết chương trình giả lập tải 10 file, mỗi file mất ngẫu nhiên 0.1-0.5 giây (`asyncio.sleep`). So sánh thời gian tải tuần tự và đồng thời. Bonus: dùng `asyncio.Semaphore(3)` để giới hạn tối đa 3 file tải cùng lúc.

<details>
<summary>💡 Xem đáp án Bài tập 1.2 và 3.4</summary>

```python
from functools import wraps


def chunked(items, size):
    for start in range(0, len(items), size):
        yield items[start:start + size]


print(list(chunked([1, 2, 3, 4, 5], 2)))
# Output: [[1, 2], [3, 4], [5]]


def cache(func):
    memory = {}                         # Closure giữ bộ nhớ đệm

    @wraps(func)
    def wrapper(*args):
        if args not in memory:
            memory[args] = func(*args)
        return memory[args]
    return wrapper


@cache
def fib(n):
    return n if n < 2 else fib(n - 1) + fib(n - 2)


print(fib(80))
# Output: 23416728348467685
```

</details>

## ✅ Checklist hoàn thành

- [ ] Phân biệt iterable và iterator, dùng `iter()` và `next()`
- [ ] Hiểu vòng `for` hoạt động thế nào bên dưới
- [ ] Viết generator với `yield`, hiểu cơ chế "tạm dừng - chạy tiếp"
- [ ] Giải thích được tại sao generator tiết kiệm bộ nhớ
- [ ] Dùng generator expression và ghép pipeline
- [ ] Giải thích closure và bẫy closure trong vòng lặp
- [ ] Viết decorator có `*args, **kwargs`, `return` và `@wraps`
- [ ] Viết decorator có tham số (3 tầng hàm)
- [ ] Viết context manager bằng class và bằng `@contextmanager`
- [ ] Dùng `async`/`await`, `asyncio.run`, `asyncio.gather`
- [ ] Biết khi nào nên và không nên dùng asyncio
- [ ] Hoàn thành ít nhất 3 bài tập

## 🚀 Tiếp theo

Chúc mừng! 🎉 Bạn đã đi qua toàn bộ kiến thức cốt lõi của Python - từ biến đầu tiên đến decorator và asyncio. Đã đến lúc **kết hợp tất cả** vào một dự án thực tế hoàn chỉnh, có cấu trúc chuyên nghiệp và có test.

**Bài tiếp theo**: [Dự án cuối khóa - Ứng dụng Todo CLI](./10-final-project.md)

---

💡 **Tips nhớ lâu**:

- **Iterator chỉ dùng được một lần** - iterable thì dùng lại được
- **`yield` = trả ra và tạm dừng**; generator = tiết kiệm bộ nhớ
- **Closure nhớ biến, không nhớ giá trị**
- **Decorator = hàm nhận hàm, trả về hàm** - luôn `@wraps` và `return`
- **Có tài nguyên cần dọn dẹp → context manager**
- **asyncio cho chờ I/O**, không phải cho tính toán nặng
