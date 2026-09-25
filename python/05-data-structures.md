# 📚 Bài 5: Cấu trúc dữ liệu (Data Structures)

## 🎯 Mục tiêu bài học

- Thành thạo 4 cấu trúc dữ liệu có sẵn: **list**, **tuple**, **dict**, **set**
- Thực hiện CRUD (Create - Read - Update - Delete) trên từng loại
- Hiểu **độ phức tạp** (Big-O) để chọn đúng cấu trúc dữ liệu
- Dùng **unpacking** (giải nén) linh hoạt
- Viết **list / dict / set comprehensions** gọn gàng
- Hiểu sự khác nhau giữa **copy nông (shallow)** và **copy sâu (deep)**
- Dùng module `collections`: `Counter`, `defaultdict`, `deque`, `namedtuple`

## 📖 1. Tổng quan

> 🧠 **Ví dụ dễ hiểu**: Hãy tưởng tượng bạn cần cất đồ đạc:
>
> - **list** 📋 = **danh sách việc cần làm**: có thứ tự, thêm/xóa/sửa thoải mái, trùng lặp cũng được
> - **tuple** 📦 = **hộp đã niêm phong**: có thứ tự nhưng **không thể thay đổi** sau khi đóng gói
> - **dict** 📖 = **cuốn từ điển / danh bạ**: tra cứu theo **tên (key)** để lấy **thông tin (value)** cực nhanh
> - **set** 🎟️ = **túi đựng vé số**: không có thứ tự, **không có hai vé trùng số**

| | list | tuple | dict | set |
| --- | --- | --- | --- | --- |
| Cú pháp | `[1, 2, 3]` | `(1, 2, 3)` | `{"a": 1}` | `{1, 2, 3}` |
| Có thứ tự | ✅ | ✅ | ✅ (Python 3.7+) | ❌ |
| Thay đổi được (mutable) | ✅ | ❌ | ✅ | ✅ |
| Cho phép trùng lặp | ✅ | ✅ | Key: ❌, Value: ✅ | ❌ |
| Truy cập bằng | Chỉ số `[0]` | Chỉ số `[0]` | Key `["a"]` | Không truy cập trực tiếp |
| Dùng khi | Danh sách thay đổi | Dữ liệu cố định | Tra cứu theo key | Loại trùng, kiểm tra tồn tại |

## 📖 2. List - Danh sách

### Tạo list

```python
empty = []                                  # List rỗng
numbers = [1, 2, 3, 4, 5]
fruits = ["táo", "cam", "xoài"]
mixed = [1, "hai", 3.0, True, None]         # Chứa được nhiều kiểu (nhưng nên tránh)
nested = [[1, 2], [3, 4]]                   # List lồng list (ma trận)

from_string = list("abc")                   # Tạo từ chuỗi
from_range = list(range(5))                 # Tạo từ range
print(from_string, from_range)
# Output: ['a', 'b', 'c'] [0, 1, 2, 3, 4]
print(len(fruits))
# Output: 3
```

### Read - Truy cập phần tử

```python
fruits = ["táo", "cam", "xoài", "chuối", "dưa"]

print(fruits[0])        # Phần tử đầu
# Output: táo
print(fruits[-1])       # Phần tử cuối
# Output: dưa
print(fruits[1:3])      # Slicing - giống hệt chuỗi (Bài 2)
# Output: ['cam', 'xoài']
print(fruits[::-1])     # Đảo ngược
# Output: ['dưa', 'chuối', 'xoài', 'cam', 'táo']

# Tìm kiếm
print("cam" in fruits)              # Kiểm tra tồn tại
# Output: True
print(fruits.index("xoài"))         # Vị trí (ValueError nếu không có)
# Output: 2
print([1, 2, 2, 3, 2].count(2))     # Đếm
# Output: 3

# List lồng nhau
matrix = [[1, 2, 3], [4, 5, 6]]
print(matrix[1][2])     # Hàng 1, cột 2
# Output: 6
```

### Create - Thêm phần tử

```python
cart = ["bút"]

cart.append("vở")                   # Thêm 1 phần tử vào CUỐI
print(cart)
# Output: ['bút', 'vở']

cart.insert(0, "cặp")               # Chèn vào vị trí 0
print(cart)
# Output: ['cặp', 'bút', 'vở']

cart.extend(["thước", "tẩy"])       # Nối nhiều phần tử
print(cart)
# Output: ['cặp', 'bút', 'vở', 'thước', 'tẩy']

combined = cart + ["gôm"]           # Toán tử + tạo list MỚI
print(combined)
# Output: ['cặp', 'bút', 'vở', 'thước', 'tẩy', 'gôm']
```

⚠️ **`append` vs `extend`** - hay nhầm:

```python
a = [1, 2]
a.append([3, 4])        # Thêm CẢ list làm 1 phần tử
print(a)
# Output: [1, 2, [3, 4]]

b = [1, 2]
b.extend([3, 4])        # Thêm TỪNG phần tử
print(b)
# Output: [1, 2, 3, 4]
```

### Update - Sửa phần tử

```python
scores = [7, 8, 5, 9]
scores[2] = 6               # Sửa theo chỉ số
print(scores)
# Output: [7, 8, 6, 9]

scores[0:2] = [10, 10]      # Sửa cả đoạn bằng slicing
print(scores)
# Output: [10, 10, 6, 9]
```

### Delete - Xóa phần tử

```python
items = ["a", "b", "c", "d", "e", "b"]

items.remove("b")           # Xóa phần tử có GIÁ TRỊ "b" (chỉ cái đầu tiên)
print(items)
# Output: ['a', 'c', 'd', 'e', 'b']

last = items.pop()          # Xóa và TRẢ VỀ phần tử cuối
print(last, items)
# Output: b ['a', 'c', 'd', 'e']

first = items.pop(0)        # Xóa và trả về phần tử ở vị trí 0
print(first, items)
# Output: a ['c', 'd', 'e']

del items[0]                # Xóa theo chỉ số (không trả về)
print(items)
# Output: ['d', 'e']

items.clear()               # Xóa sạch
print(items)
# Output: []
```

### Sắp xếp

