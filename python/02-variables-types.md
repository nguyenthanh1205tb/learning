# 📚 Bài 2: Biến & Kiểu dữ liệu

## 🎯 Mục tiêu bài học

- Hiểu biến là gì và cách Python lưu trữ biến (dynamic typing)
- Nắm vững các kiểu dữ liệu cơ bản: `int`, `float`, `str`, `bool`, `None`
- Kiểm tra kiểu với `type()` và `isinstance()`
- Chuyển đổi kiểu dữ liệu (ép kiểu / type casting)
- Sử dụng các toán tử số học, so sánh, logic - đặc biệt là `//`, `%`, `**`
- Thành thạo các method xử lý chuỗi (string methods)
- Định dạng chuỗi bằng **f-strings**
- Nhận dữ liệu từ bàn phím với `input()`
- Cắt chuỗi (slicing) như một chuyên gia

## 📖 1. Biến (Variables)

### Biến là gì?

**Biến** là một **cái tên** dùng để tham chiếu tới một **giá trị** được lưu trong bộ nhớ.

```python
age = 25                # Tạo biến age, gán giá trị 25
name = "Minh"           # Tạo biến name, gán chuỗi "Minh"
height = 1.72           # Số thập phân
is_student = True       # Giá trị đúng/sai

print(name, age, height, is_student)
# Output: Minh 25 1.72 True
```

Dấu `=` trong Python **không phải "bằng"** như trong toán học, mà là **phép gán** (assignment): "lấy giá trị bên phải, gắn cái tên bên trái vào nó".

> 🧠 **Ví dụ dễ hiểu**: Hãy tưởng tượng giá trị là **một món đồ**, còn biến là **một tờ giấy nhớ (sticky note)** dán lên món đồ đó. `age = 25` nghĩa là "dán tờ giấy ghi chữ `age` lên con số 25". Bạn có thể bóc tờ giấy đó ra và dán sang món đồ khác bất cứ lúc nào.

### Gán lại giá trị

```python
score = 10
print(score)
# Output: 10

score = 20              # Bóc nhãn "score" khỏi 10, dán sang 20
print(score)
# Output: 20

score = score + 5       # Tính vế phải trước (20 + 5 = 25), rồi gán lại cho score
print(score)
# Output: 25

score += 5              # Viết tắt của: score = score + 5
print(score)
# Output: 30
```

Các toán tử gán viết tắt:

| Viết tắt | Tương đương |
| --- | --- |
| `x += 3` | `x = x + 3` |
| `x -= 3` | `x = x - 3` |
| `x *= 3` | `x = x * 3` |
| `x /= 3` | `x = x / 3` |
| `x //= 3` | `x = x // 3` |
| `x %= 3` | `x = x % 3` |
| `x **= 3` | `x = x ** 3` |

> ⚠️ Python **không có** `x++` hay `x--` như C/Java/C#. Dùng `x += 1` thay thế.

### Gán nhiều biến cùng lúc

```python
# Gán nhiều giá trị cho nhiều biến trên một dòng
x, y, z = 1, 2, 3
print(x, y, z)
# Output: 1 2 3

# Gán cùng một giá trị cho nhiều biến
a = b = c = 0
print(a, b, c)
# Output: 0 0 0

# Hoán đổi (swap) giá trị - "phép thuật" của Python!
x, y = y, x
print(x, y)
# Output: 2 1
```

> 💡 Trong nhiều ngôn ngữ, để hoán đổi 2 biến bạn cần một biến tạm `temp`. Python làm điều đó chỉ bằng `x, y = y, x`.

### Quy tắc đặt tên biến

```python
# ✅ Hợp lệ
user_name = "an"
_private = 1
total2 = 100
tên = "Python chấp nhận cả Unicode, nhưng KHÔNG nên dùng"

# Tên biến phân biệt hoa thường
Age = 1
age = 2
print(Age, age)
# Output: 1 2
```

Quy tắc bắt buộc:

- Chỉ gồm **chữ cái, chữ số và dấu `_`**
- **Không bắt đầu bằng chữ số**: `2name` ❌
- **Không có dấu cách**: `user name` ❌
- **Không trùng từ khóa** (keyword) của Python: `if`, `for`, `class`, `def`, `True`, `None`...

```python
import keyword

# Xem danh sách từ khóa của Python
print(len(keyword.kwlist))
# Output: 35
print(keyword.kwlist[:6])
# Output: ['False', 'None', 'True', 'and', 'as', 'assert']
```

Quy ước (nên làm theo - PEP 8):

- Dùng `snake_case`: `first_name`, `total_price` ✅
- Tên có ý nghĩa: `student_count` ✅ thay vì `sc` hay `x` ❌
- Hằng số viết HOA: `MAX_SPEED = 120` ✅ (Python không cấm đổi giá trị, chỉ là quy ước "đừng đổi")

### Dynamic typing - Kiểu dữ liệu động

Trong C#/Java, bạn phải khai báo kiểu: `int age = 25;`. Trong Python, **không cần**! Python tự biết kiểu dựa trên giá trị. Và một biến có thể đổi sang giá trị kiểu khác:

```python
data = 42
print(type(data))
# Output: <class 'int'>

data = "bốn mươi hai"   # Hoàn toàn hợp lệ
print(type(data))
# Output: <class 'str'>

data = [4, 2]
print(type(data))
# Output: <class 'list'>
```

> 🧠 **Ví dụ dễ hiểu**: Trong Python, **kiểu dữ liệu thuộc về giá trị (món đồ), không thuộc về biến (tờ giấy nhớ)**. Tờ giấy `data` chỉ là cái nhãn, dán lên số hay chuỗi đều được.

