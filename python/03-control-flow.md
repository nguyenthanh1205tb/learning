# 📚 Bài 3: Cấu trúc điều khiển

## 🎯 Mục tiêu bài học

- Viết câu lệnh điều kiện với `if`, `elif`, `else`
- Hiểu **truthy** và **falsy** - cách Python "đánh giá" đúng/sai của mọi giá trị
- Viết biểu thức điều kiện một dòng (ternary operator)
- Dùng vòng lặp `for` với `range()`, `enumerate()`, `zip()`
- Dùng vòng lặp `while` và biết khi nào nên dùng
- Điều khiển vòng lặp với `break`, `continue` và mệnh đề `else` đặc biệt của Python
- Sử dụng `match-case` (structural pattern matching, Python 3.10+)

## 📖 1. Câu lệnh if / elif / else

### Tại sao cần câu lệnh điều kiện?

Cho đến giờ, code của chúng ta chạy **thẳng từ trên xuống dưới**. Nhưng chương trình thực tế cần **ra quyết định**: "Nếu người dùng nhập đúng mật khẩu thì cho vào, ngược lại thì báo lỗi".

> 🧠 **Ví dụ dễ hiểu**: Câu lệnh `if` giống như **ngã rẽ trên đường**. Tới ngã rẽ, bạn nhìn biển báo (điều kiện) rồi chọn đi một hướng.

### if cơ bản

```python
temperature = 35

if temperature > 30:
    print("Trời nóng quá!")
    print("Nhớ uống nhiều nước")

print("Chúc một ngày tốt lành")
# Output:
# Trời nóng quá!
# Nhớ uống nhiều nước
# Chúc một ngày tốt lành
```

Cấu trúc:

1. Từ khóa `if`
2. Điều kiện (biểu thức cho ra `True`/`False`)
3. Dấu hai chấm `:`
4. Khối code **thụt lề 4 dấu cách** - chỉ chạy khi điều kiện đúng

### if / else

```python
age = 16

if age >= 18:
    print("Bạn được phép lái xe ô tô")
else:
    print(f"Bạn cần đợi thêm {18 - age} năm nữa")
# Output: Bạn cần đợi thêm 2 năm nữa
```

### if / elif / else - Nhiều nhánh

`elif` = "else if". Python kiểm tra **từ trên xuống**, gặp điều kiện đúng **đầu tiên** thì chạy khối đó và **bỏ qua tất cả phần còn lại**.

```python
score = 7.8

if score >= 9:
    grade = "Xuất sắc"
elif score >= 8:
    grade = "Giỏi"
elif score >= 6.5:
    grade = "Khá"
elif score >= 5:
    grade = "Trung bình"
else:
    grade = "Yếu"

print(f"Điểm {score} → {grade}")
# Output: Điểm 7.8 → Khá
```

> 💡 **Thứ tự rất quan trọng!** Nếu bạn đặt `elif score >= 5` lên đầu, điểm 9.5 cũng sẽ bị xếp loại "Trung bình" vì điều kiện `>= 5` đúng trước tiên.

```python
# ❌ Thứ tự sai
score = 9.5
if score >= 5:
    print("Trung bình")      # Chạy vào đây và dừng!
elif score >= 9:
    print("Xuất sắc")        # Không bao giờ tới được
# Output: Trung bình
```

### if lồng nhau (nested if)

```python
has_account = True
password_correct = False

if has_account:
    if password_correct:
        print("Đăng nhập thành công")
    else:
        print("Sai mật khẩu")
else:
    print("Vui lòng đăng ký tài khoản")
# Output: Sai mật khẩu
```

Nhiều khi có thể "làm phẳng" if lồng nhau bằng `and`, giúp code dễ đọc hơn:

```python
age = 25
has_license = True

# ❌ Lồng nhau không cần thiết
if age >= 18:
    if has_license:
        print("Được lái xe")

# ✅ Gộp lại bằng and
if age >= 18 and has_license:
    print("Được lái xe")
# Output:
# Được lái xe
# Được lái xe
```

### Kỹ thuật "Early return / Guard clause"

Thay vì lồng nhiều tầng, hãy **xử lý trường hợp đặc biệt trước**. (Chúng ta sẽ học hàm ở [Bài 4](./04-functions.md), đây chỉ là xem trước.)

```python
def check_login(username, password):
    if not username:
        return "Thiếu tên đăng nhập"
    if not password:
        return "Thiếu mật khẩu"
    if len(password) < 8:
        return "Mật khẩu quá ngắn"
    return "OK"


print(check_login("an", ""))
# Output: Thiếu mật khẩu
print(check_login("an", "12345678"))
# Output: OK
```

### Toán tử `in` trong điều kiện