```python
nums = [3, 1, 4, 1, 5, 9, 2]

# sorted(): trả về list MỚI, list gốc giữ nguyên
print(sorted(nums))
# Output: [1, 1, 2, 3, 4, 5, 9]
print(nums)
# Output: [3, 1, 4, 1, 5, 9, 2]

# .sort(): sắp xếp TẠI CHỖ (in-place), trả về None
nums.sort(reverse=True)
print(nums)
# Output: [9, 5, 4, 3, 2, 1, 1]

# Sắp xếp theo key (Bài 4)
names = ["bình", "An", "chi"]
print(sorted(names))                    # Chữ HOA đứng trước
# Output: ['An', 'bình', 'chi']
print(sorted(names, key=str.lower))     # Không phân biệt hoa thường
# Output: ['An', 'bình', 'chi']

nums.reverse()                          # Đảo ngược tại chỗ
print(nums)
# Output: [1, 1, 2, 3, 4, 5, 9]
```

> ⚠️ Lỗi kinh điển: `nums = nums.sort()` → `nums` thành `None`! Vì `.sort()` sửa trực tiếp và trả về `None`.

### List như Stack (ngăn xếp)

```python
stack = []
stack.append("trang 1")     # Push
stack.append("trang 2")
stack.append("trang 3")
print(stack.pop())          # Pop - lấy cái vào SAU CÙNG (LIFO: Last In First Out)
# Output: trang 3
print(stack)
# Output: ['trang 1', 'trang 2']
```

> 🧠 Stack giống **chồng đĩa**: đặt đĩa lên trên cùng, lấy đĩa cũng từ trên cùng. Nút "Back" của trình duyệt hoạt động như vậy.

## 📖 3. Tuple - Bộ giá trị bất biến

### Tạo tuple

```python
point = (3, 4)
rgb = (255, 128, 0)
empty = ()
single = (5,)           # ⚠️ Tuple 1 phần tử PHẢI có dấu phẩy
not_tuple = (5)         # Đây chỉ là số 5 trong ngoặc!
print(type(single), type(not_tuple))
# Output: <class 'tuple'> <class 'int'>

# Thực ra dấu phẩy mới tạo nên tuple, ngoặc chỉ để dễ nhìn
coords = 10, 20
print(coords)
# Output: (10, 20)
```

### Tuple không thể thay đổi

```python
point = (3, 4)
print(point[0])
# Output: 3

try:
    point[0] = 10
except TypeError as error:
    print("Lỗi:", error)
# Output: Lỗi: 'tuple' object does not support item assignment

# Tuple chỉ có 2 method
t = (1, 2, 2, 3)
print(t.count(2), t.index(3))
# Output: 2 3
```

### Tại sao cần tuple khi đã có list?

1. **An toàn**: Dữ liệu không nên thay đổi (tọa độ, ngày sinh, cấu hình) → tuple bảo vệ khỏi sửa nhầm
2. **Dùng làm key của dict** (list thì không được - xem phần dict)
3. **Nhẹ và nhanh hơn** list một chút
4. **Ý nghĩa**: list = "nhiều thứ cùng loại" (danh sách học sinh), tuple = "một bản ghi gồm nhiều trường" (`(tên, tuổi, lớp)`)

```python
import sys

print(sys.getsizeof([1, 2, 3]) > sys.getsizeof((1, 2, 3)))
# Output: True

# Tuple làm key của dict: lưu khoảng cách giữa các thành phố
distances = {("Hà Nội", "Hải Phòng"): 120, ("Hà Nội", "Huế"): 660}
print(distances[("Hà Nội", "Huế")])
# Output: 660
```

## 📖 4. Unpacking - Giải nén

### Unpacking cơ bản

```python
point = (3, 4)
x, y = point            # Số biến phải bằng số phần tử
print(x, y)
# Output: 3 4

name, age, city = ["Lan", 25, "Huế"]
print(f"{name} - {age} - {city}")
# Output: Lan - 25 - Huế
```

### Unpacking với * (extended unpacking)

```python
first, *rest = [1, 2, 3, 4, 5]
print(first, rest)
# Output: 1 [2, 3, 4, 5]

*beginning, last = [1, 2, 3, 4, 5]
print(beginning, last)
# Output: [1, 2, 3, 4] 5

head, *middle, tail = "Python"
print(head, middle, tail)
# Output: P ['y', 't', 'h', 'o'] n

# Bỏ qua các giá trị không cần
name, *_, email = ("An", 25, "Hà Nội", "Dev", "an@mail.com")
print(name, email)
# Output: An an@mail.com
```

### Unpacking lồng nhau và trong vòng lặp

```python
student = ("Minh", (8.5, 9.0, 7.5))
name, (math_score, physics, chemistry) = student
print(name, physics)
# Output: Minh 9.0

pairs = [("a", 1), ("b", 2)]
for letter, number in pairs:
    print(letter * number)
# Output:
# a
# bb
```

### Gộp list/dict bằng * và **

```python
a = [1, 2]
b = [3, 4]
print([*a, *b, 5])
# Output: [1, 2, 3, 4, 5]

defaults = {"theme": "light", "lang": "vi"}
user_settings = {"theme": "dark"}
settings = {**defaults, **user_settings}    # Key trùng → dict SAU ghi đè
print(settings)
# Output: {'theme': 'dark', 'lang': 'vi'}
```

## 📖 5. Dict - Từ điển

### Tạo dict

Dict lưu các cặp **key: value**. Key phải là kiểu **immutable** (str, int, tuple...) và **duy nhất**.

```python
student = {
    "name": "Hoa",
    "age": 20,
    "scores": [8, 9, 7],
    "is_active": True,
}

empty = {}
from_pairs = dict([("a", 1), ("b", 2)])
from_kwargs = dict(name="An", age=30)
from_zip = dict(zip(["x", "y"], [10, 20]))
print(from_kwargs, from_zip)
# Output: {'name': 'An', 'age': 30} {'x': 10, 'y': 20}
```

> 🧠 **Tại sao dict tra cứu nhanh?** Dict dùng kỹ thuật **hash table**: Python tính "mã băm" (hash) của key để biết **chính xác ngăn nào** chứa value - giống như tra từ điển giấy bạn lật thẳng tới chữ cái đầu, không đọc từ trang 1. Nhờ vậy tìm trong dict 1 triệu phần tử cũng nhanh như dict 10 phần tử.

### Read - Truy cập

```python
student = {"name": "Hoa", "age": 20}

print(student["name"])
# Output: Hoa

# ❌ Key không tồn tại → KeyError
try:
    print(student["email"])
except KeyError as error:
    print("KeyError:", error)
# Output: KeyError: 'email'

# ✅ get(): trả về None (hoặc giá trị mặc định) nếu không có key
print(student.get("email"))
# Output: None
print(student.get("email", "chưa có email"))
# Output: chưa có email

print("age" in student)         # Kiểm tra KEY tồn tại
# Output: True
```

### Create / Update