**Dynamic typing** nghĩa là kiểu được xác định **lúc chạy** (runtime). Tuy nhiên Python vẫn là ngôn ngữ **strongly typed** (kiểu mạnh): nó **không tự động** chuyển đổi kiểu một cách tùy tiện:

```python
try:
    result = "Tuổi: " + 25          # ❌ Không thể cộng str với int
except TypeError as error:
    print("Lỗi:", error)
# Output: Lỗi: can only concatenate str (not "int") to str

result = "Tuổi: " + str(25)         # ✅ Chuyển int thành str trước
print(result)
# Output: Tuổi: 25
```

> 💡 Đừng lo về `try`/`except` ở đây - chúng ta sẽ học kỹ trong [Bài 7](./07-exceptions-files.md). Tạm hiểu: "thử chạy code, nếu lỗi thì in ra lỗi thay vì dừng chương trình".

### Biến chỉ là "tham chiếu" - id() và is

```python
a = [1, 2, 3]
b = a                   # b và a cùng dán lên MỘT list
b.append(4)
print(a)
# Output: [1, 2, 3, 4]
print(a is b)           # is: kiểm tra có phải CÙNG một đối tượng không
# Output: True
print(id(a) == id(b))   # id(): "địa chỉ" định danh của đối tượng
# Output: True
```

Điều này rất quan trọng khi làm việc với list, dict (sẽ học ở [Bài 5](./05-data-structures.md)). Với số và chuỗi thì không đáng lo vì chúng **không thể thay đổi** (immutable).

### 💡 Tips quan trọng

- `=` là **gán**, `==` là **so sánh** ✅
- Không có `x++`, dùng `x += 1` ✅
- Đặt tên biến **có ý nghĩa**, dạng `snake_case` ✅
- Không đặt tên biến trùng tên hàm có sẵn: `list`, `str`, `sum`, `max`, `input`... ❌

## 📖 2. Các kiểu dữ liệu cơ bản

### Tổng quan

| Kiểu | Tên | Ví dụ | Mô tả |
| --- | --- | --- | --- |
| `int` | Số nguyên | `42`, `-7`, `0` | Không giới hạn độ lớn! |
| `float` | Số thực | `3.14`, `-0.5`, `1e6` | Số có phần thập phân |
| `str` | Chuỗi | `"Hello"`, `'Xin chào'` | Văn bản |
| `bool` | Logic | `True`, `False` | Đúng / Sai |
| `NoneType` | Rỗng | `None` | "Không có giá trị" |

Ngoài ra còn `complex` (số phức, `3+4j`) nhưng ít dùng.

### int - Số nguyên

```python
students = 30
temperature = -5
big_number = 1_000_000_000      # Dấu _ giúp dễ đọc, Python bỏ qua nó
print(big_number)
# Output: 1000000000

# int trong Python KHÔNG bị tràn số (overflow) như C/Java
huge = 2 ** 100
print(huge)
# Output: 1267650600228229401496703205376

# Các hệ cơ số khác
print(0b1010)   # Nhị phân (binary)
# Output: 10
print(0xFF)     # Thập lục phân (hex)
# Output: 255
print(0o17)     # Bát phân (octal)
# Output: 15
```

### float - Số thực

```python
pi = 3.14159
price = 19.99
scientific = 1.5e3      # 1.5 × 10³
print(scientific)
# Output: 1500.0

tiny = 2.5e-4           # 2.5 × 10⁻⁴
print(tiny)
# Output: 0.00025

# Phép chia / LUÔN trả về float, kể cả khi chia hết
print(10 / 2)
# Output: 5.0
```

⚠️ **Sai số dấu chấm động** - điều khiến mọi người mới bất ngờ:

```python
print(0.1 + 0.2)
# Output: 0.30000000000000004
print(0.1 + 0.2 == 0.3)
# Output: False
```

**Tại sao?** Máy tính lưu số ở dạng nhị phân (0 và 1). Giống như `1/3 = 0.3333...` không thể viết chính xác ở hệ thập phân, số `0.1` cũng **không thể biểu diễn chính xác** ở hệ nhị phân. Đây không phải lỗi của Python, mà mọi ngôn ngữ dùng chuẩn IEEE 754 đều vậy.

**Cách xử lý**:

```python
import math
from decimal import Decimal

# Cách 1: So sánh gần đúng
print(math.isclose(0.1 + 0.2, 0.3))
# Output: True

# Cách 2: Làm tròn khi hiển thị
print(round(0.1 + 0.2, 2))
# Output: 0.3

# Cách 3: Dùng Decimal cho tiền tệ (truyền vào dạng CHUỖI)
print(Decimal("0.1") + Decimal("0.2"))
# Output: 0.3
```

> 💡 Khi làm việc với **tiền**, dùng `Decimal` hoặc lưu bằng **số nguyên đơn vị nhỏ nhất** (ví dụ: lưu `19990` đồng thay vì `19.99` nghìn đồng).

### str - Chuỗi

```python
# Dùng nháy đơn hoặc nháy kép đều được
greeting = "Xin chào"
language = 'Python'

# Khi chuỗi chứa dấu nháy, dùng loại nháy còn lại
quote = "It's Python"
html = '<div class="box">'

# Hoặc dùng ký tự thoát (escape) \
quote2 = 'It\'s Python'

# Chuỗi nhiều dòng: dùng 3 dấu nháy
poem = """Dòng thứ nhất
Dòng thứ hai
Dòng thứ ba"""
print(poem)
# Output:
# Dòng thứ nhất
# Dòng thứ hai
# Dòng thứ ba
```