```python
day = "Chủ nhật"

# ❌ Dài dòng
if day == "Thứ 7" or day == "Chủ nhật":
    print("Cuối tuần!")

# ✅ Ngắn gọn với in
if day in ("Thứ 7", "Chủ nhật"):
    print("Cuối tuần!")
# Output:
# Cuối tuần!
# Cuối tuần!
```

> ⚠️ Bẫy kinh điển: `if day == "Thứ 7" or "Chủ nhật":` **luôn luôn đúng**! Vì Python hiểu là `(day == "Thứ 7") or ("Chủ nhật")`, mà chuỗi `"Chủ nhật"` không rỗng nên là truthy. Xem phần tiếp theo để hiểu vì sao.

### 💡 Tips quan trọng

- Luôn có dấu `:` sau điều kiện ✅
- Điều kiện không cần ngoặc: `if x > 5:` ✅ (viết `if (x > 5):` vẫn chạy nhưng không Pythonic)
- Đặt điều kiện **cụ thể nhất / chặt nhất** lên trước trong chuỗi `elif` ✅
- Tránh lồng quá 2-3 tầng - dùng `and`, `or` hoặc guard clause ✅

## 📖 2. Truthy và Falsy

### Mọi giá trị đều có "giá trị đúng/sai"

Trong Python, điều kiện của `if` **không nhất thiết phải là `True`/`False`**. Bất kỳ giá trị nào cũng được Python "quy đổi" sang bool:

- **Falsy** (được xem là sai): những giá trị "rỗng" hoặc "bằng không"
- **Truthy** (được xem là đúng): tất cả những thứ còn lại

| Falsy values | Mô tả |
| --- | --- |
| `False` | Sai |
| `None` | Không có giá trị |
| `0`, `0.0` | Số không |
| `""` | Chuỗi rỗng |
| `[]` | List rỗng |
| `()` | Tuple rỗng |
| `{}` | Dict rỗng |
| `set()` | Set rỗng |

```python
values = [0, 1, -5, "", "0", " ", [], [0], None, 0.0, {}, "False"]

for v in values:
    print(f"{v!r:>8} → {bool(v)}")
# Output:
#        0 → False
#        1 → True
#       -5 → True
#       '' → False
#      '0' → True
#      ' ' → True
#       [] → False
#      [0] → True
#     None → False
#      0.0 → False
#       {} → False
#  'False' → True
```

> 🧠 **Để ý**: `"0"`, `" "` và `"False"` đều là **truthy** vì chúng là chuỗi **không rỗng**. Chỉ có chuỗi rỗng `""` mới là falsy. (`!r` trong f-string nghĩa là hiển thị bằng `repr()`.)

### Ứng dụng: code ngắn gọn và Pythonic

```python
name = ""
items = []

# ❌ Không Pythonic
if len(name) == 0:
    print("Tên trống")
if len(items) > 0:
    print("Có sản phẩm")

# ✅ Pythonic
if not name:
    print("Tên trống")
if items:
    print("Có sản phẩm")
else:
    print("Giỏ hàng trống")
# Output:
# Tên trống
# Tên trống
# Giỏ hàng trống
```

> ⚠️ Cẩn thận khi `0` là giá trị hợp lệ! Ví dụ `if score:` sẽ bỏ qua điểm `0`. Khi muốn kiểm tra "có giá trị hay chưa", hãy dùng `if score is not None:`.

```python
score = 0       # 0 điểm là điểm hợp lệ!

if score:
    print("Có điểm")
else:
    print("Chưa có điểm")         # ❌ Sai logic
# Output: Chưa có điểm

if score is not None:
    print(f"Có điểm: {score}")    # ✅ Đúng
# Output: Có điểm: 0
```

### and / or trả về gì?

Thực ra `and` và `or` **không luôn trả về True/False**, mà trả về **một trong hai toán hạng**:

- `a or b`: nếu `a` truthy → trả về `a`, ngược lại trả về `b`
- `a and b`: nếu `a` falsy → trả về `a`, ngược lại trả về `b`

```python
print("" or "Khách")        # "" falsy → lấy vế phải
# Output: Khách
print("An" or "Khách")      # "An" truthy → lấy vế trái
# Output: An
print(0 and 100)            # 0 falsy → trả về 0 luôn
# Output: 0
print(5 and 100)
# Output: 100

# Ứng dụng: giá trị mặc định
user_input = ""
username = user_input or "Người dùng ẩn danh"
print(username)
# Output: Người dùng ẩn danh
```

### Short-circuit (đánh giá rút gọn)

Python **dừng đánh giá ngay khi biết kết quả**:

```python
items = []

# Nếu items rỗng, vế sau KHÔNG được thực thi → không lỗi IndexError
if items and items[0] > 10:
    print("Phần tử đầu lớn hơn 10")
else:
    print("List rỗng hoặc phần tử đầu <= 10")
# Output: List rỗng hoặc phần tử đầu <= 10
```

## 📖 3. Biểu thức điều kiện (Ternary Operator)

### Cú pháp

```text
giá_trị_nếu_đúng if điều_kiện else giá_trị_nếu_sai
```

```python
age = 20

# Cách thông thường: 4 dòng
if age >= 18:
    status = "Người lớn"
else:
    status = "Trẻ em"

# Ternary: 1 dòng
status = "Người lớn" if age >= 18 else "Trẻ em"
print(status)
# Output: Người lớn

# Dùng trực tiếp trong f-string
n = 7
print(f"{n} là số {'chẵn' if n % 2 == 0 else 'lẻ'}")
# Output: 7 là số lẻ

# Tìm số lớn hơn
a, b = 12, 30
bigger = a if a > b else b
print(bigger)
# Output: 30
```

> ⚠️ Chỉ dùng ternary cho điều kiện **đơn giản**. Đừng lồng ternary kiểu `a if x else b if y else c` - rất khó đọc. Hãy dùng `if/elif/else` bình thường.

## 📖 4. Vòng lặp for

### Tại sao cần vòng lặp?

In ra 5 lời chào:

```python
# ❌ Không có vòng lặp: lặp lại code, không linh hoạt
print("Xin chào lần 1")
print("Xin chào lần 2")
print("Xin chào lần 3")
# ... và nếu cần 1000 lần?
```

> 🧠 **Ví dụ dễ hiểu**: Vòng lặp `for` giống như **băng chuyền trong nhà máy**. Mỗi món hàng (phần tử) đi qua, công nhân (khối code) xử lý nó, rồi tới món tiếp theo, cho đến khi hết hàng.

### for với dãy (sequence)

Vòng `for` trong Python **duyệt qua từng phần tử** của một tập hợp (list, chuỗi, tuple...):

```python
fruits = ["táo", "chuối", "cam"]

for fruit in fruits:
    print(f"Tôi thích ăn {fruit}")
# Output:
# Tôi thích ăn táo
# Tôi thích ăn chuối
# Tôi thích ăn cam

# Duyệt chuỗi: từng ký tự
for char in "Hi!":
    print(char)
# Output:
# H
# i
# !
```

> 💡 `fruit` là biến vòng lặp - ở mỗi lượt, nó được gán bằng phần tử hiện tại. Hãy đặt tên có ý nghĩa: `for student in students`, `for line in lines`...

### range() - Tạo dãy số

```python
# range(stop): từ 0 đến stop-1
for i in range(5):
    print(i, end=" ")
print()
# Output: 0 1 2 3 4

# range(start, stop): từ start đến stop-1
for i in range(1, 6):
    print(i, end=" ")
print()
# Output: 1 2 3 4 5

# range(start, stop, step): có bước nhảy
for i in range(0, 20, 5):
    print(i, end=" ")
print()
# Output: 0 5 10 15

# Đếm ngược: step âm
for i in range(5, 0, -1):
    print(i, end=" ")
print("🚀")
# Output: 5 4 3 2 1 🚀

# Xem range chứa gì bằng cách chuyển sang list
print(list(range(2, 11, 2)))
# Output: [2, 4, 6, 8, 10]
```

> 💡 Giống slicing: `range(start, stop)` **lấy start, bỏ stop**. `range(1, 6)` cho 5 số: 1, 2, 3, 4, 5.

> 🧠 **Tại sao range tiết kiệm bộ nhớ?** `range(1_000_000)` **không tạo** một triệu số trong bộ nhớ. Nó chỉ nhớ start, stop, step và tính ra từng số khi cần ("lazy"). Bạn sẽ hiểu sâu hơn cơ chế duyệt lười này (iterable/iterator, generator) ở [Bài 9](./09-advanced-python.md).

### Ví dụ: tính tổng và bảng cửu chương

```python
# Tính tổng 1 + 2 + ... + 100
total = 0
for n in range(1, 101):
    total += n
print(f"Tổng = {total}")
# Output: Tổng = 5050

# Cách Pythonic: dùng sum()
print(sum(range(1, 101)))
# Output: 5050

# Bảng cửu chương 7
for i in range(1, 11):
    print(f"7 x {i:>2} = {7 * i:>2}")
# Output:
# 7 x  1 =  7
# 7 x  2 = 14
# 7 x  3 = 21
# 7 x  4 = 28
# 7 x  5 = 35
# 7 x  6 = 42
# 7 x  7 = 49
# 7 x  8 = 56
# 7 x  9 = 63
# 7 x 10 = 70
```