```python
student = {"name": "Hoa"}

student["age"] = 20                     # Thêm key mới
student["name"] = "Hoa Nguyễn"          # Key đã có → ghi đè
print(student)
# Output: {'name': 'Hoa Nguyễn', 'age': 20}

student.update({"age": 21, "city": "Huế"})   # Cập nhật nhiều key
print(student)
# Output: {'name': 'Hoa Nguyễn', 'age': 21, 'city': 'Huế'}

# setdefault: chỉ thêm nếu key CHƯA có, trả về value hiện tại
student.setdefault("age", 99)           # age đã có → không đổi
student.setdefault("country", "VN")     # country chưa có → thêm
print(student["age"], student["country"])
# Output: 21 VN

# Toán tử | (Python 3.9+) để gộp dict
merged = {"a": 1} | {"b": 2}
print(merged)
# Output: {'a': 1, 'b': 2}
```

### Delete

```python
config = {"host": "localhost", "port": 8000, "debug": True, "temp": 1}

del config["temp"]
port = config.pop("port")               # Xóa và trả về value
print(port, config)
# Output: 8000 {'host': 'localhost', 'debug': True}

print(config.pop("missing", "không có"))   # pop với mặc định → không lỗi
# Output: không có

key, value = config.popitem()           # Xóa cặp được thêm vào CUỐI CÙNG
print(key, value)
# Output: debug True
```

### Duyệt dict

```python
prices = {"cà phê": 29000, "trà sữa": 35000, "nước cam": 25000}

for key in prices:                      # Mặc định duyệt KEY
    print(key)
# Output:
# cà phê
# trà sữa
# nước cam

for value in prices.values():           # Duyệt VALUE
    print(value)
# Output:
# 29000
# 35000
# 25000

for name, price in prices.items():      # Duyệt CẢ HAI - hay dùng nhất
    print(f"{name:<10}{price:>8,}đ")
# Output:
# cà phê      29,000đ
# trà sữa     35,000đ
# nước cam    25,000đ

print(list(prices.keys()))
# Output: ['cà phê', 'trà sữa', 'nước cam']

# Món đắt nhất
print(max(prices, key=prices.get))
# Output: trà sữa

# Sắp xếp dict theo value
print(dict(sorted(prices.items(), key=lambda item: item[1])))
# Output: {'nước cam': 25000, 'cà phê': 29000, 'trà sữa': 35000}
```

### Dict lồng nhau - Mô hình dữ liệu thực tế

```python
users = {
    "u001": {"name": "An", "skills": ["Python", "SQL"], "address": {"city": "Hà Nội"}},
    "u002": {"name": "Bình", "skills": ["JavaScript"], "address": {"city": "Đà Nẵng"}},
}

print(users["u001"]["address"]["city"])
# Output: Hà Nội

users["u002"]["skills"].append("Python")

for user_id, info in users.items():
    skills = ", ".join(info["skills"])
    print(f"{user_id}: {info['name']} ({info['address']['city']}) - {skills}")
# Output:
# u001: An (Hà Nội) - Python, SQL
# u002: Bình (Đà Nẵng) - JavaScript, Python
```

> 💡 Cấu trúc dict lồng nhau này giống hệt **JSON** - định dạng dữ liệu phổ biến nhất trên web. Bạn sẽ đọc/ghi JSON ở [Bài 7](./07-exceptions-files.md).

### Ví dụ: Đếm tần suất từ

```python
text = "con mèo đuổi con chuột con chuột chạy"
counts = {}
for word in text.split():
    counts[word] = counts.get(word, 0) + 1     # get với mặc định 0 - kỹ thuật kinh điển
print(counts)
# Output: {'con': 3, 'mèo': 1, 'đuổi': 1, 'chuột': 2, 'chạy': 1}
```

(Ở phần `collections` bạn sẽ thấy `Counter` làm việc này chỉ trong một dòng!)

## 📖 6. Set - Tập hợp

### Tạo set

```python
colors = {"đỏ", "xanh", "vàng", "đỏ"}      # Phần tử trùng tự động bị loại
print(len(colors))
# Output: 3

empty_set = set()           # ⚠️ {} là dict rỗng, KHÔNG phải set rỗng!
print(type({}), type(set()))
# Output: <class 'dict'> <class 'set'>

# Ứng dụng số 1: loại bỏ trùng lặp
emails = ["a@x.com", "b@x.com", "a@x.com", "c@x.com", "b@x.com"]
unique = set(emails)
print(len(unique))
# Output: 3

# Loại trùng nhưng GIỮ thứ tự ban đầu
print(list(dict.fromkeys(emails)))
# Output: ['a@x.com', 'b@x.com', 'c@x.com']
```

> ⚠️ Set **không có thứ tự** → không dùng được chỉ số `s[0]`, và khi `print` thứ tự có thể khác với lúc bạn tạo.

### CRUD với set

```python
tags = {"python"}

tags.add("web")                 # Thêm 1 phần tử
tags.update(["api", "sql"])     # Thêm nhiều
print(sorted(tags))             # sorted() để in theo thứ tự cố định
# Output: ['api', 'python', 'sql', 'web']

tags.remove("sql")              # Xóa - KeyError nếu không có
tags.discard("không có")        # Xóa - KHÔNG lỗi nếu không có
print(sorted(tags))
# Output: ['api', 'python', 'web']

print("python" in tags)         # Kiểm tra tồn tại - CỰC NHANH
# Output: True
```

### Phép toán tập hợp

```python
python_devs = {"An", "Bình", "Chi", "Dũng"}
js_devs = {"Chi", "Dũng", "Em", "Giang"}

print(sorted(python_devs | js_devs))    # Hợp (union): biết ít nhất 1 ngôn ngữ
# Output: ['An', 'Bình', 'Chi', 'Dũng', 'Em', 'Giang']
print(sorted(python_devs & js_devs))    # Giao (intersection): biết cả 2
# Output: ['Chi', 'Dũng']
print(sorted(python_devs - js_devs))    # Hiệu (difference): chỉ biết Python
# Output: ['An', 'Bình']
print(sorted(python_devs ^ js_devs))    # Hiệu đối xứng: biết đúng 1 ngôn ngữ
# Output: ['An', 'Bình', 'Em', 'Giang']

print({"An", "Chi"} <= python_devs)     # Tập con (subset)?
# Output: True
print(python_devs.isdisjoint({"Hà", "Kim"}))   # Không có phần tử chung?
# Output: True
```

```text
    python_devs        js_devs
   ┌─────────────┬───────────┐
   │  An   Bình  │ Chi  Dũng │  Em  Giang
   └─────────────┴───────────┘
     (-) hiệu      (&) giao      ...
```