Các ký tự thoát (escape sequences) thường gặp:

| Ký tự | Ý nghĩa |
| --- | --- |
| `\n` | Xuống dòng (newline) |
| `\t` | Tab |
| `\\` | Dấu `\` |
| `\'` / `\"` | Dấu nháy |

```python
# Raw string (r"...") - bỏ qua ký tự thoát, rất hữu ích cho đường dẫn Windows
path = r"C:\Users\new_folder"
print(path)
# Output: C:\Users\new_folder

# Nếu KHÔNG có r, "\n" trong "new_folder" sẽ thành xuống dòng!
print("C:\\Users\\new_folder")    # Phải gõ \\ để ra một dấu \
# Output: C:\Users\new_folder
```

Chuỗi là **bất biến (immutable)** - không sửa được từng ký tự:

```python
word = "Hello"
try:
    word[0] = "J"                 # ❌ Không được
except TypeError as error:
    print(error)
# Output: 'str' object does not support item assignment

word = "J" + word[1:]             # ✅ Tạo chuỗi MỚI
print(word)
# Output: Jello
```

### bool - Logic

```python
is_raining = True
has_umbrella = False

# bool thường là kết quả của phép so sánh
print(5 > 3)
# Output: True
print(10 == 20)
# Output: False

# Thú vị: bool thực chất là con của int! True = 1, False = 0
print(True + True)
# Output: 2
print(sum([True, False, True, True]))    # Đếm số giá trị True
# Output: 3
```

> ⚠️ Viết đúng `True` và `False` (chữ cái đầu viết HOA). `true`, `TRUE` đều là lỗi `NameError`.

### None - "Không có gì"

`None` đại diện cho **sự vắng mặt của giá trị**, tương tự `null` trong C#/Java/JavaScript.

```python
result = None               # Chưa có kết quả
print(result)
# Output: None
print(type(result))
# Output: <class 'NoneType'>

# Kiểm tra None: dùng "is", KHÔNG dùng "=="
if result is None:
    print("Chưa có dữ liệu")
# Output: Chưa có dữ liệu

# Hàm không có return sẽ trả về None
def say_hi():
    print("Hi")

value = say_hi()
# Output: Hi
print(value)
# Output: None
```

> 💡 **Tại sao dùng `is None` thay vì `== None`?** Vì `None` chỉ có **duy nhất một** đối tượng trong toàn bộ chương trình (singleton), nên `is` nhanh hơn và an toàn hơn (`==` có thể bị class tự định nghĩa lại).

## 📖 3. Kiểm tra kiểu: type() và isinstance()

### type() - Trả về kiểu chính xác

```python
print(type(42))
# Output: <class 'int'>
print(type(3.14))
# Output: <class 'float'>
print(type("hi"))
# Output: <class 'str'>
print(type(True))
# Output: <class 'bool'>
print(type(None))
# Output: <class 'NoneType'>

# So sánh kiểu
x = 10
print(type(x) == int)
# Output: True
print(type(x).__name__)     # Lấy tên kiểu dạng chuỗi
# Output: int
```

### isinstance() - Cách kiểm tra được khuyến khích

```python
x = 10
print(isinstance(x, int))
# Output: True

# Kiểm tra nhiều kiểu cùng lúc bằng tuple
print(isinstance(3.5, (int, float)))
# Output: True

# Khác biệt quan trọng: isinstance tính cả quan hệ kế thừa
print(isinstance(True, int))    # bool là con của int
# Output: True
print(type(True) == int)        # type() so sánh chính xác
# Output: False
```

| | `type(x) == T` | `isinstance(x, T)` |
| --- | --- | --- |
| Tính kế thừa | ❌ Không | ✅ Có |
| Kiểm tra nhiều kiểu | ❌ Phải viết nhiều lần | ✅ `isinstance(x, (A, B))` |
| Khuyến nghị | Khi cần kiểu **chính xác** | **Hầu hết trường hợp** |

## 📖 4. Ép kiểu (Type Conversion)

### Ép kiểu tường minh (explicit)

```python
# Sang int
print(int("42"))        # Chuỗi → số
# Output: 42
print(int(3.99))        # float → int: CẮT phần thập phân, KHÔNG làm tròn
# Output: 3
print(int(-3.99))       # Cắt về phía 0
# Output: -3
print(int(True))
# Output: 1

# Sang float
print(float("3.14"))
# Output: 3.14
print(float(7))
# Output: 7.0

# Sang str
print(str(100) + " điểm")
# Output: 100 điểm
print(str(3.5))
# Output: 3.5

# Sang bool
print(bool(1), bool(0))
# Output: True False
print(bool("hello"), bool(""))
# Output: True False
```

### Ép kiểu ngầm định (implicit)

Python chỉ tự động chuyển kiểu trong các trường hợp "an toàn", ví dụ int + float:

```python
result = 5 + 2.0        # int + float → float
print(result, type(result))
# Output: 7.0 <class 'float'>

print(True + 1)         # bool + int → int
# Output: 2
```

### Làm tròn số

```python
print(round(3.7))       # Làm tròn về số nguyên gần nhất
# Output: 4
print(round(3.14159, 2))  # Làm tròn 2 chữ số thập phân
# Output: 3.14

# ⚠️ Python dùng "banker's rounding": .5 làm tròn về số CHẴN gần nhất
print(round(2.5))
# Output: 2
print(round(3.5))
# Output: 4

import math
print(math.floor(3.7))  # Làm tròn xuống
# Output: 3
print(math.ceil(3.2))   # Làm tròn lên
# Output: 4
```

