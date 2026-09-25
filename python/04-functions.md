# 📚 Bài 4: Hàm (Functions)

## 🎯 Mục tiêu bài học

- Hiểu tại sao cần hàm và cách định nghĩa hàm với `def`
- Phân biệt **parameter** (tham số) và **argument** (đối số)
- Trả về một hoặc nhiều giá trị với `return`
- Dùng tham số mặc định và tránh **bẫy mutable default**
- Dùng positional, keyword, `*args`, `**kwargs`, keyword-only và positional-only
- Viết hàm ẩn danh `lambda` và dùng với `sorted`, `map`, `filter`
- Hiểu **scope** (phạm vi biến) theo quy tắc **LEGB**, dùng `global` và `nonlocal`
- Viết **docstring** và **type hints** chuẩn
- Hiểu và viết hàm **đệ quy** (recursion)

## 📖 1. Hàm là gì và tại sao cần hàm?

### Vấn đề: code lặp lại

```python
# Tính diện tích 3 hình chữ nhật - code lặp lại
width1, height1 = 5, 3
print(f"Diện tích: {width1 * height1} m²")

width2, height2 = 8, 2
print(f"Diện tích: {width2 * height2} m²")

width3, height3 = 4, 4
print(f"Diện tích: {width3 * height3} m²")
```

Nếu muốn đổi đơn vị từ `m²` sang `cm²`, bạn phải sửa **3 chỗ**. Nếu có 100 chỗ thì sao?

### Giải pháp: hàm

```python
def print_area(width, height):
    """In diện tích hình chữ nhật."""
    print(f"Diện tích: {width * height} m²")


print_area(5, 3)
print_area(8, 2)
print_area(4, 4)
# Output:
# Diện tích: 15 m²
# Diện tích: 16 m²
# Diện tích: 16 m²
```

> 🧠 **Ví dụ dễ hiểu**: Hàm giống như **một chiếc máy xay sinh tố**. Bạn cho nguyên liệu vào (input/tham số), máy xử lý theo cách đã thiết kế sẵn, và trả ra ly sinh tố (output/giá trị trả về). Bạn không cần biết bên trong máy hoạt động thế nào - chỉ cần biết cho gì vào và nhận lại gì.

### Lợi ích của hàm