### frozenset

`frozenset` là set **bất biến** - dùng được làm key của dict hoặc phần tử của set khác:

```python
fs = frozenset([1, 2, 3])
groups = {fs: "nhóm A"}
print(groups[frozenset([3, 2, 1])])     # Thứ tự không quan trọng
# Output: nhóm A
```

## 📖 7. Độ phức tạp - Chọn đúng cấu trúc dữ liệu

### Big-O là gì?

**Big-O** mô tả thời gian chạy **tăng thế nào** khi dữ liệu tăng:

- **O(1)** - hằng số: nhanh như nhau dù có 10 hay 10 triệu phần tử ⚡
- **O(n)** - tuyến tính: dữ liệu gấp 10 → chậm gấp 10 🐢
- **O(n log n)** - như sắp xếp

> 🧠 **Ví dụ dễ hiểu**: Tìm một người tên "Lan" trong lớp:
>
> - **List** = gọi từng người một: "Bạn có phải Lan không?" → O(n)
> - **Set/Dict** = có sơ đồ chỗ ngồi theo tên, nhìn là biết ngay chỗ Lan → O(1)

### Bảng độ phức tạp

| Thao tác | list | dict | set |
| --- | --- | --- | --- |
| Truy cập `x[i]` / `d[key]` | O(1) | O(1) | - |
| Kiểm tra `x in ...` | **O(n)** 🐢 | **O(1)** ⚡ | **O(1)** ⚡ |
| Thêm vào cuối (`append`, `d[k]=v`, `add`) | O(1) | O(1) | O(1) |
| Thêm/xóa ở đầu (`insert(0, x)`, `pop(0)`) | **O(n)** 🐢 | - | - |
| Xóa phần tử cuối (`pop()`) | O(1) | O(1) (`popitem()`) | O(1) (`pop()` lấy phần tử bất kỳ) |
| Xóa theo giá trị (`remove`) | O(n) | O(1) (`del`) | O(1) |
| Sắp xếp | O(n log n) | - | - |

### Thử nghiệm thực tế

```python
import time

data_list = list(range(1_000_000))
data_set = set(data_list)
target = 999_999

start = time.perf_counter()
for _ in range(100):
    target in data_list
list_time = time.perf_counter() - start

start = time.perf_counter()
for _ in range(100):
    target in data_set
set_time = time.perf_counter() - start

print(f"list: {list_time:.4f}s | set: {set_time:.6f}s")
print("set nhanh hơn rất nhiều lần:", list_time > set_time * 100)
# Output (ví dụ): list: 0.5321s | set: 0.000005s
# Output: set nhanh hơn rất nhiều lần: True
```

> ✅ **Quy tắc**: Nếu bạn cần **kiểm tra "có trong không"** nhiều lần → chuyển sang `set` hoặc `dict`.

## 📖 8. Comprehensions

### List comprehension

Comprehension là cách **tạo collection mới từ collection cũ** trong một dòng, ngắn gọn và thường nhanh hơn vòng lặp.

```text
[biểu_thức for phần_tử in iterable if điều_kiện]
```

```python
# Cách truyền thống
squares = []
for n in range(1, 6):
    squares.append(n ** 2)
print(squares)
# Output: [1, 4, 9, 16, 25]

# List comprehension - đọc là: "n bình phương, với mỗi n trong 1..5"
squares = [n ** 2 for n in range(1, 6)]
print(squares)
# Output: [1, 4, 9, 16, 25]
```

> 🧠 **Cách đọc**: Comprehension đọc gần như tiếng Anh: `[n ** 2 for n in numbers if n > 0]` = "n bình phương **cho mỗi** n **trong** numbers **nếu** n > 0".

### Có điều kiện lọc (if)

```python
numbers = [5, -3, 8, 0, -1, 12]

positives = [n for n in numbers if n > 0]
print(positives)
# Output: [5, 8, 12]

words = ["Python", "is", "an", "awesome", "language"]
long_words = [w.upper() for w in words if len(w) > 3]
print(long_words)
# Output: ['PYTHON', 'AWESOME', 'LANGUAGE']
```

### Có if-else (biến đổi, không lọc)

Để ý vị trí: `if-else` đứng **trước** `for` (vì nó là một phần của biểu thức), còn `if` lọc đứng **sau**:

```python
numbers = [1, 2, 3, 4, 5]
labels = ["chẵn" if n % 2 == 0 else "lẻ" for n in numbers]
print(labels)
# Output: ['lẻ', 'chẵn', 'lẻ', 'chẵn', 'lẻ']

# Thay số âm bằng 0
print([n if n > 0 else 0 for n in [5, -3, 8, -1]])
# Output: [5, 0, 8, 0]
```

### Comprehension lồng nhau

```python
# Làm phẳng ma trận: đọc thứ tự for từ TRÁI sang PHẢI như vòng lặp lồng nhau
matrix = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
flat = [x for row in matrix for x in row]
print(flat)
# Output: [1, 2, 3, 4, 5, 6, 7, 8, 9]

# Tương đương:
# for row in matrix:
#     for x in row:
#         flat.append(x)

# Chuyển vị ma trận (transpose)
transposed = [[row[i] for row in matrix] for i in range(3)]
print(transposed)
# Output: [[1, 4, 7], [2, 5, 8], [3, 6, 9]]

# Tạo bảng 3x3 toàn số 0 - ĐÚNG cách
grid = [[0] * 3 for _ in range(3)]
grid[0][0] = 1
print(grid)
# Output: [[1, 0, 0], [0, 0, 0], [0, 0, 0]]
```

### Dict comprehension

```text
{key_expr: value_expr for phần_tử in iterable if điều_kiện}
```

```python
names = ["An", "Bình", "Chi"]
name_lengths = {name: len(name) for name in names}
print(name_lengths)
# Output: {'An': 2, 'Bình': 4, 'Chi': 3}

prices = {"táo": 30000, "cam": 25000, "sầu riêng": 150000}

# Lọc: chỉ giữ món dưới 50k
cheap = {k: v for k, v in prices.items() if v < 50000}
print(cheap)
# Output: {'táo': 30000, 'cam': 25000}

# Tăng giá 10%
increased = {k: round(v * 1.1) for k, v in prices.items()}
print(increased)
# Output: {'táo': 33000, 'cam': 27500, 'sầu riêng': 165000}

# Đảo key ↔ value
codes = {"HN": "Hà Nội", "SG": "Sài Gòn"}
print({v: k for k, v in codes.items()})
# Output: {'Hà Nội': 'HN', 'Sài Gòn': 'SG'}
```