> 🧠 **Tại sao lại làm tròn về số chẵn?** Nếu luôn làm tròn .5 **lên**, khi cộng hàng triệu số, tổng sẽ bị lệch lên. Làm tròn về số chẵn giúp sai số "cân bằng" - nửa lên, nửa xuống. Đây là chuẩn trong kế toán và thống kê.

### Ép kiểu thất bại

```python
try:
    number = int("abc")
except ValueError as error:
    print("Lỗi:", error)
# Output: Lỗi: invalid literal for int() with base 10: 'abc'

try:
    number = int("3.5")       # ❌ int() không nhận chuỗi số thực
except ValueError as error:
    print("Lỗi:", error)
# Output: Lỗi: invalid literal for int() with base 10: '3.5'

print(int(float("3.5")))      # ✅ Chuyển sang float trước
# Output: 3

print(int("  42  "))          # ✅ Khoảng trắng hai đầu được bỏ qua
# Output: 42
```

## 📖 5. Toán tử (Operators)

### Toán tử số học

```python
a = 17
b = 5

print(a + b)    # Cộng
# Output: 22
print(a - b)    # Trừ
# Output: 12
print(a * b)    # Nhân
# Output: 85
print(a / b)    # Chia thường → luôn ra float
# Output: 3.4
print(a // b)   # Chia lấy phần nguyên (floor division)
# Output: 3
print(a % b)    # Chia lấy dư (modulo)
# Output: 2
print(a ** 2)   # Lũy thừa (17²)
# Output: 289
```

### Tìm hiểu kỹ `//`, `%`, `**`

**`//` - Chia lấy phần nguyên (floor division)**: chia rồi **làm tròn XUỐNG** (về phía âm vô cực).

```python
print(7 // 2)       # 3.5 → làm tròn xuống → 3
# Output: 3
print(-7 // 2)      # -3.5 → làm tròn xuống → -4 (KHÔNG phải -3!)
# Output: -4
print(7.0 // 2)     # Nếu có float thì kết quả là float
# Output: 3.0
```

**`%` - Chia lấy dư (modulo)**: rất hay dùng trong thực tế!

```python
# Kiểm tra chẵn/lẻ
print(10 % 2)       # 0 → chẵn
# Output: 0
print(7 % 2)        # 1 → lẻ
# Output: 1

# Đổi giây sang phút:giây
total_seconds = 125
minutes = total_seconds // 60
seconds = total_seconds % 60
print(f"{minutes} phút {seconds} giây")
# Output: 2 phút 5 giây

# Lấy chữ số cuối cùng
print(12345 % 10)
# Output: 5

# Quay vòng (cyclic): ngày trong tuần sau 10 ngày nữa (0 = Thứ 2)
today = 5           # Thứ 7
print((today + 10) % 7)
# Output: 1

# divmod() trả về cả thương và dư cùng lúc
print(divmod(125, 60))
# Output: (2, 5)
```

**`**` - Lũy thừa**:

```python
print(2 ** 10)      # 2 mũ 10
# Output: 1024
print(9 ** 0.5)     # Căn bậc 2 = mũ 0.5
# Output: 3.0
print(2 ** -1)      # Mũ âm
# Output: 0.5
print(pow(2, 3))    # Hàm pow() tương đương
# Output: 8
```

### Thứ tự ưu tiên toán tử

Từ cao xuống thấp (giống toán học):

1. `()` - Ngoặc
2. `**` - Lũy thừa
3. `+x`, `-x` - Dấu dương/âm
4. `*`, `/`, `//`, `%` - Nhân, chia
5. `+`, `-` - Cộng, trừ
6. `==`, `!=`, `<`, `>`, `<=`, `>=`, `is`, `in` - So sánh
7. `not`
8. `and`
9. `or`

```python
print(2 + 3 * 4)        # Nhân trước
# Output: 14
print((2 + 3) * 4)      # Ngoặc trước
# Output: 20
print(-2 ** 2)          # ** ưu tiên cao hơn dấu âm → -(2**2)
# Output: -4
print((-2) ** 2)
# Output: 4
```

> 💡 Khi không chắc, **hãy dùng ngoặc**. Code dễ đọc quan trọng hơn code ngắn.

### Toán tử so sánh

```python
x = 10
print(x == 10)      # Bằng
# Output: True
print(x != 5)       # Khác
# Output: True
print(x > 5, x < 5, x >= 10, x <= 9)
# Output: True False True False

# So sánh chuỗi: theo thứ tự từ điển (mã Unicode)
print("apple" < "banana")
# Output: True
print("Z" < "a")    # Chữ HOA có mã nhỏ hơn chữ thường
# Output: True

# So sánh chuỗi (chained comparison) - rất Pythonic!
age = 25
print(18 <= age < 60)       # Tương đương: 18 <= age and age < 60
# Output: True
```

### Toán tử logic: and, or, not

```python
has_ticket = True
is_vip = False

print(has_ticket and is_vip)    # and: cả hai phải True
# Output: False
print(has_ticket or is_vip)     # or: chỉ cần một True
# Output: True
print(not is_vip)               # not: đảo ngược
# Output: True
```

Bảng chân trị:

| A | B | `A and B` | `A or B` | `not A` |
| --- | --- | --- | --- | --- |
| True | True | True | True | False |
| True | False | False | True | False |
| False | True | False | True | True |
| False | False | False | False | True |

> 💡 Python dùng **từ tiếng Anh** `and`, `or`, `not` thay vì `&&`, `||`, `!` như C#/Java.

### Toán tử thành viên: in, not in

```python
print("Py" in "Python")
# Output: True
print("java" not in "Python")
# Output: True
print(3 in [1, 2, 3])
# Output: True
```