- **DRY** (Don't Repeat Yourself): viết một lần, dùng nhiều lần
- **Dễ sửa**: sửa một chỗ, mọi nơi gọi hàm đều được cập nhật
- **Dễ đọc**: `calculate_tax(salary)` dễ hiểu hơn 10 dòng tính toán
- **Dễ test**: kiểm tra từng hàm riêng lẻ
- **Chia nhỏ vấn đề**: bài toán lớn → nhiều hàm nhỏ

## 📖 2. Định nghĩa và gọi hàm

### Cú pháp

```python
def function_name(parameter1, parameter2):
    """Docstring: mô tả hàm làm gì (tùy chọn nhưng nên có)."""
    # Thân hàm (thụt lề 4 dấu cách)
    result = parameter1 + parameter2
    return result                       # Trả kết quả về (tùy chọn)


# Gọi hàm
total = function_name(3, 4)
print(total)
# Output: 7
```

- `def`: từ khóa định nghĩa hàm (define)
- `function_name`: tên hàm, đặt theo `snake_case`, nên là **động từ**: `get_user`, `calculate_total`, `send_email`
- `(parameter1, parameter2)`: danh sách tham số
- `return`: trả giá trị về cho nơi gọi hàm

> ⚠️ Hàm phải được **định nghĩa trước khi gọi** (tính theo thứ tự chạy). Gọi hàm ở dòng trên `def` sẽ báo `NameError`.

### Parameter vs Argument

```python
def greet(name):        # name là PARAMETER (tham số) - "chỗ trống" trong định nghĩa
    print(f"Xin chào, {name}!")


greet("Mai")            # "Mai" là ARGUMENT (đối số) - giá trị thật truyền vào
# Output: Xin chào, Mai!
```

> 🧠 Parameter giống **ô trống trong tờ đơn** ("Họ tên: ______"), argument là **nội dung bạn điền vào** ("Nguyễn Mai").

### print vs return - Sự khác biệt quan trọng

Đây là điểm người mới **hay nhầm lẫn nhất**:

```python
def add_print(a, b):
    print(a + b)            # Chỉ HIỂN THỊ lên màn hình


def add_return(a, b):
    return a + b            # TRẢ giá trị về để dùng tiếp


x = add_print(2, 3)         # In ra 5, nhưng x = None!
# Output: 5
y = add_return(2, 3)        # Không in gì, y = 5

print(x, y)
# Output: None 5

print(add_return(2, 3) * 10)        # ✅ Dùng kết quả để tính tiếp
# Output: 50
# add_print(2, 3) * 10              # ❌ TypeError: None * 10
```

> 🧠 **Ví dụ dễ hiểu**: `print` giống như đầu bếp **khoe món ăn qua cửa kính** - bạn nhìn thấy nhưng không ăn được. `return` là đầu bếp **đưa món ăn cho bạn** - bạn có thể ăn, mang về, chia cho người khác.

### return kết thúc hàm ngay lập tức

```python
def check_age(age):
    if age < 0:
        return "Tuổi không hợp lệ"      # Thoát hàm ngay tại đây
    if age < 18:
        return "Vị thành niên"
    return "Người trưởng thành"
    print("Dòng này không bao giờ chạy")  # Dead code


print(check_age(-5))
# Output: Tuổi không hợp lệ
print(check_age(30))
# Output: Người trưởng thành
```

### Hàm không có return trả về None

```python
def do_nothing():
    pass


print(do_nothing())
# Output: None
```

## 📖 3. Trả về nhiều giá trị

Python cho phép `return` nhiều giá trị cùng lúc - thực chất là trả về **một tuple**:

```python
def get_min_max(numbers):
    return min(numbers), max(numbers)   # Trả về tuple (min, max)


result = get_min_max([4, 1, 9, 7])
print(result)
# Output: (1, 9)
print(type(result))
# Output: <class 'tuple'>

# Unpacking: tách tuple ra từng biến - cách dùng phổ biến nhất
lowest, highest = get_min_max([4, 1, 9, 7])
print(f"Nhỏ nhất: {lowest}, lớn nhất: {highest}")
# Output: Nhỏ nhất: 1, lớn nhất: 9

# Bỏ qua giá trị không cần bằng _
_, highest = get_min_max([4, 1, 9, 7])
print(highest)
# Output: 9
```

Ví dụ thực tế:

```python
def analyze_scores(scores):
    """Trả về (trung bình, số đậu, số rớt)."""
    average = sum(scores) / len(scores)
    passed = sum(1 for s in scores if s >= 5)   # Đếm số điểm >= 5 (cú pháp này học ở Bài 5)
    failed = len(scores) - passed
    return average, passed, failed


avg, n_pass, n_fail = analyze_scores([8, 4.5, 6, 9, 3])
print(f"TB: {avg:.2f} | Đậu: {n_pass} | Rớt: {n_fail}")
# Output: TB: 6.10 | Đậu: 3 | Rớt: 2
```

> 💡 Khi trả về nhiều hơn 3 giá trị, nên cân nhắc trả về **dict**, **namedtuple** ([Bài 5](./05-data-structures.md)) hoặc **dataclass** ([Bài 6](./06-oop.md)) để code dễ đọc hơn.

## 📖 4. Các cách truyền đối số

### Positional arguments (theo vị trí)

Đối số được gán cho tham số **theo thứ tự**:

```python
def describe_pet(animal, name):
    print(f"Tôi có một con {animal} tên là {name}")


describe_pet("mèo", "Mướp")
# Output: Tôi có một con mèo tên là Mướp
describe_pet("Mướp", "mèo")         # ❌ Sai thứ tự → sai nghĩa
# Output: Tôi có một con Mướp tên là mèo
```

### Keyword arguments (theo tên)

Chỉ rõ tên tham số → **không cần nhớ thứ tự**, code dễ đọc hơn:

```python
def describe_pet(animal, name):
    print(f"Tôi có một con {animal} tên là {name}")


describe_pet(name="Lu", animal="chó")
# Output: Tôi có một con chó tên là Lu

# Có thể trộn: positional TRƯỚC, keyword SAU
describe_pet("vẹt", name="Kiki")
# Output: Tôi có một con vẹt tên là Kiki
# describe_pet(name="Kiki", "vẹt")   # ❌ SyntaxError: positional argument follows keyword argument
```

### Default parameters (tham số mặc định)

```python
def make_coffee(size="vừa", sugar=True, milk=False):
    desc = f"Cà phê size {size}"
    if sugar:
        desc += ", có đường"
    if milk:
        desc += ", có sữa"
    return desc


print(make_coffee())
# Output: Cà phê size vừa, có đường
print(make_coffee("lớn"))
# Output: Cà phê size lớn, có đường
print(make_coffee(milk=True))                   # Chỉ đổi milk, giữ mặc định còn lại
# Output: Cà phê size vừa, có đường, có sữa
print(make_coffee("nhỏ", sugar=False, milk=True))
# Output: Cà phê size nhỏ, có sữa
```

> ⚠️ Tham số có giá trị mặc định phải đứng **sau** tham số không có mặc định: `def f(a, b=1)` ✅, `def f(a=1, b)` ❌ SyntaxError.

### ⚠️ Bẫy kinh điển: Mutable default argument

Đây là một trong những "cú lừa" nổi tiếng nhất của Python:

```python
def add_item(item, cart=[]):        # ❌ List làm giá trị mặc định
    cart.append(item)
    return cart


print(add_item("táo"))
# Output: ['táo']
print(add_item("cam"))              # Mong đợi ['cam'] nhưng...
# Output: ['táo', 'cam']
print(add_item("xoài"))
# Output: ['táo', 'cam', 'xoài']
```

**Tại sao?** Giá trị mặc định được tạo **MỘT LẦN DUY NHẤT** khi Python đọc dòng `def`, **không phải** mỗi lần gọi hàm. Mọi lần gọi mà không truyền `cart` đều **dùng chung một list**.

> 🧠 **Ví dụ dễ hiểu**: Giống như quán cà phê chỉ có **một cái giỏ hàng mặc định** đặt ở quầy. Khách nào không mang giỏ riêng thì đều bỏ đồ vào cái giỏ chung đó - và khách sau thấy luôn đồ của khách trước!

```python
# Chứng minh: giá trị mặc định được lưu trong thuộc tính của hàm
def add_item(item, cart=[]):
    cart.append(item)
    return cart


add_item("táo")
add_item("cam")
print(add_item.__defaults__)
# Output: (['táo', 'cam'],)
```

**Cách sửa chuẩn**: dùng `None` làm mặc định, tạo list mới bên trong hàm:

```python
def add_item(item, cart=None):      # ✅
    if cart is None:
        cart = []                   # Tạo list MỚI mỗi lần gọi
    cart.append(item)
    return cart


print(add_item("táo"))
# Output: ['táo']
print(add_item("cam"))
# Output: ['cam']

my_cart = ["sữa"]
print(add_item("bánh", my_cart))    # Vẫn dùng được với list truyền vào
# Output: ['sữa', 'bánh']
```

> ✅ **Quy tắc**: **Không bao giờ** dùng `list`, `dict`, `set` (kiểu **mutable** - có thể thay đổi) làm giá trị mặc định. Dùng `None` rồi tạo mới bên trong. Số, chuỗi, tuple, `None` (kiểu **immutable**) thì an toàn.

## 📖 5. *args và **kwargs

### *args - Nhận số lượng đối số vị trí bất kỳ

```python
def total(*args):
    print(f"args = {args}, kiểu: {type(args).__name__}")
    return sum(args)


print(total(1, 2))
# Output:
# args = (1, 2), kiểu: tuple
# 3
print(total(1, 2, 3, 4, 5))
# Output:
# args = (1, 2, 3, 4, 5), kiểu: tuple
# 15
print(total())
# Output:
# args = (), kiểu: tuple
# 0
```

- Dấu `*` gom **tất cả đối số vị trí thừa** vào một **tuple**
- Tên `args` chỉ là quy ước, có thể đặt `*numbers`, `*names`...

### **kwargs - Nhận số lượng đối số keyword bất kỳ

```python
def build_profile(name, **kwargs):
    print(f"kwargs = {kwargs}")
    profile = {"name": name}
    profile.update(kwargs)
    return profile


user = build_profile("An", age=25, city="Đà Nẵng", job="Developer")
# Output: kwargs = {'age': 25, 'city': 'Đà Nẵng', 'job': 'Developer'}
print(user)
# Output: {'name': 'An', 'age': 25, 'city': 'Đà Nẵng', 'job': 'Developer'}
```

- Dấu `**` gom **tất cả đối số keyword thừa** vào một **dict** - kiểu dữ liệu lưu các cặp `key: value` (bạn đã thấy ở `match` Bài 3, sẽ học kỹ ở [Bài 5](./05-data-structures.md))

### Kết hợp tất cả

Thứ tự bắt buộc: **tham số thường → `*args` → keyword-only → `**kwargs`**

```python
def log(level, *messages, sep=" | ", **metadata):
    text = sep.join(messages)
    # Ghép từng cặp key=value của dict metadata (dict & .items() học kỹ ở Bài 5)
    meta = ", ".join(f"{k}={v}" for k, v in metadata.items())
    print(f"[{level}] {text} ({meta})")


log("INFO", "Server started", "Port 8000", user="admin", pid=42)
# Output: [INFO] Server started | Port 8000 (user=admin, pid=42)
```

### Unpacking khi gọi hàm: * và **

Dấu `*` và `**` cũng dùng được **khi gọi hàm** - làm điều ngược lại: "mở gói" list/dict ra thành các đối số:

```python
def create_point(x, y, z):
    return f"Point({x}, {y}, {z})"


coords = [1, 2, 3]
print(create_point(*coords))          # Tương đương create_point(1, 2, 3)
# Output: Point(1, 2, 3)

config = {"x": 10, "y": 20, "z": 30}
print(create_point(**config))         # Tương đương create_point(x=10, y=20, z=30)
# Output: Point(10, 20, 30)

# print(*list) - mẹo hay để in các phần tử cách nhau
print(*["a", "b", "c"], sep=" → ")
# Output: a → b → c
```

> 🧠 **Ví dụ dễ hiểu**: Trong **định nghĩa** hàm, `*` là **cái túi gom đồ**. Khi **gọi** hàm, `*` là **đổ túi ra**.

### Keyword-only arguments

Tham số đứng **sau `*`** (hoặc sau `*args`) **bắt buộc** phải truyền bằng tên:

```python
def transfer(amount, *, from_account, to_account):
    return f"Chuyển {amount:,}đ từ {from_account} sang {to_account}"


print(transfer(500_000, from_account="A001", to_account="B002"))
# Output: Chuyển 500,000đ từ A001 sang B002

try:
    transfer(500_000, "A001", "B002")       # ❌ Không cho truyền theo vị trí
except TypeError as error:
    print(error)
# Output: transfer() takes 1 positional argument but 3 were given
```

**Tại sao cần?** Với những tham số dễ nhầm thứ tự (như tài khoản gửi/nhận), bắt buộc ghi tên giúp **tránh lỗi nghiêm trọng** và code dễ đọc hơn.

### Positional-only arguments (Python 3.8+)

Tham số đứng **trước `/`** chỉ được truyền theo vị trí:

```python
def power(base, exponent, /):
    return base ** exponent


print(power(2, 10))
# Output: 1024
try:
    power(base=2, exponent=10)
except TypeError as error:
    print("Lỗi:", error)
# Output: Lỗi: power() got some positional-only arguments passed as keyword arguments: 'base, exponent'
```

Nhiều hàm có sẵn dùng cách này, ví dụ `len(obj, /)` - bạn không thể gọi `len(obj=[1, 2])`.

### Tổng kết cú pháp tham số

```text
def f(pos_only, /, normal, *args, kw_only, **kwargs):
       │              │       │       │         └─ keyword thừa → dict
       │              │       │       └─ bắt buộc truyền bằng tên
       │              │       └─ positional thừa → tuple
       │              └─ vị trí hoặc tên đều được
       └─ chỉ được truyền theo vị trí
```

## 📖 6. Lambda - Hàm ẩn danh

### Cú pháp

```text
lambda tham_số: biểu_thức
```

`lambda` tạo một hàm **nhỏ, không tên, chỉ gồm một biểu thức** (tự động return kết quả):

```python
# Hàm thường
def square(x):
    return x * x


# Lambda tương đương
square_lambda = lambda x: x * x

print(square(5), square_lambda(5))
# Output: 25 25

add = lambda a, b: a + b
print(add(3, 4))
# Output: 7
```

> ⚠️ PEP 8 khuyên **không gán lambda vào biến** như trên (dùng `def` thay thế). Lambda tỏa sáng khi được **truyền trực tiếp vào hàm khác**.

### Lambda với sorted(), min(), max()

Tham số `key` nhận một hàm, dùng để quyết định "so sánh theo tiêu chí gì":

```python
students = [("An", 8.5), ("Bình", 9.2), ("Chi", 7.8)]

# Sắp xếp theo điểm (phần tử thứ 2 của tuple)
by_score = sorted(students, key=lambda s: s[1])
print(by_score)
# Output: [('Chi', 7.8), ('An', 8.5), ('Bình', 9.2)]

# Giảm dần
print(sorted(students, key=lambda s: s[1], reverse=True))
# Output: [('Bình', 9.2), ('An', 8.5), ('Chi', 7.8)]

# Người điểm cao nhất
print(max(students, key=lambda s: s[1]))
# Output: ('Bình', 9.2)

# Sắp xếp chuỗi theo độ dài, rồi theo alphabet (key trả về tuple)
words = ["kiwi", "táo", "chuối", "na", "cam"]
print(sorted(words, key=lambda w: (len(w), w)))
# Output: ['na', 'cam', 'táo', 'kiwi', 'chuối']
```

### Lambda với map() và filter()

```python
numbers = [1, 2, 3, 4, 5, 6]

# map: áp dụng hàm cho TỪNG phần tử
squares = list(map(lambda x: x ** 2, numbers))
print(squares)
# Output: [1, 4, 9, 16, 25, 36]

# filter: giữ lại phần tử thỏa điều kiện
evens = list(filter(lambda x: x % 2 == 0, numbers))
print(evens)
# Output: [2, 4, 6]

# map với hàm có sẵn
print(list(map(int, ["1", "2", "3"])))
# Output: [1, 2, 3]
print(list(map(str.upper, ["a", "b"])))
# Output: ['A', 'B']
```

> 💡 Trong Python, **list comprehension** ([Bài 5](./05-data-structures.md)) thường dễ đọc hơn `map`/`filter` + lambda:
> `[x ** 2 for x in numbers]` thay cho `list(map(lambda x: x ** 2, numbers))`

### Hàm là "first-class object"

Trong Python, hàm cũng là một **giá trị** như số hay chuỗi: có thể gán vào biến, truyền vào hàm khác, trả về từ hàm:

```python
def shout(text):
    return text.upper() + "!"


def whisper(text):
    return text.lower() + "..."


def speak(func, message):       # Nhận HÀM làm tham số
    return func(message)


print(speak(shout, "Xin chào"))
# Output: XIN CHÀO!
print(speak(whisper, "Xin chào"))
# Output: xin chào...

# Lưu hàm trong dict - thay thế if/elif dài
operations = {
    "+": lambda a, b: a + b,
    "-": lambda a, b: a - b,
    "*": lambda a, b: a * b,
}
print(operations["*"](6, 7))
# Output: 42
```

Đây là nền tảng cho **decorator** và **closure** mà bạn sẽ học ở [Bài 9](./09-advanced-python.md).

## 📖 7. Scope - Phạm vi của biến

### Biến cục bộ (local) và toàn cục (global)

```python
message = "Tôi là biến global"      # Global: khai báo ngoài mọi hàm


def my_function():
    local_var = "Tôi là biến local"  # Local: chỉ tồn tại trong hàm
    print(message)                  # ✅ Đọc được biến global
    print(local_var)


my_function()
# Output:
# Tôi là biến global
# Tôi là biến local

try:
    print(local_var)                # ❌ Biến local không tồn tại bên ngoài
except NameError as error:
    print("NameError:", error)
# Output: NameError: name 'local_var' is not defined
```

> 🧠 **Ví dụ dễ hiểu**: Hàm giống như **một căn phòng có cửa sổ một chiều**. Người trong phòng (code trong hàm) nhìn ra ngoài thấy được đồ vật ngoài sân (biến global). Nhưng người ngoài sân không nhìn thấy đồ trong phòng (biến local). Khi hàm chạy xong, căn phòng bị "dọn sạch".

### Quy tắc LEGB

Khi gặp một tên biến, Python tìm theo thứ tự **L → E → G → B**, dừng ở chỗ tìm thấy **đầu tiên**:

| Chữ | Scope | Mô tả |
| --- | --- | --- |
| **L** | Local | Bên trong hàm hiện tại |
| **E** | Enclosing | Bên trong hàm "bao ngoài" (khi có hàm lồng hàm) |
| **G** | Global | Cấp cao nhất của file (module) |
| **B** | Built-in | Các tên có sẵn của Python: `print`, `len`, `sum`... |

```python
x = "global"                    # G


def outer():
    x = "enclosing"             # E (đối với inner)

    def inner():
        x = "local"             # L
        print("inner:", x)

    inner()
    print("outer:", x)


outer()
print("module:", x)
# Output:
# inner: local
# outer: enclosing
# module: global
```

Nếu xóa `x = "local"` trong `inner`, Python sẽ tìm lên Enclosing và in `inner: enclosing`.

### Shadowing - Biến local "che" biến global

```python
count = 10


def show():
    count = 99          # Tạo biến local MỚI tên count, KHÔNG sửa biến global
    print("Trong hàm:", count)


show()
print("Ngoài hàm:", count)
# Output:
# Trong hàm: 99
# Ngoài hàm: 10
```

### UnboundLocalError - Lỗi khó hiểu nhất với người mới

```python
counter = 0


def increment():
    try:
        counter += 1        # ❌ counter = counter + 1
    except UnboundLocalError as error:
        print("Lỗi:", error)


increment()
# Output: Lỗi: cannot access local variable 'counter' where it is not associated with a value
```

**Tại sao?** Vì có phép gán `counter = ...` trong hàm, Python quyết định (ngay lúc đọc hàm) rằng `counter` là biến **local**. Nhưng khi chạy `counter + 1`, biến local đó chưa có giá trị → lỗi.

### Từ khóa global

```python
counter = 0


def increment():
    global counter          # "Tôi muốn dùng biến counter ở scope global"
    counter += 1


increment()
increment()
print(counter)
# Output: 2
```

> ⚠️ **Hạn chế dùng `global`!** Hàm sửa biến global rất khó theo dõi và test (ai đã sửa biến này? lúc nào?). Cách tốt hơn: **truyền vào qua tham số và trả về qua return**:

```python
def increment(value):       # ✅ Hàm "thuần" (pure function): không phụ thuộc bên ngoài
    return value + 1


counter = 0
counter = increment(counter)
counter = increment(counter)
print(counter)
# Output: 2
```

### Từ khóa nonlocal

`nonlocal` dùng để sửa biến ở scope **Enclosing** (hàm bao ngoài):

```python
def make_counter():
    count = 0

    def increment():
        nonlocal count      # Sửa biến count của make_counter
        count += 1
        return count

    return increment        # Trả về HÀM inner


counter_a = make_counter()
print(counter_a())
# Output: 1
print(counter_a())
# Output: 2

counter_b = make_counter()  # Một bộ đếm độc lập
print(counter_b())
# Output: 1
```

Đây chính là **closure** - hàm "nhớ" môi trường nơi nó được tạo ra. Chúng ta sẽ đào sâu ở [Bài 9](./09-advanced-python.md).

## 📖 8. Docstring và Type Hints

### Docstring - Tài liệu cho hàm

Docstring là chuỗi **ngay dòng đầu tiên** trong thân hàm, mô tả hàm làm gì:

```python
def calculate_bmi(weight_kg, height_m):
    """Tính chỉ số BMI (Body Mass Index).

    Args:
        weight_kg: Cân nặng tính bằng kilogram.
        height_m: Chiều cao tính bằng mét.

    Returns:
        Chỉ số BMI, làm tròn 1 chữ số thập phân.

    Raises:
        ValueError: Nếu chiều cao <= 0.

    Example:
        >>> calculate_bmi(70, 1.75)
        22.9
    """
    if height_m <= 0:
        raise ValueError("Chiều cao phải lớn hơn 0")   # raise: chủ động báo lỗi (Bài 7)
    return round(weight_kg / height_m ** 2, 1)


print(calculate_bmi(70, 1.75))
# Output: 22.9

# Xem docstring
print(calculate_bmi.__doc__.splitlines()[0])
# Output: Tính chỉ số BMI (Body Mass Index).
# help(calculate_bmi)       # Hiển thị toàn bộ docstring đẹp mắt
```

> 💡 Format ở trên là **Google style** - một trong những phong cách docstring phổ biến nhất. VS Code sẽ hiển thị docstring khi bạn di chuột qua tên hàm.

### Type hints - Gợi ý kiểu dữ liệu

Từ Python 3.5+, bạn có thể **ghi chú kiểu** cho tham số và giá trị trả về:

```python
def greet(name: str, times: int = 1) -> str:
    return (f"Xin chào {name}! " * times).strip()


def average(numbers: list[float]) -> float:        # list[float] cần Python 3.9+
    return sum(numbers) / len(numbers)


def find_user(user_id: int) -> str | None:         # "str hoặc None" - cần Python 3.10+
    users = {1: "An", 2: "Bình"}
    return users.get(user_id)


print(greet("Nam", 2))
# Output: Xin chào Nam! Xin chào Nam!
print(average([7.5, 8.0, 9.5]))
# Output: 8.333333333333334
print(find_user(3))
# Output: None
```

Các kiểu hay dùng:

| Type hint | Ý nghĩa |
| --- | --- |
| `int`, `float`, `str`, `bool` | Kiểu cơ bản |
| `list[int]` | List chứa các số nguyên |
| `dict[str, int]` | Dict có key là str, value là int |
| `tuple[int, str]` | Tuple gồm đúng 1 int và 1 str |
| `str \| None` | Chuỗi hoặc None |
| `-> None` | Hàm không trả về gì |

### ⚠️ Type hints KHÔNG được kiểm tra khi chạy!

```python
def double(x: int) -> int:
    return x * 2


print(double("ha"))         # Python vẫn chạy bình thường, không báo lỗi!
# Output: haha
```

**Vậy type hints để làm gì?**

- **Tài liệu**: nhìn là biết hàm nhận gì, trả gì
- **Editor thông minh hơn**: VS Code/Pylance gợi ý method chính xác, **gạch đỏ** khi truyền sai kiểu
- **Công cụ kiểm tra tĩnh** như `mypy` phát hiện lỗi **trước khi chạy** (học ở [Bài 8](./08-modules-packages.md))

> ✅ Khuyến nghị: Thêm type hints cho mọi hàm bạn viết trong project thật. Đó là thói quen của lập trình viên chuyên nghiệp.

## 📖 9. Đệ quy (Recursion)

### Đệ quy là gì?

**Đệ quy** là khi một hàm **gọi chính nó**. Mỗi hàm đệ quy cần 2 phần:

1. **Base case** (trường hợp cơ sở): điều kiện **dừng** - bài toán đủ nhỏ để trả lời ngay
2. **Recursive case** (trường hợp đệ quy): chia bài toán thành bài toán **nhỏ hơn** và gọi lại chính hàm đó

> 🧠 **Ví dụ dễ hiểu**: Bạn đứng xếp hàng và muốn biết mình đứng thứ mấy. Bạn hỏi người phía trước: "Bạn đứng thứ mấy?". Người đó lại hỏi người trước nữa... cho đến người **đầu tiên** trả lời "Tôi đứng thứ 1" (base case). Sau đó câu trả lời truyền ngược lại: "thứ 2", "thứ 3"... đến bạn.

### Ví dụ: Giai thừa

`n! = n × (n-1) × ... × 1`, và `0! = 1`

Nhận xét: `5! = 5 × 4!`, `4! = 4 × 3!`... → bài toán lớn chứa bài toán nhỏ hơn cùng dạng.

```python
def factorial(n: int) -> int:
    if n <= 1:                      # Base case
        return 1
    return n * factorial(n - 1)     # Recursive case


print(factorial(5))
# Output: 120
```

Quá trình chạy `factorial(5)`:

```text
factorial(5)
= 5 * factorial(4)
= 5 * (4 * factorial(3))
= 5 * (4 * (3 * factorial(2)))
= 5 * (4 * (3 * (2 * factorial(1))))
= 5 * (4 * (3 * (2 * 1)))          ← chạm base case, bắt đầu "quay về"
= 120
```

### Ví dụ: Tính tổng các chữ số

```python
def digit_sum(n: int) -> int:
    if n < 10:                          # Base case: chỉ còn 1 chữ số
        return n
    return n % 10 + digit_sum(n // 10)  # Chữ số cuối + tổng các chữ số còn lại


print(digit_sum(2026))
# Output: 10
```

### Ví dụ: Duyệt cấu trúc lồng nhau

Đệ quy thực sự hữu ích với dữ liệu **dạng cây** (thư mục, JSON lồng nhau, menu nhiều cấp):

```python
def flatten(items: list) -> list:
    """Làm phẳng list lồng nhau bất kỳ cấp."""
    result = []
    for item in items:
        if isinstance(item, list):
            result.extend(flatten(item))    # Gặp list con → đệ quy
        else:
            result.append(item)
    return result


print(flatten([1, [2, 3], [4, [5, [6, 7]]], 8]))
# Output: [1, 2, 3, 4, 5, 6, 7, 8]
```

### Giới hạn đệ quy

```python
import sys

print(sys.getrecursionlimit())      # Mặc định khoảng 1000
# Output: 1000


def infinite(n):
    return infinite(n + 1)          # ❌ Không có base case!


try:
    infinite(0)
except RecursionError as error:
    print("RecursionError:", error)
# Output: RecursionError: maximum recursion depth exceeded
```

### Đệ quy vs Vòng lặp

Fibonacci đệ quy "ngây thơ" rất **chậm** vì tính lại cùng một giá trị nhiều lần:

```python
from functools import lru_cache


def fib_slow(n):
    if n < 2:
        return n
    return fib_slow(n - 1) + fib_slow(n - 2)    # Mỗi lần gọi tách thành 2 → bùng nổ


@lru_cache(maxsize=None)            # Decorator ghi nhớ kết quả đã tính (Bài 9)
def fib_fast(n):
    if n < 2:
        return n
    return fib_fast(n - 1) + fib_fast(n - 2)


def fib_loop(n):                    # Dùng vòng lặp - nhanh, không lo giới hạn đệ quy
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a


print(fib_slow(20), fib_fast(20), fib_loop(20))
# Output: 6765 6765 6765
print(fib_fast(100))
# Output: 354224848179261915075
```

> 💡 **Khi nào dùng đệ quy?** Khi dữ liệu/bài toán có cấu trúc **tự lặp lại** (cây thư mục, JSON lồng nhau, thuật toán chia để trị). Với bài toán tuyến tính đơn giản (tổng, giai thừa), **vòng lặp** thường nhanh và an toàn hơn trong Python.

## 🌍 Ứng dụng thực tế

Trong dự án thật, những đoạn logic như kiểm tra dữ liệu hay tính tiền luôn được đóng gói thành **hàm nhỏ, có docstring và type hints** để dùng lại ở nhiều nơi (form đăng ký, API, script import dữ liệu...).

### 1. Kiểm tra mật khẩu và email khi đăng ký

Thay vì trả về `True/False`, hàm `check_password` trả về **danh sách lỗi** - giao diện có thể hiện cho người dùng biết cần sửa gì:

```python
# validators.py - Kiểm tra mật khẩu và email khi đăng ký tài khoản
SPECIAL_CHARS = "!@#$%^&*()-_=+[]{};:,.?/"


def check_password(password: str, *, min_length: int = 8) -> list[str]:
    """Trả về danh sách lỗi của mật khẩu. List rỗng = mật khẩu hợp lệ."""
    errors = []
    if len(password) < min_length:
        errors.append(f"cần ít nhất {min_length} ký tự")
    # any(...): True nếu có ÍT NHẤT 1 ký tự thỏa mãn (đã gặp ở Bài 3)
    if not any(ch.isupper() for ch in password):
        errors.append("cần ít nhất 1 chữ HOA")
    if not any(ch.islower() for ch in password):
        errors.append("cần ít nhất 1 chữ thường")
    if not any(ch.isdigit() for ch in password):
        errors.append("cần ít nhất 1 chữ số")
    if not any(ch in SPECIAL_CHARS for ch in password):
        errors.append("cần ít nhất 1 ký tự đặc biệt")
    if " " in password:
        errors.append("không được chứa khoảng trắng")
    return errors


def is_valid_email(email: str) -> bool:
    """Kiểm tra email ở mức cơ bản (regex chuẩn hơn sẽ học ở Bài 11)."""
    email = email.strip()
    if email.count("@") != 1 or " " in email:
        return False                            # Guard clause: loại sớm trường hợp sai
    local, domain = email.split("@")
    if not local or "." not in domain:
        return False
    return not domain.startswith(".") and not domain.endswith(".")


def password_strength(password: str) -> str:
    """Đánh giá độ mạnh - tái sử dụng check_password (hàm gọi hàm)."""
    problems = len(check_password(password))
    if problems == 0 and len(password) >= 12:
        return "💪 Mạnh"
    if problems <= 1:
        return "👌 Khá"
    return "⚠️ Yếu"


for pwd in ["abc123", "Python2026", "Python@2026", "Ma Khau#1", "Hoc#Python2026"]:
    errors = check_password(pwd)
    status = "✅ OK" if not errors else "❌ " + "; ".join(errors)
    print(f"{pwd!r:<17} {password_strength(pwd):<8} {status}")

for email in ["an.nguyen@gmail.com", "binh@@mail.com", "chi@localhost", " dung@company.vn "]:
    print(f"{email.strip():<20} → {'hợp lệ' if is_valid_email(email) else 'KHÔNG hợp lệ'}")

# Output:
# 'abc123'          ⚠️ Yếu   ❌ cần ít nhất 8 ký tự; cần ít nhất 1 chữ HOA; cần ít nhất 1 ký tự đặc biệt
# 'Python2026'      👌 Khá    ❌ cần ít nhất 1 ký tự đặc biệt
# 'Python@2026'     👌 Khá    ✅ OK
# 'Ma Khau#1'       👌 Khá    ❌ không được chứa khoảng trắng
# 'Hoc#Python2026'  💪 Mạnh   ✅ OK
# an.nguyen@gmail.com  → hợp lệ
# binh@@mail.com       → KHÔNG hợp lệ
# chi@localhost        → KHÔNG hợp lệ
# dung@company.vn      → hợp lệ
```

> 💡 Để ý `check_password(password, *, min_length=8)`: `min_length` là **keyword-only**, nên khi đổi chính sách chỉ cần gọi `check_password(pwd, min_length=12)` - code gọi hàm đọc là hiểu ngay.

### 2. Tính lãi vay trả góp

Mua xe, mua điện thoại trả góp: cùng "lãi 12%/năm" nhưng **cách tính khác nhau** thì số tiền phải trả chênh lệch rất nhiều. Viết hàm để tự kiểm chứng:

```python
# loan.py - Tính tiền trả góp khi vay mua xe / điện thoại
# So sánh 2 cách tính lãi phổ biến ở Việt Nam:
#   - Dư nợ giảm dần: lãi tính trên số tiền CÒN NỢ (ngân hàng thường dùng)
#   - Lãi phẳng (flat): lãi tính trên số tiền vay BAN ĐẦU suốt kỳ hạn (hay gặp ở vay tiêu dùng)


def monthly_payment(principal: float, annual_rate: float, months: int) -> float:
    """Số tiền trả ĐỀU mỗi tháng theo dư nợ giảm dần (công thức niên kim).

    annual_rate: lãi suất năm, ví dụ 0.12 = 12%/năm.
    """
    r = annual_rate / 12                    # Lãi suất tháng
    if r == 0:
        return principal / months           # Vay 0% lãi
    return principal * r / (1 - (1 + r) ** -months)


def flat_rate_payment(principal: float, annual_rate: float, months: int) -> float:
    """Trả mỗi tháng theo lãi phẳng: gốc chia đều + lãi trên số vay ban đầu."""
    return principal / months + principal * annual_rate / 12


def schedule(principal: float, annual_rate: float, months: int, *, show: int = 3) -> list:
    """Lịch trả nợ dư nợ giảm dần: list các tuple (tháng, gốc, lãi, còn nợ)."""
    payment = monthly_payment(principal, annual_rate, months)
    balance = principal
    rows = []
    for month in range(1, months + 1):
        interest = balance * annual_rate / 12
        principal_part = payment - interest
        balance -= principal_part
        rows.append((month, principal_part, interest, max(balance, 0)))
    return rows[:show] + rows[-1:]          # Chỉ lấy vài tháng đầu + tháng cuối cho gọn


loan, rate, term = 60_000_000, 0.12, 12     # Vay 60 triệu, 12%/năm, 12 tháng

reducing = monthly_payment(loan, rate, term)
flat = flat_rate_payment(loan, rate, term)
print(f"Khoản vay: {loan:,.0f}đ | Lãi suất: {rate:.0%}/năm | Kỳ hạn: {term} tháng")
print(f"Dư nợ giảm dần: {reducing:>12,.0f}đ/tháng → tổng lãi {reducing * term - loan:>10,.0f}đ")
print(f"Lãi phẳng:      {flat:>12,.0f}đ/tháng → tổng lãi {flat * term - loan:>10,.0f}đ")
print(f"👉 Cùng '12%/năm' nhưng lãi phẳng đắt hơn {(flat - reducing) * term:,.0f}đ!")

print(f"{'Tháng':>5} {'Trả gốc':>12} {'Trả lãi':>10} {'Còn nợ':>12}")
for month, principal_part, interest, balance in schedule(loan, rate, term):
    print(f"{month:>5} {principal_part:>12,.0f} {interest:>10,.0f} {balance:>12,.0f}")

# Output:
# Khoản vay: 60,000,000đ | Lãi suất: 12%/năm | Kỳ hạn: 12 tháng
# Dư nợ giảm dần:    5,330,927đ/tháng → tổng lãi  3,971,128đ
# Lãi phẳng:         5,600,000đ/tháng → tổng lãi  7,200,000đ
# 👉 Cùng '12%/năm' nhưng lãi phẳng đắt hơn 3,228,872đ!
# Tháng      Trả gốc    Trả lãi       Còn nợ
#     1    4,730,927    600,000   55,269,073
#     2    4,778,237    552,691   50,490,836
#     3    4,826,019    504,908   45,664,817
#    12    5,278,146     52,781            0
```

> 🧠 **Công thức niên kim** `P × r / (1 - (1 + r)^-n)` cho số tiền trả **đều** mỗi tháng: tháng đầu trả lãi nhiều, gốc ít; càng về sau lãi càng giảm vì dư nợ đã giảm. Trước khi ký hợp đồng vay, hãy hỏi rõ lãi tính theo **dư nợ giảm dần** hay **lãi phẳng**!

## ⚠️ Lỗi thường gặp

### 1. Quên gọi hàm (thiếu dấu ngoặc)

```python
def get_greeting():
    return "Xin chào"


print(get_greeting)         # ❌ In ra chính đối tượng hàm
# Output (ví dụ): <function get_greeting at 0x7f3a...>
print(get_greeting())       # ✅ Gọi hàm
# Output: Xin chào
```

### 2. Dùng print thay vì return

```python
def add(a, b):
    print(a + b)            # ❌ Chỉ in, không trả về


result = add(1, 2)
# Output: 3
print(result)
# Output: None
```

### 3. Mutable default argument

```python
# ❌ def register(name, users=[]):
# ✅
def register(name, users=None):
    users = [] if users is None else users
    users.append(name)
    return users


print(register("a"), register("b"))
# Output: ['a'] ['b']
```

### 4. Sai số lượng đối số

```python
def area(width, height):
    return width * height


try:
    area(5)
except TypeError as error:
    print(error)
# Output: area() missing 1 required positional argument: 'height'
```

### 5. Sửa biến global mà không khai báo

```python
total = 0


def add_to_total(n):
    # total += n            # ❌ UnboundLocalError
    return total + n        # ✅ Chỉ ĐỌC global thì không sao, tốt nhất là trả về kết quả


total = add_to_total(5)
print(total)
# Output: 5
```

### 6. Đệ quy thiếu base case hoặc base case không bao giờ đạt được

```python
def countdown(n):
    if n == 0:              # ⚠️ Nếu gọi countdown(-1) hoặc countdown(2.5) → không bao giờ == 0!
        return
    countdown(n - 1)


def countdown_safe(n):
    if n <= 0:              # ✅ Dùng <= an toàn hơn
        return
    countdown_safe(n - 1)


countdown_safe(-1)
print("OK")
# Output: OK
```

### 7. Gọi hàm trước khi định nghĩa

```text
say_hello()         # ❌ NameError: name 'say_hello' is not defined

def say_hello():
    print("Hello")
```

## 🏋️ Bài tập

### Bài tập 1: Hàm kiểm tra số nguyên tố

Viết `is_prime(n: int) -> bool`. Dùng nó để in tất cả số nguyên tố nhỏ hơn 50.

### Bài tập 2: Thống kê linh hoạt

Viết `stats(*numbers, precision=2)` trả về tuple `(min, max, trung bình)`, trung bình làm tròn theo `precision`. Nếu không có số nào, trả về `None`.

```python
# stats(4, 8, 15, 16, 23, 42)          → (4, 42, 18.0)
# stats(1, 2, 2, precision=3)           → (1, 2, 1.667)
# stats()                               → None
```

### Bài tập 3: Tạo thẻ HTML

Viết `html_tag(tag, content, **attrs)`:

```python
# html_tag("a", "Google", href="https://google.com", target="_blank")
# → '<a href="https://google.com" target="_blank">Google</a>'
```

### Bài tập 4: Sắp xếp sản phẩm

Cho list sản phẩm dạng tuple `(tên, giá, đánh giá)`. Dùng `sorted` + `lambda` để sắp xếp: theo giá tăng dần; theo đánh giá giảm dần; theo đánh giá giảm dần rồi giá tăng dần.

### Bài tập 5: Đệ quy

1. Viết `power(base, exp)` tính lũy thừa bằng đệ quy (không dùng `**`)
2. Viết `reverse_string(s)` đảo ngược chuỗi bằng đệ quy
3. Viết `count_files(tree)` đếm số file trong cây thư mục biểu diễn bằng dict lồng nhau:

```python
tree = {"src": {"main.py": None, "utils": {"a.py": None, "b.py": None}}, "README.md": None}
# count_files(tree) → 4
```

<details>
<summary>💡 Xem đáp án Bài tập 5.3</summary>

```python
def count_files(tree: dict) -> int:
    total = 0
    for name, content in tree.items():
        if content is None:            # Là file
            total += 1
        else:                          # Là thư mục → đệ quy
            total += count_files(content)
    return total


tree = {"src": {"main.py": None, "utils": {"a.py": None, "b.py": None}}, "README.md": None}
print(count_files(tree))
# Output: 4
```

</details>

## ✅ Checklist hoàn thành

- [ ] Định nghĩa và gọi hàm với `def`
- [ ] Phân biệt parameter và argument
- [ ] Hiểu rõ khác biệt giữa `print` và `return`
- [ ] Trả về nhiều giá trị và unpacking
- [ ] Dùng positional, keyword và default arguments
- [ ] Giải thích được bẫy mutable default và cách sửa bằng `None`
- [ ] Dùng `*args`, `**kwargs` và unpacking `*`/`**` khi gọi hàm
- [ ] Viết keyword-only arguments với `*`
- [ ] Dùng `lambda` với `sorted`, `max`, `map`, `filter`
- [ ] Giải thích quy tắc LEGB, biết khi nào cần `global`/`nonlocal`
- [ ] Viết docstring và type hints cho hàm
- [ ] Viết hàm đệ quy có base case đúng
- [ ] Viết được hàm kiểm tra dữ liệu trả về danh sách lỗi và hàm tính trả góp (phần 🌍 Ứng dụng thực tế)
- [ ] Hoàn thành ít nhất 3 bài tập

## 🚀 Tiếp theo

Hàm giúp bạn tổ chức **logic**. Bây giờ là lúc học cách tổ chức **dữ liệu** - với list, tuple, dict, set và những công cụ mạnh mẽ như comprehensions.

**Bài tiếp theo**: [Cấu trúc dữ liệu - list, tuple, dict, set](./05-data-structures.md)

---

💡 **Tips nhớ lâu**:

- **Một hàm - một nhiệm vụ**: tên hàm là động từ mô tả rõ việc nó làm
- **`return` để dùng tiếp, `print` để xem**
- **Không bao giờ dùng `[]`, `{}` làm default** - dùng `None`
- **`*` trong định nghĩa = gom, `*` khi gọi = mở gói**
- **Tránh `global`** - truyền tham số vào, trả kết quả ra
- **Type hints + docstring** = code chuyên nghiệp