### Set comprehension

```python
emails = ["An@Mail.com", "an@mail.com", "binh@mail.com"]
unique_lower = {e.lower() for e in emails}
print(sorted(unique_lower))
# Output: ['an@mail.com', 'binh@mail.com']

# Các độ dài từ khác nhau
print({len(w) for w in ["hi", "ok", "hello", "yes"]})
# Output: {2, 3, 5}
```

### Generator expression - Anh em của comprehension

Dùng ngoặc tròn `()` → không tạo list trong bộ nhớ, tính từng phần tử khi cần. Rất hợp với `sum`, `max`, `any`, `all`:

```python
total = sum(n ** 2 for n in range(1, 101))     # Không cần [ ]
print(total)
# Output: 338350
```

Chi tiết về generator ở [Bài 9](./09-advanced-python.md).

### Khi nào KHÔNG dùng comprehension?

```python
# ❌ Quá phức tạp - khó đọc
result = [x * y for x in range(10) if x % 2 for y in range(x) if y > 2 if x + y < 12]

# ✅ Dùng vòng lặp bình thường khi logic phức tạp
result = []
for x in range(10):
    if x % 2 == 0:
        continue
    for y in range(x):
        if y > 2 and x + y < 12:
            result.append(x * y)
print(result)
# Output: [15, 20, 21, 28]
```

> ✅ **Quy tắc**: Comprehension nên **đọc được trong một hơi thở**. Nếu phải đọc 2 lần mới hiểu → viết vòng lặp. Và **đừng** dùng comprehension chỉ để gọi hàm có side-effect như `[print(x) for x in items]`.

## 📖 9. Copy nông vs Copy sâu

### Gán không phải là copy

Nhớ lại [Bài 2](./02-variables-types.md): biến chỉ là **nhãn dán**. Gán `b = a` chỉ dán thêm nhãn, không tạo bản sao:

```python
a = [1, 2, 3]
b = a               # b và a là CÙNG MỘT list
b.append(4)
print(a)            # a cũng bị thay đổi!
# Output: [1, 2, 3, 4]
print(a is b)
# Output: True
```

### Shallow copy (copy nông)

Tạo **list mới**, nhưng các phần tử bên trong vẫn **dùng chung**:

```python
original = [1, 2, 3]

# 4 cách tạo shallow copy
c1 = original.copy()
c2 = list(original)
c3 = original[:]
import copy
c4 = copy.copy(original)

c1.append(99)
print(original, c1)         # original không bị ảnh hưởng
# Output: [1, 2, 3] [1, 2, 3, 99]
```

⚠️ **Vấn đề với dữ liệu lồng nhau**:

```python
original = [[1, 2], [3, 4]]
shallow = original.copy()

shallow.append([5, 6])      # Thêm vào list ngoài → OK, original không đổi
shallow[0].append(999)      # Sửa list BÊN TRONG → original cũng bị đổi!

print(original)
# Output: [[1, 2, 999], [3, 4]]
print(shallow)
# Output: [[1, 2, 999], [3, 4], [5, 6]]
print(original[0] is shallow[0])
# Output: True
```

> 🧠 **Ví dụ dễ hiểu**: Shallow copy giống như **photo một tờ danh sách địa chỉ nhà**. Bạn có tờ danh sách mới (sửa danh sách không ảnh hưởng bản gốc), nhưng các **ngôi nhà** vẫn là những ngôi nhà cũ. Nếu bạn sơn lại một ngôi nhà, người cầm bản gốc đến đó cũng thấy nhà đã được sơn.

### Deep copy (copy sâu)

`copy.deepcopy()` sao chép **đệ quy tất cả mọi thứ** bên trong:

```python
import copy

original = {"name": "An", "skills": ["Python", "SQL"]}
deep = copy.deepcopy(original)

deep["skills"].append("Docker")
print(original["skills"])
# Output: ['Python', 'SQL']
print(deep["skills"])
# Output: ['Python', 'SQL', 'Docker']
```

### Bẫy `[[0] * 3] * 3`

```python
# ❌ Nhân list lồng nhau: 3 hàng là CÙNG MỘT list!
grid = [[0] * 3] * 3
grid[0][0] = 1
print(grid)
# Output: [[1, 0, 0], [1, 0, 0], [1, 0, 0]]

# ✅ Dùng comprehension: mỗi hàng là một list riêng
grid = [[0] * 3 for _ in range(3)]
grid[0][0] = 1
print(grid)
# Output: [[1, 0, 0], [0, 0, 0], [0, 0, 0]]
```

| | Gán `b = a` | Shallow copy | Deep copy |
| --- | --- | --- | --- |
| Tạo object ngoài mới | ❌ | ✅ | ✅ |
| Tạo object bên trong mới | ❌ | ❌ | ✅ |
| Tốc độ | Nhanh nhất | Nhanh | Chậm hơn |
| Dùng khi | Muốn dùng chung | Dữ liệu phẳng (không lồng) | Dữ liệu lồng nhau |

## 📖 10. Module collections - Cấu trúc dữ liệu nâng cao

### Counter - Đếm số lần xuất hiện

```python
from collections import Counter

text = "con mèo đuổi con chuột con chuột chạy"
counts = Counter(text.split())
print(counts)
# Output: Counter({'con': 3, 'chuột': 2, 'mèo': 1, 'đuổi': 1, 'chạy': 1})

print(counts["con"])
# Output: 3
print(counts["chó"])            # Key không tồn tại → 0, không lỗi
# Output: 0
print(counts.most_common(2))    # Top 2 phổ biến nhất
# Output: [('con', 3), ('chuột', 2)]

# Đếm ký tự
print(Counter("banana"))
# Output: Counter({'a': 3, 'n': 2, 'b': 1})

# Cộng/trừ Counter
inventory = Counter(táo=5, cam=3)
sold = Counter(táo=2, cam=3)
print(inventory - sold)         # Phần tử <= 0 bị loại bỏ
# Output: Counter({'táo': 3})
```

### defaultdict - Dict có giá trị mặc định