## 📖 6. Làm việc với chuỗi (String Methods)

### Các thao tác cơ bản

```python
first = "Nguyễn"
last = "An"

# Nối chuỗi (concatenation)
full = first + " " + last
print(full)
# Output: Nguyễn An

# Lặp chuỗi
print("-" * 20)
# Output: --------------------

# Độ dài chuỗi
print(len(full))
# Output: 9

# Truy cập từng ký tự theo chỉ số (index), bắt đầu từ 0
word = "Python"
print(word[0])      # Ký tự đầu tiên
# Output: P
print(word[5])      # Ký tự thứ 6
# Output: n
print(word[-1])     # Chỉ số âm: đếm từ cuối lên, -1 là ký tự cuối
# Output: n
print(word[-2])
# Output: o
```

Hình dung chỉ số:

```text
 +---+---+---+---+---+---+
 | P | y | t | h | o | n |
 +---+---+---+---+---+---+
   0   1   2   3   4   5      ← chỉ số dương
  -6  -5  -4  -3  -2  -1      ← chỉ số âm
```

### Đổi chữ hoa/thường

```python
text = "xin CHÀO python"
print(text.upper())         # Tất cả viết HOA
# Output: XIN CHÀO PYTHON
print(text.lower())         # Tất cả viết thường
# Output: xin chào python
print(text.title())         # Viết Hoa Chữ Cái Đầu Mỗi Từ
# Output: Xin Chào Python
print(text.capitalize())    # Chỉ viết hoa chữ đầu tiên của cả chuỗi
# Output: Xin chào python
print(text.swapcase())      # Đảo hoa ↔ thường
# Output: XIN chào PYTHON
```

> ⚠️ **Các method chuỗi KHÔNG thay đổi chuỗi gốc** (vì chuỗi là immutable). Chúng trả về **chuỗi mới**. Muốn lưu kết quả thì phải gán: `text = text.upper()`.

### Xóa khoảng trắng

```python
raw = "   hello world   \n"
print(repr(raw.strip()))    # Xóa 2 đầu (cả \n, \t)
# Output: 'hello world'
print(repr(raw.lstrip()))   # Chỉ xóa bên trái
# Output: 'hello world   \n'
print(repr(raw.rstrip()))   # Chỉ xóa bên phải
# Output: '   hello world'

# Xóa ký tự cụ thể
print("###Tiêu đề###".strip("#"))
# Output: Tiêu đề
```

> 💡 `repr()` hiển thị chuỗi kèm dấu nháy và ký tự đặc biệt, giúp bạn "nhìn thấy" khoảng trắng.

### Tìm kiếm & thay thế

```python
sentence = "Tôi thích Python. Python rất dễ học."

print(sentence.find("Python"))      # Vị trí xuất hiện đầu tiên
# Output: 10
print(sentence.find("Java"))        # Không tìm thấy → -1
# Output: -1
print(sentence.count("Python"))     # Đếm số lần xuất hiện
# Output: 2
print(sentence.replace("Python", "Rust"))
# Output: Tôi thích Rust. Rust rất dễ học.
print(sentence.replace("Python", "Rust", 1))  # Chỉ thay 1 lần
# Output: Tôi thích Rust. Python rất dễ học.

print(sentence.startswith("Tôi"))
# Output: True
print(sentence.endswith("học."))
# Output: True

# index() giống find() nhưng báo lỗi ValueError nếu không tìm thấy
print(sentence.index("thích"))
# Output: 4
```

### Tách và nối chuỗi: split() & join()

Hai method **cực kỳ quan trọng**, bạn sẽ dùng mỗi ngày:

```python
# split(): Tách chuỗi thành list
csv_line = "An,20,Hà Nội"
parts = csv_line.split(",")
print(parts)
# Output: ['An', '20', 'Hà Nội']

# split() không tham số: tách theo MỌI khoảng trắng (và bỏ khoảng trắng thừa)
words = "  Python   là   tuyệt vời  ".split()
print(words)
# Output: ['Python', 'là', 'tuyệt', 'vời']

# join(): Nối list thành chuỗi - gọi trên CHUỖI NGĂN CÁCH
print(" ".join(words))
# Output: Python là tuyệt vời
print("-".join(["2026", "09", "25"]))
# Output: 2026-09-25

# splitlines(): tách theo dòng
text = "dòng 1\ndòng 2\ndòng 3"
print(text.splitlines())
# Output: ['dòng 1', 'dòng 2', 'dòng 3']
```

> 🧠 **Mẹo nhớ `join`**: `"keo".join(các_mảnh)` - chuỗi ngăn cách là "keo dán" các mảnh lại với nhau.

### Kiểm tra nội dung chuỗi

```python
print("12345".isdigit())        # Toàn chữ số?
# Output: True
print("abc".isalpha())          # Toàn chữ cái?
# Output: True
print("abc123".isalnum())       # Chữ hoặc số?
# Output: True
print("   ".isspace())          # Toàn khoảng trắng?
# Output: True
print("HELLO".isupper(), "hello".islower())
# Output: True True
```

### Căn lề

```python
print("|" + "Python".center(12) + "|")
# Output: |   Python   |
print("|" + "Python".ljust(12) + "|")
# Output: |Python      |
print("|" + "Python".rjust(12) + "|")
# Output: |      Python|
print("42".zfill(5))            # Thêm số 0 bên trái
# Output: 00042
```

### Bảng tóm tắt string methods