### Vòng lặp lồng nhau

```python
# Vẽ tam giác sao
for row in range(1, 5):
    print("*" * row)
# Output:
# *
# **
# ***
# ****

# Duyệt mọi cặp (i, j)
for i in range(1, 3):
    for j in range(1, 4):
        print(f"({i},{j})", end=" ")
    print()     # Xuống dòng sau mỗi hàng
# Output:
# (1,1) (1,2) (1,3)
# (2,1) (2,2) (2,3)
```

### enumerate() - Vừa lấy chỉ số vừa lấy giá trị

Người mới (đặc biệt từ C/Java) hay viết:

```python
players = ["An", "Bình", "Chi"]

# ❌ Kiểu C - không Pythonic
for i in range(len(players)):
    print(i, players[i])
```

Cách đúng là dùng `enumerate()`:

```python
players = ["An", "Bình", "Chi"]

# ✅ Pythonic
for index, name in enumerate(players):
    print(f"{index}. {name}")
# Output:
# 0. An
# 1. Bình
# 2. Chi

# Bắt đầu đếm từ 1 (thân thiện với người dùng hơn)
for rank, name in enumerate(players, start=1):
    print(f"Hạng {rank}: {name}")
# Output:
# Hạng 1: An
# Hạng 2: Bình
# Hạng 3: Chi
```

### zip() - Duyệt nhiều danh sách song song

```python
names = ["An", "Bình", "Chi"]
scores = [8.5, 9.0, 7.5]
cities = ["Hà Nội", "Huế", "Cần Thơ"]

for name, score in zip(names, scores):
    print(f"{name}: {score}")
# Output:
# An: 8.5
# Bình: 9.0
# Chi: 7.5

# zip nhiều hơn 2 danh sách
for name, score, city in zip(names, scores, cities):
    print(f"{name} ({city}) - {score}")
# Output:
# An (Hà Nội) - 8.5
# Bình (Huế) - 9.0
# Chi (Cần Thơ) - 7.5
```

> 🧠 **Ví dụ dễ hiểu**: `zip` giống như **khóa kéo (dây kéo) áo khoác** - kéo 2 hàng răng lại với nhau thành từng cặp.

⚠️ `zip()` **dừng ở danh sách ngắn nhất**:

```python
a = [1, 2, 3, 4, 5]
b = ["x", "y"]
print(list(zip(a, b)))
# Output: [(1, 'x'), (2, 'y')]

# Python 3.10+: strict=True để báo lỗi nếu độ dài khác nhau
try:
    list(zip(a, b, strict=True))
except ValueError as error:
    print("Lỗi:", error)
# Output: Lỗi: zip() argument 2 is shorter than argument 1
```

Kết hợp `enumerate` và `zip`:

```python
names = ["An", "Bình"]
scores = [8.5, 9.0]
for i, (name, score) in enumerate(zip(names, scores), start=1):
    print(i, name, score)
# Output:
# 1 An 8.5
# 2 Bình 9.0
```

### Các hàm hữu ích khác khi lặp

```python
numbers = [3, 1, 4, 1, 5, 9, 2]

# reversed(): duyệt ngược
for n in reversed([1, 2, 3]):
    print(n, end=" ")
print()
# Output: 3 2 1

# sorted(): duyệt theo thứ tự đã sắp xếp (không đổi list gốc)
for n in sorted(numbers):
    print(n, end=" ")
print()
# Output: 1 1 2 3 4 5 9

print(min(numbers), max(numbers), sum(numbers))
# Output: 1 9 25

# any(): có ít nhất 1 phần tử thỏa mãn?  all(): tất cả đều thỏa mãn?
# (n > 8 for n in numbers) là "generator expression": tính n > 8 cho từng n.
# Cú pháp này sẽ học kỹ ở Bài 5 (comprehension) - giờ chỉ cần đọc hiểu.
print(any(n > 8 for n in numbers))
# Output: True
print(all(n > 0 for n in numbers))
# Output: True
```

## 📖 5. Vòng lặp while

### Cú pháp

`while` lặp lại **chừng nào điều kiện còn đúng**:

```python
count = 1
while count <= 5:
    print(f"Lần thứ {count}")
    count += 1          # ⚠️ Quan trọng: phải thay đổi điều kiện, nếu không sẽ lặp vô hạn!
print("Xong")
# Output:
# Lần thứ 1
# Lần thứ 2
# Lần thứ 3
# Lần thứ 4
# Lần thứ 5
# Xong
```

### for hay while?

| Dùng `for` khi | Dùng `while` khi |
| --- | --- |
| Biết trước số lần lặp | **Không biết trước** số lần lặp |
| Duyệt qua một tập hợp | Lặp đến khi một điều kiện thay đổi |
| Ví dụ: in 10 dòng, duyệt list | Ví dụ: chờ người dùng nhập đúng, game loop |