```python
from collections import defaultdict

# Nhóm học sinh theo lớp
students = [("An", "10A"), ("Bình", "10B"), ("Chi", "10A"), ("Dũng", "10B"), ("Em", "10C")]

# ❌ Với dict thường: phải kiểm tra key tồn tại
groups = {}
for name, class_name in students:
    if class_name not in groups:
        groups[class_name] = []
    groups[class_name].append(name)

# ✅ Với defaultdict(list): key mới tự động có giá trị list rỗng
groups = defaultdict(list)
for name, class_name in students:
    groups[class_name].append(name)

print(dict(groups))
# Output: {'10A': ['An', 'Chi'], '10B': ['Bình', 'Dũng'], '10C': ['Em']}

# defaultdict(int): đếm - key mới bắt đầu từ 0
word_count = defaultdict(int)
for w in "a b a c a".split():
    word_count[w] += 1
print(dict(word_count))
# Output: {'a': 3, 'b': 1, 'c': 1}
```

> 💡 Tham số của `defaultdict` là một **hàm tạo giá trị mặc định** (factory): `list` → `[]`, `int` → `0`, `set` → `set()`, `str` → `""`.

### deque - Hàng đợi hai đầu

`deque` (đọc là "deck") thêm/xóa ở **cả hai đầu** với tốc độ O(1), trong khi `list.insert(0, x)` và `list.pop(0)` là O(n):

```python
from collections import deque

queue = deque(["khách 1", "khách 2"])
queue.append("khách 3")         # Vào cuối hàng
queue.appendleft("VIP")         # Chen lên đầu hàng
print(queue)
# Output: deque(['VIP', 'khách 1', 'khách 2', 'khách 3'])

print(queue.popleft())          # Phục vụ người đầu hàng (FIFO: First In First Out)
# Output: VIP
print(queue.pop())              # Lấy từ cuối
# Output: khách 3

# maxlen: chỉ giữ N phần tử gần nhất - tuyệt vời cho "lịch sử gần đây"
recent = deque(maxlen=3)
for page in ["home", "about", "blog", "contact", "shop"]:
    recent.append(page)
print(list(recent))
# Output: ['blog', 'contact', 'shop']

# rotate: xoay vòng
d = deque([1, 2, 3, 4, 5])
d.rotate(2)
print(d)
# Output: deque([4, 5, 1, 2, 3])
```

> 🧠 Queue (hàng đợi) giống **xếp hàng mua vé**: ai đến trước được phục vụ trước.

### namedtuple - Tuple có tên trường

```python
from collections import namedtuple

# Tạo "kiểu" Point với 2 trường x, y
Point = namedtuple("Point", ["x", "y"])

p = Point(3, 4)
print(p)
# Output: Point(x=3, y=4)
print(p.x, p.y)                 # Truy cập bằng TÊN - dễ đọc hơn p[0], p[1]
# Output: 3 4
print(p[0])                     # Vẫn dùng được như tuple
# Output: 3

x, y = p                        # Unpacking bình thường
distance = (p.x ** 2 + p.y ** 2) ** 0.5
print(distance)
# Output: 5.0

# Bất biến như tuple; muốn "sửa" thì tạo bản mới với _replace
p2 = p._replace(x=10)
print(p2, p)
# Output: Point(x=10, y=4) Point(x=3, y=4)

Student = namedtuple("Student", "name age grade")    # Có thể dùng chuỗi cách nhau bởi dấu cách
s = Student("Lan", 16, "10A")
print(s._asdict())
# Output: {'name': 'Lan', 'age': 16, 'grade': '10A'}
```

> 💡 Phiên bản hiện đại hơn của namedtuple là `typing.NamedTuple` và `dataclass` - bạn sẽ học `dataclass` ở [Bài 6](./06-oop.md).

## 🌍 Ứng dụng thực tế

Chọn đúng cấu trúc dữ liệu là một nửa lời giải: **dict** để tra cứu theo mã, **set** để kiểm tra "đã có chưa" và loại trùng, **list** để giữ thứ tự, **Counter/defaultdict** để thống kê.

### 1. Giỏ hàng có kiểm tra tồn kho và mã giảm giá

```python
# cart.py - Giỏ hàng: dict lưu sản phẩm, set lưu mã giảm giá đã dùng
CATALOG = {                                     # mã SP → (tên, giá, tồn kho)
    "SP01": ("Tai nghe Bluetooth", 450_000, 10),
    "SP02": ("Ốp lưng", 90_000, 3),
    "SP03": ("Sạc nhanh 20W", 250_000, 0),
}
COUPONS = {"GIAM10": 0.10, "FREESHIP": 0.0}     # mã → % giảm
cart = {}                                       # mã SP → số lượng (sửa dict bên trong hàm
                                                # không cần global vì không gán lại biến - Bài 4)
used_coupons = set()


def add_to_cart(sku, qty=1):
    if sku not in CATALOG:
        return f"❌ Không có sản phẩm {sku}"
    name, _, stock = CATALOG[sku]
    new_qty = cart.get(sku, 0) + qty            # get() với mặc định 0
    if stock == 0:
        return f"❌ {name}: đã hết hàng"
    if new_qty > stock:
        return f"❌ {name}: chỉ còn {stock} sản phẩm"
    cart[sku] = new_qty
    return f"🛒 {name} x{new_qty}"


def apply_coupon(code):
    code = code.strip().upper()
    if code not in COUPONS:
        return f"❌ Mã {code} không tồn tại"
    if code in used_coupons:                    # Kiểm tra trong set: O(1)
        return f"❌ Mã {code} đã được dùng"
    used_coupons.add(code)
    return f"🎟️ Áp dụng mã {code}"


print(add_to_cart("SP01"))
print(add_to_cart("SP02", 2))
print(add_to_cart("SP02", 2))                   # Vượt tồn kho
print(add_to_cart("SP03"))                      # Hết hàng
print(apply_coupon(" giam10 "))
print(apply_coupon("GIAM10"))                   # Dùng lại

# Dict comprehension: thành tiền từng dòng
line_totals = {sku: CATALOG[sku][1] * qty for sku, qty in cart.items()}
subtotal = sum(line_totals.values())
discount = int(subtotal * sum(COUPONS[c] for c in used_coupons))

print("-" * 38)
for sku, qty in cart.items():
    name, price, _ = CATALOG[sku]               # Unpacking tuple
    print(f"{name:<20} {qty:>2} x {price:>8,}")
print(f"{'Tạm tính:':<24}{subtotal:>14,}")
print(f"{'Giảm giá:':<24}{-discount:>14,}")
print(f"{'Thanh toán:':<24}{subtotal - discount:>14,}")

# Output:
# 🛒 Tai nghe Bluetooth x1
# 🛒 Ốp lưng x2
# ❌ Ốp lưng: chỉ còn 3 sản phẩm
# ❌ Sạc nhanh 20W: đã hết hàng
# 🎟️ Áp dụng mã GIAM10
# ❌ Mã GIAM10 đã được dùng
# --------------------------------------
# Tai nghe Bluetooth    1 x  450,000
# Ốp lưng               2 x   90,000
# Tạm tính:                      630,000
# Giảm giá:                      -63,000
# Thanh toán:                    567,000
```