| Method | Công dụng | Ví dụ → Kết quả |
| --- | --- | --- |
| `upper()` / `lower()` | Đổi hoa/thường | `"Hi".upper()` → `"HI"` |
| `strip()` | Xóa khoảng trắng 2 đầu | `" a ".strip()` → `"a"` |
| `split(sep)` | Tách thành list | `"a,b".split(",")` → `["a", "b"]` |
| `sep.join(list)` | Nối list thành chuỗi | `"-".join(["a", "b"])` → `"a-b"` |
| `replace(old, new)` | Thay thế | `"aa".replace("a", "b")` → `"bb"` |
| `find(sub)` | Tìm vị trí (-1 nếu không có) | `"abc".find("c")` → `2` |
| `count(sub)` | Đếm | `"aaa".count("a")` → `3` |
| `startswith()` / `endswith()` | Kiểm tra đầu/cuối | `"a.py".endswith(".py")` → `True` |
| `isdigit()` | Toàn chữ số? | `"12".isdigit()` → `True` |

## 📖 7. f-strings & Định dạng chuỗi

### Vấn đề với cách nối chuỗi truyền thống

```python
name = "Lan"
age = 22

# ❌ Cách cũ: dài dòng, phải nhớ str()
print("Tôi là " + name + ", " + str(age) + " tuổi.")

# ✅ f-string (Python 3.6+): thêm chữ f trước dấu nháy, đặt biến trong {}
print(f"Tôi là {name}, {age} tuổi.")
# Output: Tôi là Lan, 22 tuổi.
```

### Biểu thức bên trong f-string

Bên trong `{}` có thể là **bất kỳ biểu thức Python** nào:

```python
a, b = 7, 3
print(f"{a} + {b} = {a + b}")
# Output: 7 + 3 = 10

name = "python"
print(f"Tên viết hoa: {name.upper()}")
# Output: Tên viết hoa: PYTHON

items = ["táo", "cam", "xoài"]
print(f"Có {len(items)} loại quả, đầu tiên là {items[0]}")
# Output: Có 3 loại quả, đầu tiên là táo

# Debug nhanh với dấu = (Python 3.8+): in cả tên biến và giá trị
x = 42
print(f"{x = }")
# Output: x = 42
print(f"{a * b = }")
# Output: a * b = 21
```

### Định dạng số (format specifiers)

Cú pháp: `{giá_trị:định_dạng}`

```python
pi = 3.14159265

# Số chữ số thập phân
print(f"{pi:.2f}")          # 2 chữ số sau dấu phẩy
# Output: 3.14
print(f"{pi:.4f}")
# Output: 3.1416

# Dấu phân cách hàng nghìn
salary = 15000000
print(f"{salary:,}")
# Output: 15,000,000
print(f"{salary:,} VNĐ".replace(",", "."))    # Kiểu Việt Nam
# Output: 15.000.000 VNĐ
print(f"{1234567.891:,.2f}")
# Output: 1,234,567.89

# Phần trăm
ratio = 0.8567
print(f"{ratio:.1%}")
# Output: 85.7%

# Thêm số 0 phía trước
order_id = 42
print(f"ORD-{order_id:05d}")
# Output: ORD-00042

# Ký hiệu khoa học
print(f"{123456789:.2e}")
# Output: 1.23e+08
```

### Căn lề trong f-string

```python
# < trái, > phải, ^ giữa; số là độ rộng
print(f"|{'Tên':<10}|{'Điểm':>6}|")
print(f"|{'An':<10}|{8.5:>6.1f}|")
print(f"|{'Bình':<10}|{9.25:>6.1f}|")
print(f"|{'Giữa':^10}|")
print(f"|{'Giữa':*^10}|")     # Ký tự lấp đầy là *
# Output:
# |Tên       |  Điểm|
# |An        |   8.5|
# |Bình      |   9.2|
# |   Giữa   |
# |***Giữa***|
```

> 💡 Để ý `9.25` được làm tròn thành `9.2` (không phải 9.3): khi đúng ở giữa `.x5`, Python làm tròn về chữ số **chẵn** gần nhất ("banker's rounding") - giống hàm `round()` ở phần 4. Với những số như `2.675` thì còn bị thêm sai số nhị phân nên kết quả càng khó đoán - vì vậy tiền tệ nên dùng `Decimal`.

### Các cách định dạng khác (để đọc hiểu code cũ)

```python
name, age = "Hùng", 30

# str.format() - Python 3.0+
print("Tên: {}, Tuổi: {}".format(name, age))
# Output: Tên: Hùng, Tuổi: 30
print("Tên: {n}, Tuổi: {a}".format(n=name, a=age))
# Output: Tên: Hùng, Tuổi: 30

# % formatting - kiểu cũ giống C
print("Tên: %s, Tuổi: %d" % (name, age))
# Output: Tên: Hùng, Tuổi: 30
```

> ✅ Với code mới, **luôn dùng f-string**: ngắn gọn, dễ đọc, nhanh nhất.

## 📖 8. Nhập dữ liệu với input()

### Cách dùng cơ bản

`input()` dừng chương trình, chờ người dùng gõ và nhấn Enter, rồi trả về **chuỗi** (str) vừa gõ.

```python
name = input("Nhập tên của bạn: ")
print(f"Xin chào, {name}!")
```

Khi chạy:

```text
Nhập tên của bạn: An
Xin chào, An!
```

### ⚠️ input() LUÔN trả về chuỗi

Đây là lỗi **số 1** của người mới:

```python
age = input("Nhập tuổi: ")          # Người dùng gõ 20
print(type(age))                    # <class 'str'> - là CHUỖI "20", không phải số 20!
# print(age + 1)                    # ❌ TypeError: can only concatenate str (not "int") to str

age = int(input("Nhập tuổi: "))     # ✅ Chuyển sang int ngay
print(f"Năm sau bạn {age + 1} tuổi")
```