> 🧠 **Ví dụ dễ hiểu**: `for` giống như "chạy 10 vòng sân". `while` giống như "chạy cho đến khi mệt".

### Ví dụ: Tiết kiệm tiền

```python
# Gửi 100 triệu, lãi 6%/năm. Bao nhiêu năm để có 200 triệu?
money = 100_000_000
years = 0

while money < 200_000_000:
    money *= 1.06
    years += 1

print(f"Cần {years} năm, số tiền: {money:,.0f} đồng")
# Output: Cần 12 năm, số tiền: 201,219,647 đồng
```

### Ví dụ: Thuật toán Collatz

```python
# Lấy n: nếu chẵn chia 2, nếu lẻ nhân 3 cộng 1. Lặp đến khi n = 1.
n = 6
steps = [n]
while n != 1:
    n = n // 2 if n % 2 == 0 else 3 * n + 1
    steps.append(n)
print(steps)
# Output: [6, 3, 10, 5, 16, 8, 4, 2, 1]
```

### Vòng lặp vô hạn có chủ đích: while True

```python
# Mô phỏng menu - trong thực tế lệnh lấy từ input()
commands = ["help", "list", "quit", "không bao giờ tới đây"]
i = 0

while True:                       # Lặp mãi mãi...
    command = commands[i]
    i += 1
    if command == "quit":
        print("Tạm biệt!")
        break                     # ...cho đến khi gặp break
    print(f"Thực hiện lệnh: {command}")
# Output:
# Thực hiện lệnh: help
# Thực hiện lệnh: list
# Tạm biệt!
```

Ví dụ thực tế với `input()` - kiểm tra dữ liệu nhập:

```python
while True:
    text = input("Nhập tuổi (1-120): ")
    if text.isdigit() and 1 <= int(text) <= 120:
        age = int(text)
        break
    print("❌ Không hợp lệ, vui lòng nhập lại!")

print(f"✅ Tuổi của bạn: {age}")
```

> 💡 Nếu lỡ viết vòng lặp vô hạn mà không có `break`, nhấn **`Ctrl+C`** trong terminal để dừng chương trình.

### Walrus operator `:=` (Python 3.8+)

Toán tử `:=` vừa **gán** vừa **trả về giá trị**, rất gọn trong `while`:

```python
data = [5, 3, 0, 8]
index = 0

# Gán và kiểm tra cùng lúc
while (value := data[index]) != 0:
    print("Xử lý:", value)
    index += 1
# Output:
# Xử lý: 5
# Xử lý: 3
```

## 📖 6. break, continue và else trong vòng lặp

### break - Thoát vòng lặp ngay lập tức

```python
numbers = [4, 7, 12, 3, 15, 8]

# Tìm số đầu tiên lớn hơn 10
for n in numbers:
    print(f"Kiểm tra {n}")
    if n > 10:
        print(f"Tìm thấy: {n}")
        break
# Output:
# Kiểm tra 4
# Kiểm tra 7
# Kiểm tra 12
# Tìm thấy: 12
```

### continue - Bỏ qua lượt hiện tại, sang lượt tiếp theo

```python
# In các số lẻ từ 1 đến 10
for n in range(1, 11):
    if n % 2 == 0:
        continue        # Số chẵn → bỏ qua phần dưới, sang lượt tiếp
    print(n, end=" ")
print()
# Output: 1 3 5 7 9

# Ứng dụng: bỏ qua dữ liệu không hợp lệ
lines = ["An,8", "", "# comment", "Bình,9"]
for line in lines:
    if not line or line.startswith("#"):
        continue
    name, score = line.split(",")
    print(f"{name} được {score} điểm")
# Output:
# An được 8 điểm
# Bình được 9 điểm
```

> 🧠 **Ví dụ dễ hiểu**: Trong băng chuyền, `continue` là **"bỏ món này, lấy món tiếp theo"**, còn `break` là **"tắt băng chuyền, về nhà"**.

### break trong vòng lặp lồng nhau

`break` chỉ thoát khỏi **vòng lặp gần nhất** chứa nó:

```python
for i in range(3):
    for j in range(3):
        if j == 1:
            break           # Chỉ thoát vòng j
        print(f"i={i}, j={j}")
# Output:
# i=0, j=0
# i=1, j=0
# i=2, j=0
```

### else trong vòng lặp - Tính năng độc đáo của Python

Khối `else` của vòng lặp chạy khi **vòng lặp kết thúc bình thường** (không bị `break`).

> 🧠 **Cách nhớ**: Hãy đọc `else` của vòng lặp là **"nobreak"** - "nếu không có break thì làm việc này".