### 2. Thống kê từ khóa tìm kiếm

Bộ phận marketing muốn biết khách tìm gì nhiều nhất và tìm gì mà **shop không có** để nhập thêm hàng:

```python
# search_stats.py - Thống kê từ khóa tìm kiếm trên website bán hàng
from collections import Counter, defaultdict

search_log = [                                  # (user_id, từ khóa người dùng gõ)
    ("u1", "iPhone 15"), ("u2", "iphone  15 "), ("u3", "tai nghe"),
    ("u1", "iphone 15"), ("u4", "Tai Nghe"), ("u2", "sạc dự phòng"),
    ("u5", "IPHONE 15"), ("u3", "ốp lưng"), ("u5", "tai nghe"), ("u6", "loa"),
]
products = ["iPhone 15 Pro", "Tai nghe AirPods", "Ốp lưng iPhone", "Sạc 20W"]

# 1. Chuẩn hóa: viết thường + gộp khoảng trắng → "iPhone 15" và "iphone  15 " là một
normalized = [(user, " ".join(kw.lower().split())) for user, kw in search_log]

# 2. Top từ khóa (Counter) và số người dùng KHÁC NHAU tìm mỗi từ (defaultdict(set))
counts = Counter(kw for _, kw in normalized)
users_by_keyword = defaultdict(set)
for user, kw in normalized:
    users_by_keyword[kw].add(user)              # set tự bỏ trùng: u1 tìm 2 lần vẫn tính 1

print("🔥 Top 3 từ khóa:")
for rank, (kw, n) in enumerate(counts.most_common(3), start=1):
    print(f"  {rank}. {kw:<14} {n} lượt / {len(users_by_keyword[kw])} người")

# 3. Từ khóa KHÔNG khớp sản phẩm nào → gợi ý nhập thêm hàng
catalog_text = " ".join(products).lower()
no_result = sorted({kw for kw in counts if kw not in catalog_text})
print("📦 Không có kết quả, nên nhập thêm:", no_result)

# 4. Người dùng tìm cả "iphone 15" lẫn "tai nghe" → gợi ý combo (phép giao của set)
combo_users = users_by_keyword["iphone 15"] & users_by_keyword["tai nghe"]
print("🎯 Gợi ý combo iPhone + tai nghe cho:", sorted(combo_users))

# Output:
# 🔥 Top 3 từ khóa:
#   1. iphone 15      4 lượt / 3 người
#   2. tai nghe       3 lượt / 3 người
#   3. sạc dự phòng   1 lượt / 1 người
# 📦 Không có kết quả, nên nhập thêm: ['loa', 'sạc dự phòng']
# 🎯 Gợi ý combo iPhone + tai nghe cho: ['u5']
```

> 💡 Bước **chuẩn hóa** (viết thường, gộp khoảng trắng) luôn đi trước bước thống kê - nếu không, `"iPhone 15"`, `"iphone  15 "` và `"IPHONE 15"` sẽ bị đếm thành 3 từ khóa khác nhau.

### 3. Gom nhóm đơn hàng theo khách, tìm khách VIP

Bài toán "group by" kinh điển (giống `GROUP BY` trong SQL hay Pivot Table trong Excel):

```python
# orders_report.py - Gom nhóm đơn hàng theo khách, tìm khách VIP
from collections import defaultdict, namedtuple

orders = [
    {"id": 101, "customer": "Lan", "total": 350_000, "status": "done"},
    {"id": 102, "customer": "Minh", "total": 1_200_000, "status": "done"},
    {"id": 103, "customer": "Lan", "total": 780_000, "status": "done"},
    {"id": 104, "customer": "Hùng", "total": 90_000, "status": "cancelled"},
    {"id": 105, "customer": "Minh", "total": 450_000, "status": "done"},
    {"id": 106, "customer": "Hùng", "total": 150_000, "status": "done"},
    {"id": 107, "customer": "Lan", "total": 60_000, "status": "done"},
]
VIP_THRESHOLD = 1_000_000

Summary = namedtuple("Summary", "customer orders revenue")

# 1. Gom nhóm: khách → list đơn (bỏ đơn đã hủy)
by_customer = defaultdict(list)
for order in orders:
    if order["status"] != "cancelled":
        by_customer[order["customer"]].append(order)

# 2. Tổng hợp từng khách, sắp xếp theo doanh thu giảm dần
summaries = [
    Summary(name, len(items), sum(o["total"] for o in items))
    for name, items in by_customer.items()
]
summaries.sort(key=lambda s: s.revenue, reverse=True)

print(f"{'Khách':<8}{'Số đơn':>7}{'Doanh thu':>14}")
for s in summaries:
    badge = " ⭐ VIP" if s.revenue >= VIP_THRESHOLD else ""
    print(f"{s.customer:<8}{s.orders:>7}{s.revenue:>14,}{badge}")

# 3. Các con số tổng quan
revenue_total = sum(s.revenue for s in summaries)
vip_names = {s.customer for s in summaries if s.revenue >= VIP_THRESHOLD}
biggest = max(orders, key=lambda o: o["total"])
print(f"Tổng doanh thu: {revenue_total:,}đ | Khách VIP: {sorted(vip_names)}")
print(f"Đơn lớn nhất: #{biggest['id']} của {biggest['customer']} ({biggest['total']:,}đ)")
print("Mã đơn theo khách:", {name: [o["id"] for o in items] for name, items in by_customer.items()})

# Output:
# Khách    Số đơn     Doanh thu
# Minh          2     1,650,000 ⭐ VIP
# Lan           3     1,190,000 ⭐ VIP
# Hùng          1       150,000
# Tổng doanh thu: 2,990,000đ | Khách VIP: ['Lan', 'Minh']
# Đơn lớn nhất: #102 của Minh (1,200,000đ)
# Mã đơn theo khách: {'Lan': [101, 103, 107], 'Minh': [102, 105], 'Hùng': [106]}
```

## ⚠️ Lỗi thường gặp

### 1. Nhầm `{}` là set rỗng

```python
s = {}
print(type(s))              # ❌ dict, không phải set
# Output: <class 'dict'>
s = set()                   # ✅
```

### 2. Gán kết quả của method in-place

```python
nums = [3, 1, 2]
result = nums.sort()        # ❌ sort() trả về None
print(result)
# Output: None
result = sorted(nums)       # ✅ Dùng sorted() nếu cần list mới
```