### Ví dụ: Máy tính chỉ số BMI

```python
# bmi.py - Tính chỉ số BMI
print("=== MÁY TÍNH BMI ===")

weight = float(input("Cân nặng (kg): "))
height_cm = float(input("Chiều cao (cm): "))

height_m = height_cm / 100
bmi = weight / height_m ** 2        # ** được tính trước /

print(f"Chỉ số BMI của bạn: {bmi:.1f}")
```

```text
=== MÁY TÍNH BMI ===
Cân nặng (kg): 65
Chiều cao (cm): 170
Chỉ số BMI của bạn: 22.5
```

### Nhập nhiều giá trị trên một dòng

```python
# Người dùng gõ: 3 5 7
a, b, c = input("Nhập 3 số cách nhau bởi dấu cách: ").split()
a, b, c = int(a), int(b), int(c)
print("Tổng:", a + b + c)

# Viết gọn hơn với map() (sẽ học kỹ ở Bài 4)
x, y = map(int, input("Nhập 2 số: ").split())
print("Tích:", x * y)
```

> 💡 Chúng ta sẽ học cách xử lý khi người dùng nhập sai (ví dụ gõ "abc" thay vì số) ở [Bài 7](./07-exceptions-files.md) với `try`/`except`.

## 📖 9. Cắt chuỗi (Slicing)

### Cú pháp

```text
chuỗi[start:stop:step]
```

- `start`: chỉ số bắt đầu (**lấy** phần tử này) - mặc định là 0
- `stop`: chỉ số kết thúc (**KHÔNG lấy** phần tử này) - mặc định là hết chuỗi
- `step`: bước nhảy - mặc định là 1

> 🧠 **Ví dụ dễ hiểu**: Hãy tưởng tượng chỉ số là **các vết cắt giữa các ký tự**, không phải chính ký tự. `s[1:4]` là "cắt ở vết số 1 và vết số 4, lấy phần ở giữa".

```text
   P   y   t   h   o   n
 |   |   |   |   |   |   |
 0   1   2   3   4   5   6
-6  -5  -4  -3  -2  -1
```

### Ví dụ slicing

```python
s = "Python"

print(s[0:2])       # Từ 0 đến trước 2
# Output: Py
print(s[2:5])       # Từ 2 đến trước 5
# Output: tho
print(s[:3])        # Từ đầu đến trước 3
# Output: Pyt
print(s[3:])        # Từ 3 đến hết
# Output: hon
print(s[:])         # Toàn bộ (bản sao)
# Output: Python
print(s[-3:])       # 3 ký tự cuối
# Output: hon
print(s[:-1])       # Bỏ ký tự cuối
# Output: Pytho
print(s[::2])       # Mỗi 2 ký tự lấy 1
# Output: Pto
print(s[::-1])      # Đảo ngược chuỗi!
# Output: nohtyP
print(s[1:100])     # Slicing KHÔNG báo lỗi khi vượt quá độ dài
# Output: ython
```

> 💡 Mẹo: độ dài của `s[a:b]` luôn là `b - a` (khi a, b nằm trong phạm vi). `s[2:5]` có `5 - 2 = 3` ký tự.

### Ứng dụng thực tế

```python
# Lấy phần mở rộng file
filename = "report_2026.pdf"
print(filename[-3:])
# Output: pdf

# Lấy tên file không có phần mở rộng
print(filename[:filename.rfind(".")])   # rfind: tìm từ bên phải
# Output: report_2026

# Kiểm tra palindrome (chuỗi đối xứng)
word = "level"
print(word == word[::-1])
# Output: True

# Che số điện thoại
phone = "0912345678"
print(phone[:3] + "*" * 4 + phone[-3:])
# Output: 091****678

# Tách ngày tháng năm từ chuỗi cố định
date = "2026-09-25"
year, month, day = date[:4], date[5:7], date[8:]
print(day, month, year)
# Output: 25 09 2026
```

### Index vs Slice khi vượt phạm vi

```python
s = "abc"
print(s[1:10])          # Slice: không lỗi
# Output: bc
print(repr(s[5:]))      # Slice ngoài phạm vi → chuỗi rỗng
# Output: ''
try:
    print(s[10])        # Index: LỖI
except IndexError as error:
    print("IndexError:", error)
# Output: IndexError: string index out of range
```

## ⚠️ Lỗi thường gặp

### 1. Quên chuyển kiểu sau input()

```python
# ❌ Sai: input() trả về chuỗi
# age = input("Tuổi: ")       # gõ 20
# print(age * 2)             # In ra "2020" chứ không phải 40!

# ✅ Đúng
age = "20"                   # Giả lập giá trị nhận từ input()
print(age * 2)               # Chuỗi * 2 = lặp chuỗi
# Output: 2020
print(int(age) * 2)
# Output: 40
```

### 2. Cộng chuỗi với số

```python
score = 95
# print("Điểm: " + score)            # ❌ TypeError
print("Điểm: " + str(score))         # ✅ Cách 1
print(f"Điểm: {score}")              # ✅ Cách 2 - khuyến khích
print("Điểm:", score)                # ✅ Cách 3 - print tự thêm dấu cách
# Output:
# Điểm: 95
# Điểm: 95
# Điểm: 95
```

### 3. Nhầm `=` với `==`

```text
if x = 5:        # ❌ SyntaxError: invalid syntax. Maybe you meant '==' or ':=' instead of '='?
    print("x bằng 5")

if x == 5:       # ✅
    print("x bằng 5")
```

### 4. Quên chữ `f` trong f-string