```python
def find_user(users, target):
    for user in users:
        if user == target:
            print(f"Tìm thấy {target}!")
            break
    else:
        # Chỉ chạy khi duyệt hết mà không break
        print(f"Không tìm thấy {target}")


find_user(["an", "binh", "chi"], "binh")
# Output: Tìm thấy binh!
find_user(["an", "binh", "chi"], "dung")
# Output: Không tìm thấy dung
```

Ví dụ kinh điển: kiểm tra số nguyên tố:

```python
for n in range(2, 20):
    for divisor in range(2, int(n ** 0.5) + 1):
        if n % divisor == 0:
            break           # Có ước → không phải số nguyên tố
    else:
        print(n, end=" ")   # Không tìm thấy ước nào → số nguyên tố
print()
# Output: 2 3 5 7 11 13 17 19
```

Nếu không có `for...else`, bạn phải dùng thêm một biến cờ (flag):

```python
n = 17
is_prime = True                     # Biến cờ
for divisor in range(2, n):
    if n % divisor == 0:
        is_prime = False
        break
if is_prime:
    print(f"{n} là số nguyên tố")
# Output: 17 là số nguyên tố
```

`while` cũng có `else`:

```python
attempts = 0
while attempts < 3:
    attempts += 1
    print(f"Thử lần {attempts}...")
else:
    print("Đã thử hết 3 lần")
# Output:
# Thử lần 1...
# Thử lần 2...
# Thử lần 3...
# Đã thử hết 3 lần
```

### pass - Câu lệnh "không làm gì"

Python không cho phép khối code rỗng. `pass` là câu lệnh giữ chỗ:

```python
for i in range(3):
    pass            # TODO: sẽ viết sau

if True:
    pass            # Giữ chỗ, chưa xử lý

print("Chạy bình thường")
# Output: Chạy bình thường
```

## 📖 7. match-case (Python 3.10+)

### Giới thiệu

`match-case` (**structural pattern matching**) giống `switch-case` trong C#/Java nhưng **mạnh hơn nhiều**: có thể so khớp theo cấu trúc dữ liệu, không chỉ so sánh giá trị.

> ⚠️ Cần **Python 3.10 trở lên**. Kiểm tra bằng `python --version`.

> 💡 Các ví dụ bên dưới đặt `match` bên trong một **hàm** (`def ten_ham(tham_so):` ... `return giá_trị`) giống ví dụ guard clause ở phần 1 và `find_user` ở phần 6. Tạm hiểu: `return` trả kết quả về cho chỗ gọi hàm. Hàm sẽ được học kỹ ở [Bài 4](./04-functions.md).

### Match giá trị đơn giản

```python
def http_status(code):
    match code:
        case 200:
            return "OK"
        case 404:
            return "Không tìm thấy"
        case 500:
            return "Lỗi server"
        case _:                     # _ là "wildcard": khớp với mọi thứ (như default)
            return "Mã không xác định"


print(http_status(404))
# Output: Không tìm thấy
print(http_status(418))
# Output: Mã không xác định
```

> 💡 Khác với `switch` trong C/Java, `match` **không cần `break`** - chỉ chạy **một** `case` khớp đầu tiên.

### Nhiều giá trị trong một case: `|`

```python
def day_type(day):
    match day.lower():
        case "thứ 7" | "chủ nhật":
            return "Cuối tuần 🎉"
        case "thứ 2" | "thứ 3" | "thứ 4" | "thứ 5" | "thứ 6":
            return "Ngày làm việc 💼"
        case _:
            return "Không hợp lệ"


print(day_type("Chủ nhật"))
# Output: Cuối tuần 🎉
print(day_type("Thứ 3"))
# Output: Ngày làm việc 💼
```

### Guard - Thêm điều kiện với if

```python
def classify(n):
    match n:
        case 0:
            return "không"
        case x if x < 0:
            return "số âm"
        case x if x % 2 == 0:
            return "số dương chẵn"
        case _:
            return "số dương lẻ"


for n in [0, -3, 8, 7]:
    print(n, "→", classify(n))
# Output:
# 0 → không
# -3 → số âm
# 8 → số dương chẵn
# 7 → số dương lẻ
```

### Match theo cấu trúc: sequence (list/tuple)

Đây là lúc `match` thực sự tỏa sáng - vừa **kiểm tra cấu trúc** vừa **tách giá trị**:

```python
def handle_command(command):
    match command.split():
        case ["quit"]:
            return "Thoát chương trình"
        case ["go", direction]:
            return f"Đi về hướng {direction}"
        case ["pick", "up", item]:
            return f"Nhặt {item}"
        case ["drop", *items]:              # *items: gom tất cả phần còn lại
            return f"Bỏ {len(items)} món: {', '.join(items)}"
        case _:
            return "Lệnh không hợp lệ"


print(handle_command("go north"))
# Output: Đi về hướng north
print(handle_command("pick up sword"))
# Output: Nhặt sword
print(handle_command("drop key coin map"))
# Output: Bỏ 3 món: key, coin, map
print(handle_command("dance"))
# Output: Lệnh không hợp lệ
```

### Match theo cấu trúc: dict

```python
def process_event(event):
    match event:
        case {"type": "click", "x": x, "y": y}:
            return f"Click tại ({x}, {y})"
        case {"type": "key", "key": "Enter"}:
            return "Nhấn Enter"
        case {"type": "key", "key": key}:
            return f"Nhấn phím {key}"
        case _:
            return "Sự kiện không rõ"


print(process_event({"type": "click", "x": 10, "y": 20}))
# Output: Click tại (10, 20)
print(process_event({"type": "key", "key": "A", "shift": True}))   # Key thừa vẫn khớp
# Output: Nhấn phím A
```

### Match theo kiểu dữ liệu

```python
def describe(value):
    match value:
        case bool():            # Phải đặt trước int() vì bool là con của int
            return f"Boolean: {value}"
        case int() | float():
            return f"Số: {value}"
        case str() if not value:
            return "Chuỗi rỗng"
        case str():
            return f"Chuỗi: {value}"
        case [first, *rest]:
            return f"List bắt đầu bằng {first}, còn {len(rest)} phần tử"
        case None:
            return "Không có giá trị"
        case _:
            return "Kiểu khác"


print(describe(True))
# Output: Boolean: True
print(describe(3.14))
# Output: Số: 3.14
print(describe(""))
# Output: Chuỗi rỗng
print(describe([1, 2, 3]))
# Output: List bắt đầu bằng 1, còn 2 phần tử
print(describe(None))
# Output: Không có giá trị
```

### Khi nào dùng match, khi nào dùng if?

- **if/elif**: điều kiện so sánh đơn giản, khoảng giá trị (`score >= 8`)
- **match**: so khớp nhiều giá trị cố định, hoặc **tách cấu trúc dữ liệu** (lệnh, JSON, event)

## ⚠️ Lỗi thường gặp

### 1. Quên dấu `:` hoặc thụt lề sai

```text
if x > 5                 # ❌ SyntaxError: expected ':'
    print("lớn")

for i in range(3):
print(i)                 # ❌ IndentationError: expected an indented block
```

### 2. Dùng `or` sai cách

```python
color = "xanh"

# ❌ Luôn đúng! Vì "đỏ" là chuỗi không rỗng → truthy
if color == "vàng" or "đỏ":
    print("Sai: vào đây dù color là xanh")

# ✅ Đúng
if color == "vàng" or color == "đỏ":
    print("Không in dòng này")
if color in ("vàng", "đỏ"):
    print("Không in dòng này")
# Output: Sai: vào đây dù color là xanh
```

### 3. Vòng lặp while vô hạn vì quên cập nhật biến

```text
count = 0
while count < 5:
    print(count)
    # ❌ Quên count += 1 → in 0 mãi mãi. Nhấn Ctrl+C để dừng!
```

### 4. Sửa list trong khi đang duyệt nó

```python
numbers = [1, 2, 2, 3, 4]

# ❌ Xóa phần tử khi đang lặp → bỏ sót phần tử
for n in numbers:
    if n == 2:
        numbers.remove(n)
print(numbers)
# Output: [1, 2, 3, 4]

# ✅ Duyệt trên bản sao, hoặc tạo list mới
numbers = [1, 2, 2, 3, 4]
numbers = [n for n in numbers if n != 2]    # List comprehension (Bài 5)
print(numbers)
# Output: [1, 3, 4]
```

> 🧠 **Tại sao?** Khi xóa phần tử ở vị trí 1, các phần tử phía sau "dịch lên" một vị trí. Vòng lặp tiếp tục ở vị trí 2 → nhảy qua mất số `2` thứ hai.

### 5. Off-by-one với range()

```python
# Muốn in 1 đến 10
print(list(range(1, 10)))     # ❌ Thiếu số 10
# Output: [1, 2, 3, 4, 5, 6, 7, 8, 9]
print(list(range(1, 11)))     # ✅
# Output: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
```

### 6. Dùng `range(len(...))` khi không cần

```python
colors = ["đỏ", "xanh"]
# ❌ for i in range(len(colors)): print(colors[i])
# ✅
for color in colors:
    print(color)
# Output:
# đỏ
# xanh
```

### 7. Hiểu sai `else` của vòng lặp