### 3. KeyError khi truy cập dict

```python
config = {"host": "localhost"}
# port = config["port"]             # ❌ KeyError
port = config.get("port", 8000)     # ✅
print(port)
# Output: 8000
```

### 4. Dùng list làm key của dict hoặc phần tử của set

```python
try:
    bad = {[1, 2]: "value"}
except TypeError as error:
    print(error)
# Output: unhashable type: 'list'

good = {(1, 2): "value"}    # ✅ Dùng tuple
```

### 5. Sửa dict trong khi đang duyệt

```python
stock = {"táo": 0, "cam": 5, "xoài": 0}

try:
    for fruit in stock:
        if stock[fruit] == 0:
            del stock[fruit]            # ❌
except RuntimeError as error:
    print(error)
# Output: dictionary changed size during iteration

stock = {"táo": 0, "cam": 5, "xoài": 0}
stock = {k: v for k, v in stock.items() if v > 0}    # ✅ Tạo dict mới
print(stock)
# Output: {'cam': 5}
```

### 6. Quên dấu phẩy trong tuple 1 phần tử

```python
colors = ("đỏ")             # ❌ Đây là chuỗi!
print(type(colors))
# Output: <class 'str'>
colors = ("đỏ",)            # ✅
print(type(colors))
# Output: <class 'tuple'>
```

### 7. Tưởng copy() là copy sâu

```python
import copy

team = {"members": ["An", "Bình"]}
backup = team.copy()                    # ❌ Shallow copy
team["members"].append("Chi")
print(backup["members"])                # Backup cũng bị đổi!
# Output: ['An', 'Bình', 'Chi']

team = {"members": ["An", "Bình"]}
backup = copy.deepcopy(team)            # ✅
team["members"].append("Chi")
print(backup["members"])
# Output: ['An', 'Bình']
```

### 8. Dùng list để kiểm tra tồn tại với dữ liệu lớn

```python
banned_ids = list(range(100_000))
# ❌ if user_id in banned_ids:   → O(n) mỗi lần kiểm tra
banned_ids = set(banned_ids)
# ✅ if user_id in banned_ids:   → O(1)
print(99_999 in banned_ids)
# Output: True
```

## 🏋️ Bài tập

### Bài tập 1: So sánh lớp học

Cho 2 set học sinh đăng ký CLB Toán và CLB Tin. Tìm: học sinh tham gia cả 2 CLB, chỉ tham gia CLB Toán, tổng số học sinh tham gia ít nhất 1 CLB.

### Bài tập 2: Quản lý danh bạ

Dùng dict để viết các hàm: `add_contact(book, name, phone)`, `find_contact(book, name)`, `delete_contact(book, name)`, `list_contacts(book)` (in theo alphabet). Xử lý trường hợp tên không tồn tại.

### Bài tập 3: Comprehensions

Viết bằng comprehension:

1. List các số từ 1-50 chia hết cho 3 hoặc 5
2. Dict `{số: bình phương}` cho các số chẵn từ 1-10
3. List các tuple `(a, b, c)` với `a < b < c <= 20` thỏa `a² + b² = c²` (bộ ba Pythagore)

### Bài tập 4: Lịch sử lệnh

Dùng `deque(maxlen=5)` mô phỏng lịch sử 5 lệnh gần nhất của terminal. Viết hàm `run(cmd)` lưu lệnh vào lịch sử và `history()` in lịch sử có đánh số.

### Bài tập 5: Phân tích văn bản

Cho một đoạn văn bản, hãy:

1. Đếm tổng số từ và số từ khác nhau
2. Tìm 5 từ xuất hiện nhiều nhất (dùng `Counter`)
3. Nhóm các từ theo chữ cái đầu (dùng `defaultdict`)
4. Tìm các từ có độ dài > 5 (dùng set comprehension)

<details>
<summary>💡 Xem đáp án Bài tập 3.3</summary>

```python
triples = [
    (a, b, c)
    for a in range(1, 21)
    for b in range(a + 1, 21)
    for c in range(b + 1, 21)
    if a ** 2 + b ** 2 == c ** 2
]
print(triples)
# Output: [(3, 4, 5), (5, 12, 13), (6, 8, 10), (8, 15, 17), (9, 12, 15), (12, 16, 20)]
```

</details>

## ✅ Checklist hoàn thành

- [ ] Phân biệt được list, tuple, dict, set và chọn đúng loại cho từng tình huống
- [ ] CRUD thành thạo trên list (append, insert, extend, pop, remove, del)
- [ ] Hiểu khác biệt `sort()` và `sorted()`
- [ ] Biết tại sao tuple tồn tại và tạo tuple 1 phần tử đúng cách
- [ ] Unpacking với `*` và unpacking lồng nhau
- [ ] Dùng `get()`, `setdefault()`, `items()`, `update()` với dict
- [ ] Dùng phép toán tập hợp `|`, `&`, `-`, `^`
- [ ] Hiểu Big-O cơ bản: `in` với list là O(n), với set/dict là O(1)
- [ ] Viết list/dict/set comprehension có điều kiện
- [ ] Giải thích được shallow copy vs deep copy
- [ ] Dùng `Counter`, `defaultdict`, `deque`, `namedtuple`
- [ ] Dùng dict/set/`Counter`/`defaultdict` cho giỏ hàng, thống kê từ khóa, gom nhóm đơn hàng (phần 🌍 Ứng dụng thực tế)
- [ ] Hoàn thành ít nhất 3 bài tập

## 🚀 Tiếp theo

Bạn đã biết cách tổ chức dữ liệu với các cấu trúc có sẵn. Nhưng khi chương trình phức tạp hơn, bạn sẽ muốn **tự tạo kiểu dữ liệu của riêng mình** - gộp cả dữ liệu và hành vi vào một chỗ. Đó chính là **lập trình hướng đối tượng**!

**Bài tiếp theo**: [Lập trình hướng đối tượng (OOP)](./06-oop.md)

---

💡 **Tips nhớ lâu**:

- **list** thay đổi được, **tuple** thì không → dùng tuple cho dữ liệu cố định
- **dict.get(key, default)** thay vì `dict[key]` khi key có thể không tồn tại
- **Cần kiểm tra `in` nhiều lần?** → dùng `set`
- **Comprehension** ngắn gọn, nhưng phải dễ đọc
- **Dữ liệu lồng nhau** → nhớ `copy.deepcopy()`
- **Đếm → Counter, nhóm → defaultdict, hàng đợi → deque**