```python
name = "An"
print("Xin chào {name}")      # ❌ In nguyên văn
# Output: Xin chào {name}
print(f"Xin chào {name}")     # ✅
# Output: Xin chào An
```

### 5. Tưởng method chuỗi thay đổi chuỗi gốc

```python
text = "hello"
text.upper()                 # ❌ Kết quả bị bỏ đi
print(text)
# Output: hello

text = text.upper()          # ✅ Gán lại
print(text)
# Output: HELLO
```

### 6. So sánh float bằng `==`

```python
import math

total = 0.1 + 0.2
print(total == 0.3)                 # ❌
# Output: False
print(math.isclose(total, 0.3))     # ✅
# Output: True
```

### 7. Đặt tên biến trùng tên hàm có sẵn

```python
# ❌ Sau dòng này, hàm str() bị "che" mất!
str = "hello"
try:
    print(str(123))
except TypeError as error:
    print(error)
# Output: 'str' object is not callable

del str                      # Xóa biến để lấy lại hàm str gốc
print(str(123))
# Output: 123
```

### 8. Nhầm `/` và `//`

```python
items = 7
per_page = 2
print(items / per_page)      # 3.5 → không dùng làm số trang được
# Output: 3.5
print(items // per_page)     # 3 → số trang đầy
# Output: 3
print(-(-items // per_page)) # 4 → làm tròn lên: số trang cần để chứa hết (mẹo hay)
# Output: 4
```

## 🏋️ Bài tập

### Bài tập 1: Đổi đơn vị nhiệt độ

Viết chương trình nhập nhiệt độ độ C và in ra độ F (công thức `F = C * 9 / 5 + 32`), làm tròn 1 chữ số thập phân.

```text
Nhập nhiệt độ (°C): 36.6
36.6°C = 97.9°F
```

### Bài tập 2: Tách thời gian

Nhập vào một số giây (ví dụ `3725`), in ra dạng `giờ:phút:giây` với 2 chữ số: `01:02:05`.

Gợi ý: dùng `//`, `%` và `f"{x:02d}"`.

### Bài tập 3: Xử lý tên

Nhập họ tên đầy đủ (có thể có khoảng trắng thừa, viết hoa lộn xộn như `"  nGUYỄN   văn   an "`). In ra:

- Họ tên chuẩn hóa: `Nguyễn Văn An`
- Tên (từ cuối cùng): `An`
- Tên viết tắt: `NVA`
- Số ký tự (không tính khoảng trắng): `11`

### Bài tập 4: Hóa đơn

Cho các biến sau, in ra hóa đơn được căn lề đẹp bằng f-string:

```python
item1, price1, qty1 = "Cà phê sữa", 29000, 2
item2, price2, qty2 = "Bánh mì", 25000, 1
item3, price3, qty3 = "Nước cam", 35000, 3
```

```text
==========================================
Món              SL        Đơn giá   Thành tiền
...
TỔNG CỘNG:                          188,000
==========================================
```

### Bài tập 5: Slicing

Cho `s = "Lập trình Python thật thú vị"`, dùng slicing để lấy ra:

1. Từ `"Lập"`
2. Từ `"Python"`
3. Chuỗi đảo ngược
4. Các ký tự ở vị trí chẵn

<details>
<summary>💡 Xem đáp án Bài tập 3</summary>

```python
raw = "  nGUYỄN   văn   an "
normalized = " ".join(raw.split()).title()
print(normalized)
# Output: Nguyễn Văn An
print(normalized.split()[-1])
# Output: An
initials = "".join(word[0] for word in normalized.split())
print(initials)
# Output: NVA
print(len(normalized.replace(" ", "")))
# Output: 11
```

(Dòng `word[0] for word in ...` là **generator expression** - bạn sẽ học ở [Bài 5](./05-data-structures.md) và [Bài 9](./09-advanced-python.md).)

</details>

## ✅ Checklist hoàn thành

- [ ] Hiểu biến là "nhãn dán" tham chiếu tới giá trị
- [ ] Hiểu dynamic typing và strong typing
- [ ] Phân biệt được `int`, `float`, `str`, `bool`, `None`
- [ ] Biết tại sao `0.1 + 0.2 != 0.3` và cách xử lý
- [ ] Dùng `type()` và `isinstance()` đúng lúc
- [ ] Ép kiểu với `int()`, `float()`, `str()`, `bool()`
- [ ] Thành thạo `//`, `%`, `**` và ứng dụng thực tế
- [ ] Dùng được ít nhất 10 string methods
- [ ] Viết f-string với định dạng số (`:.2f`, `:,`, `:>10`)
- [ ] Nhớ rằng `input()` luôn trả về `str`
- [ ] Slicing thành thạo, đảo ngược chuỗi với `[::-1]`
- [ ] Hoàn thành ít nhất 3 bài tập

## 🚀 Tiếp theo

Bạn đã nắm được "nguyên liệu" của mọi chương trình: biến, kiểu dữ liệu và toán tử. Tiếp theo, chúng ta sẽ học cách khiến chương trình **ra quyết định** và **lặp lại công việc**.

**Bài tiếp theo**: [Cấu trúc điều khiển - if, for, while, match](./03-control-flow.md)

---

💡 **Tips nhớ lâu**:

- **`input()` luôn trả về chuỗi** - nhớ ép kiểu!
- **f-string** là cách định dạng chuỗi tốt nhất: `f"{value:.2f}"`
- **Chuỗi bất biến** - method luôn trả về chuỗi mới
- **Slicing `[start:stop:step]`** - lấy start, bỏ stop
- **Không so sánh float bằng `==`** - dùng `math.isclose()`
- **`is None`** thay vì `== None`