```python
for i in range(3):
    pass
else:
    print("else chạy vì vòng lặp KHÔNG bị break")   # Không phải "chạy khi vòng lặp rỗng"!
# Output: else chạy vì vòng lặp KHÔNG bị break
```

### 8. Dùng tên biến trong case mà tưởng là so sánh

```python
QUIT = "quit"

def check(cmd):
    match cmd:
        # ❌ case QUIT: sẽ KHÔNG so sánh với biến QUIT mà GÁN cmd vào tên QUIT
        #    → khớp mọi thứ! (Python còn báo SyntaxError nếu có case sau nó)
        case "quit":        # ✅ Dùng giá trị trực tiếp (literal)
            return "thoát"
        case _:
            return "khác"


print(check("hello"))
# Output: khác
```

> 💡 Muốn so sánh với hằng số trong `case`, dùng **tên có dấu chấm** như `Color.RED` (enum) hoặc `config.QUIT` - Python mới hiểu đó là giá trị cần so sánh.

## 🏋️ Bài tập

### Bài tập 1: FizzBuzz

In các số từ 1 đến 30. Với số chia hết cho 3 in `Fizz`, chia hết cho 5 in `Buzz`, chia hết cho cả 3 và 5 in `FizzBuzz`.

### Bài tập 2: Tam giác số

Nhập `n`, in ra:

```text
1
1 2
1 2 3
1 2 3 4
```

### Bài tập 3: Thống kê điểm

Cho `scores = [7.5, 9, 4, 6.5, 8, 3.5, 10]`. Dùng vòng lặp (không dùng `sum`, `max`, `min`) để tính: điểm trung bình, điểm cao nhất, số học sinh dưới 5 điểm.

### Bài tập 4: Đoán số

Chương trình chọn ngẫu nhiên một số từ 1-100 (`import random; secret = random.randint(1, 100)`). Người chơi đoán, chương trình gợi ý "Lớn hơn"/"Nhỏ hơn". Tối đa 7 lượt. Dùng `while` + `break` + `else` để báo thua khi hết lượt.

### Bài tập 5: Máy tính với match-case

Nhập một chuỗi như `"5 + 3"`, `"10 / 2"`, dùng `split()` và `match` để tính kết quả. Xử lý chia cho 0 và phép toán không hợp lệ.

<details>
<summary>💡 Xem đáp án Bài tập 1</summary>

```python
for n in range(1, 16):        # In 1-15 cho gọn; đề bài dùng range(1, 31)
    if n % 15 == 0:           # Kiểm tra trường hợp chặt nhất trước!
        print("FizzBuzz")
    elif n % 3 == 0:
        print("Fizz")
    elif n % 5 == 0:
        print("Buzz")
    else:
        print(n)
# Output:
# 1
# 2
# Fizz
# 4
# Buzz
# Fizz
# 7
# 8
# Fizz
# Buzz
# 11
# Fizz
# 13
# 14
# FizzBuzz
```

</details>

## ✅ Checklist hoàn thành

- [ ] Viết được `if/elif/else` và hiểu thứ tự kiểm tra
- [ ] Liệt kê được các giá trị falsy
- [ ] Biết dùng `if items:` thay vì `if len(items) > 0:`
- [ ] Hiểu `and`/`or` trả về toán hạng và short-circuit
- [ ] Viết ternary: `a if cond else b`
- [ ] Dùng `range()` với 1, 2, 3 tham số
- [ ] Dùng `enumerate()` thay cho `range(len(...))`
- [ ] Dùng `zip()` duyệt song song
- [ ] Biết khi nào dùng `for`, khi nào dùng `while`
- [ ] Phân biệt `break`, `continue`, `pass`
- [ ] Hiểu `for...else` ("nobreak")
- [ ] Viết `match-case` với literal, `|`, guard, sequence, dict
- [ ] Hoàn thành ít nhất 3 bài tập

## 🚀 Tiếp theo

Chương trình của bạn giờ đã biết ra quyết định và lặp lại công việc. Nhưng khi code dài hơn, bạn sẽ thấy nhiều đoạn bị lặp lại. Đã đến lúc học cách **đóng gói logic thành hàm** để tái sử dụng!

**Bài tiếp theo**: [Hàm (Functions)](./04-functions.md)

---

💡 **Tips nhớ lâu**:

- **Falsy**: `False, None, 0, 0.0, "", [], (), {}, set()` - còn lại là truthy
- **`for` duyệt phần tử**, không cần chỉ số → cần chỉ số thì `enumerate()`
- **`zip()`** ghép nhiều list, dừng ở list ngắn nhất
- **`for...else`** = "nếu không break"
- **`match-case`** mạnh nhất khi tách cấu trúc dữ liệu
