# 📚 Bài 6: Lập trình hướng đối tượng (OOP)

## 🎯 Mục tiêu bài học

- Hiểu OOP là gì và tại sao cần nó
- Tạo **class**, **object**, dùng `__init__` và `self`
- Phân biệt **instance attribute** và **class attribute**
- Viết **instance method**, **class method** (`@classmethod`), **static method** (`@staticmethod`)
- Kiểm soát truy cập thuộc tính với `@property` (getter/setter)
- Hiểu **kế thừa** (inheritance), `super()`, **ghi đè method** (overriding)
- Hiểu **đa hình** (polymorphism) và "duck typing"
- Viết **dunder methods**: `__str__`, `__repr__`, `__eq__`, `__lt__`, `__len__`, `__add__`...
- Dùng **dataclasses** để viết class ngắn gọn
- Tạo **abstract class** với module `abc`

## 📖 1. OOP là gì?

### Vấn đề khi chỉ dùng dict và hàm

Giả sử bạn quản lý tài khoản ngân hàng:

```python
account = {"owner": "An", "balance": 1_000_000}


def deposit(acc, amount):
    acc["balance"] += amount


def withdraw(acc, amount):
    if amount > acc["balance"]:
        print("Không đủ tiền")
        return
    acc["balance"] -= amount


deposit(account, 500_000)
account["balance"] = -999_999_999      # 😱 Ai cũng sửa được trực tiếp, không kiểm soát!
print(account["balance"])
# Output: -999999999
```

Vấn đề:

- Dữ liệu (`account`) và hành vi (`deposit`, `withdraw`) **tách rời** nhau
- Không có gì ngăn người khác **sửa dữ liệu sai cách**
- Gõ nhầm key `"balence"` → lỗi khó tìm

### Giải pháp: Lập trình hướng đối tượng

**OOP (Object-Oriented Programming)** gộp **dữ liệu** (attributes) và **hành vi** (methods) liên quan vào **một đơn vị** gọi là **object** (đối tượng).

> 🧠 **Ví dụ dễ hiểu**:
>
> - **Class** (lớp) = **bản thiết kế** ngôi nhà 🏗️: mô tả nhà có mấy phòng, cửa ở đâu
> - **Object** (đối tượng) = **ngôi nhà thật** 🏠 được xây từ bản thiết kế. Từ một bản thiết kế có thể xây nhiều ngôi nhà, mỗi nhà có màu sơn, chủ nhà khác nhau
> - **Attribute** (thuộc tính) = đặc điểm của nhà: màu sơn, số phòng
> - **Method** (phương thức) = việc nhà có thể làm: mở cửa, bật đèn

### 4 trụ cột của OOP

| Trụ cột | Ý nghĩa | Ví dụ đời thường |
| --- | --- | --- |
| **Encapsulation** (Đóng gói) | Gộp dữ liệu + hành vi, che giấu chi tiết bên trong | Bạn lái xe bằng vô-lăng, không cần biết động cơ hoạt động thế nào |
| **Inheritance** (Kế thừa) | Class con thừa hưởng từ class cha | Xe điện là một loại xe, có mọi thứ của xe + thêm pin |
| **Polymorphism** (Đa hình) | Cùng một lời gọi, mỗi đối tượng phản ứng khác nhau | "Kêu đi!" → chó sủa, mèo meo |
| **Abstraction** (Trừu tượng) | Chỉ đưa ra những gì cần thiết, ẩn sự phức tạp | Nút "Gửi" email - bạn không cần biết giao thức SMTP |

### Thực ra bạn đã dùng object từ đầu!

Trong Python, **mọi thứ đều là object**:

```python
name = "python"
print(type(name))           # name là object của class str
# Output: <class 'str'>
print(name.upper())         # upper() là method của class str
# Output: PYTHON

numbers = [3, 1, 2]
numbers.sort()              # sort() là method của class list
print(numbers)
# Output: [1, 2, 3]

print(isinstance(42, object), isinstance(print, object))
# Output: True True
```

## 📖 2. Class, Object, `__init__` và `self`

### Class đơn giản nhất

```python
class Dog:
    pass                    # Class rỗng


my_dog = Dog()              # Tạo object (instance) từ class
your_dog = Dog()            # Một object khác

print(type(my_dog))
# Output: <class '__main__.Dog'>
print(my_dog is your_dog)   # Hai object khác nhau
# Output: False
```

> 💡 Tên class dùng **PascalCase**: `Dog`, `BankAccount`, `HttpRequest`.

### `__init__` - Hàm khởi tạo (constructor)

`__init__` được gọi **tự động** mỗi khi tạo object mới, dùng để **thiết lập giá trị ban đầu**:

```python
class Dog:
    def __init__(self, name, age):
        self.name = name        # Tạo attribute name cho object
        self.age = age
        self.tricks = []        # Attribute có giá trị mặc định
        print(f"🐶 {name} vừa được tạo!")


buddy = Dog("Buddy", 3)
# Output: 🐶 Buddy vừa được tạo!
milo = Dog("Milo", 5)
# Output: 🐶 Milo vừa được tạo!

print(buddy.name, buddy.age)
# Output: Buddy 3
print(milo.name, milo.age)
# Output: Milo 5
```

### `self` là gì?

`self` là **tham chiếu tới chính object đang được thao tác**.

> 🧠 **Ví dụ dễ hiểu**: Trong lớp học, cô giáo nói "Mỗi em hãy viết **tên của mình** lên vở". Chữ "của mình" với bạn An là "An", với bạn Bình là "Bình". `self` chính là "của mình" - cùng một đoạn code nhưng áp dụng cho từng object riêng.

Khi bạn viết `buddy.bark()`, Python thực chất gọi `Dog.bark(buddy)` - tự động truyền `buddy` vào vị trí `self`:

```python
class Dog:
    def __init__(self, name):
        self.name = name

    def bark(self):             # Method: hàm định nghĩa trong class, tham số đầu là self
        print(f"{self.name}: Gâu gâu!")


buddy = Dog("Buddy")
buddy.bark()                    # Cách gọi thông thường
# Output: Buddy: Gâu gâu!
Dog.bark(buddy)                 # Hoàn toàn tương đương!
# Output: Buddy: Gâu gâu!
```

> ⚠️ `self` chỉ là **quy ước đặt tên** (có thể đặt tên khác), nhưng **luôn dùng `self`** để mọi người đều hiểu.

### Ví dụ hoàn chỉnh: BankAccount

```python
class BankAccount:
    def __init__(self, owner: str, balance: int = 0):
        self.owner = owner
        self.balance = balance
        self.history = []

    def deposit(self, amount: int) -> None:
        if amount <= 0:
            print("❌ Số tiền nạp phải lớn hơn 0")
            return
        self.balance += amount
        self.history.append(f"+{amount:,}")

    def withdraw(self, amount: int) -> bool:
        if amount > self.balance:
            print(f"❌ Không đủ tiền (số dư: {self.balance:,})")
            return False
        self.balance -= amount
        self.history.append(f"-{amount:,}")
        return True

    def show(self) -> None:
        print(f"{self.owner}: {self.balance:,}đ | Lịch sử: {self.history}")


acc = BankAccount("An", 1_000_000)
acc.deposit(500_000)
acc.withdraw(2_000_000)
# Output: ❌ Không đủ tiền (số dư: 1,500,000)
acc.withdraw(300_000)
acc.show()
# Output: An: 1,200,000đ | Lịch sử: ['+500,000', '-300,000']
```

## 📖 3. Instance attribute vs Class attribute

### Sự khác biệt

- **Instance attribute**: gắn với **từng object** (định nghĩa qua `self.xxx` trong `__init__`) → mỗi object có giá trị riêng
- **Class attribute**: gắn với **class**, **dùng chung** cho mọi object (định nghĩa ngay trong thân class)

```python
class Student:
    school = "THPT Chu Văn An"     # Class attribute - chung cho mọi học sinh
    count = 0                       # Đếm số học sinh đã tạo

    def __init__(self, name):
        self.name = name            # Instance attribute - riêng từng học sinh
        Student.count += 1          # Truy cập class attribute qua tên class


a = Student("An")
b = Student("Bình")

print(a.name, b.name)
# Output: An Bình
print(a.school, b.school)           # Đọc được qua object
# Output: THPT Chu Văn An THPT Chu Văn An
print(Student.count)
# Output: 2

Student.school = "THPT Lê Quý Đôn"  # Đổi qua class → mọi object đều thấy
print(a.school, b.school)
# Output: THPT Lê Quý Đôn THPT Lê Quý Đôn
```

### ⚠️ Bẫy: gán class attribute qua object

```python
class Student:
    school = "Trường A"


a = Student()
b = Student()
a.school = "Trường B"       # ⚠️ KHÔNG sửa class attribute, mà tạo instance attribute MỚI cho a!

print(a.school, b.school, Student.school)
# Output: Trường B Trường A Trường A
print(a.__dict__, b.__dict__)       # __dict__ chứa instance attributes
# Output: {'school': 'Trường B'} {}
```

### ⚠️ Bẫy: class attribute là list

```python
class Team:
    members = []            # ❌ List DÙNG CHUNG cho mọi team!

    def add(self, name):
        self.members.append(name)


red = Team()
blue = Team()
red.add("An")
print(blue.members)         # blue cũng có An 😱
# Output: ['An']


class TeamFixed:
    def __init__(self):
        self.members = []   # ✅ Mỗi team một list riêng
```

> 💡 Giống bẫy mutable default ở [Bài 4](./04-functions.md): dữ liệu **mutable** mà mỗi object cần riêng → luôn tạo trong `__init__`.

## 📖 4. Instance method, Class method, Static method

> 💡 Dòng bắt đầu bằng `@` đặt ngay trên `def` (như `@classmethod`, `@staticmethod`, và `@property`, `@dataclass` ở các phần sau) gọi là **decorator**. Tạm hiểu nó là một "nhãn" gắn thêm tính năng cho hàm/class bên dưới. Bạn chỉ cần biết **dùng** chúng ở bài này; cách decorator hoạt động và cách tự viết decorator sẽ học ở [Bài 9](./09-advanced-python.md).

```python
from datetime import date


class Person:
    species = "Homo sapiens"

    def __init__(self, name: str, birth_year: int):
        self.name = name
        self.birth_year = birth_year

    # 1. Instance method: làm việc với MỘT object cụ thể (có self)
    def age(self) -> int:
        return date.today().year - self.birth_year

    # 2. Class method: làm việc với CLASS (có cls thay vì self)
    @classmethod
    def from_string(cls, text: str) -> "Person":
        """Constructor thay thế: tạo Person từ chuỗi 'Tên-Năm sinh'."""
        name, year = text.split("-")
        return cls(name, int(year))     # cls chính là Person

    # 3. Static method: hàm tiện ích, không cần self hay cls
    @staticmethod
    def is_valid_year(year: int) -> bool:
        return 1900 <= year <= date.today().year


p1 = Person("An", 2000)
p2 = Person.from_string("Bình-1995")     # Gọi class method qua tên class
print(p2.name, p2.birth_year)
# Output: Bình 1995
print(Person.is_valid_year(1850))
# Output: False
print(p1.age() == date.today().year - 2000)
# Output: True
```

| Loại | Decorator | Tham số đầu | Truy cập được | Dùng khi |
| --- | --- | --- | --- | --- |
| Instance method | (không) | `self` | Object + class | Thao tác với dữ liệu của object (phổ biến nhất) |
| Class method | `@classmethod` | `cls` | Class | **Constructor thay thế** (`from_json`, `from_string`), đếm số object |
| Static method | `@staticmethod` | (không) | Không | Hàm tiện ích liên quan tới class nhưng không cần dữ liệu |

> 💡 **Tại sao class method dùng `cls(...)` thay vì `Person(...)`?** Vì nếu có class con `Student(Person)` gọi `Student.from_string(...)`, `cls` sẽ là `Student` → tạo đúng object `Student`. Viết cứng `Person(...)` thì luôn tạo `Person`.

## 📖 5. Encapsulation và @property

### Quy ước "private" trong Python

Python **không có** `private`/`public` như C#/Java. Thay vào đó dùng **quy ước đặt tên**:

| Cách đặt tên | Ý nghĩa |
| --- | --- |
| `name` | Public - dùng thoải mái |
| `_name` | "Protected" - quy ước: "đây là chi tiết nội bộ, đừng đụng vào từ bên ngoài" |
| `__name` | "Private" - Python đổi tên thành `_ClassName__name` (name mangling) để tránh xung đột khi kế thừa |

```python
class Account:
    def __init__(self):
        self.owner = "An"
        self._balance = 100         # Nội bộ
        self.__pin = "1234"         # Name mangling


acc = Account()
print(acc._balance)                 # Vẫn truy cập được - Python tin tưởng lập trình viên
# Output: 100
try:
    print(acc.__pin)
except AttributeError as error:
    print("AttributeError:", error)
# Output: AttributeError: 'Account' object has no attribute '__pin'
print(acc._Account__pin)            # Tên thật sau khi bị đổi
# Output: 1234
```

> 🧠 Triết lý Python: *"We're all consenting adults here"* - Chúng ta đều là người lớn. Dấu `_` là **lời nhắc lịch sự**, không phải ổ khóa.

### @property - Getter và Setter kiểu Pythonic

Bạn muốn kiểm tra dữ liệu khi gán (ví dụ: nhiệt độ không được dưới độ không tuyệt đối), nhưng vẫn muốn dùng cú pháp đơn giản `obj.temp = 25` thay vì `obj.set_temp(25)`:

```python
class Temperature:
    def __init__(self, celsius: float):
        self.celsius = celsius          # Gọi setter bên dưới → được kiểm tra luôn!

    @property
    def celsius(self) -> float:         # Getter: chạy khi ĐỌC t.celsius
        return self._celsius

    @celsius.setter
    def celsius(self, value: float) -> None:    # Setter: chạy khi GÁN t.celsius = ...
        if value < -273.15:
            raise ValueError("Không thể thấp hơn độ không tuyệt đối!")
        self._celsius = value

    @property
    def fahrenheit(self) -> float:      # Thuộc tính TÍNH TOÁN (computed), chỉ đọc
        return self._celsius * 9 / 5 + 32


t = Temperature(25)
print(t.celsius, t.fahrenheit)          # Dùng như attribute, KHÔNG có ()
# Output: 25 77.0

t.celsius = 100
print(t.fahrenheit)
# Output: 212.0

try:
    t.celsius = -300
except ValueError as error:
    print("Lỗi:", error)
# Output: Lỗi: Không thể thấp hơn độ không tuyệt đối!

try:
    t.fahrenheit = 50                   # Không có setter → chỉ đọc
except AttributeError as error:
    print("Lỗi:", error)
# Output: Lỗi: property 'fahrenheit' of 'Temperature' object has no setter
```

> 🧠 **Ví dụ dễ hiểu**: `@property` giống **quầy lễ tân khách sạn**. Khách (code bên ngoài) tưởng mình đang lấy chìa khóa trực tiếp, nhưng thực ra lễ tân kiểm tra thông tin trước khi đưa. Bạn có thể thêm "lễ tân" vào sau mà **không cần sửa code bên ngoài**.

> 💡 Trong Python, **bắt đầu bằng attribute public đơn giản**. Chỉ chuyển sang `@property` khi thực sự cần kiểm tra hoặc tính toán - code bên ngoài không cần thay đổi gì. Đừng viết `get_x()`/`set_x()` kiểu Java.

## 📖 6. Kế thừa (Inheritance)

### Tại sao cần kế thừa?

Chó, mèo, chim đều có tên, tuổi, đều ăn và ngủ. Thay vì viết lặp lại 3 lần, ta tạo class cha `Animal` chứa phần chung, các class con **kế thừa** và chỉ viết thêm phần riêng.

> 🧠 **Ví dụ dễ hiểu**: Kế thừa giống **di truyền**: con thừa hưởng đặc điểm của bố mẹ (màu mắt, chiều cao), nhưng vẫn có những đặc điểm và tài năng riêng.

```python
class Animal:                               # Class cha (parent / base class)
    def __init__(self, name: str, age: int):
        self.name = name
        self.age = age

    def eat(self):
        print(f"{self.name} đang ăn")

    def speak(self):
        print(f"{self.name} phát ra âm thanh")


class Dog(Animal):                          # Class con (child / subclass) kế thừa Animal
    def fetch(self):                        # Method riêng của Dog
        print(f"{self.name} đi nhặt bóng")


class Cat(Animal):
    pass                                    # Không thêm gì, dùng toàn bộ của Animal


dog = Dog("Lu", 3)
dog.eat()                                   # Kế thừa từ Animal
# Output: Lu đang ăn
dog.fetch()                                 # Method riêng
# Output: Lu đi nhặt bóng

cat = Cat("Mướp", 2)
cat.speak()
# Output: Mướp phát ra âm thanh

print(isinstance(dog, Dog), isinstance(dog, Animal), isinstance(dog, Cat))
# Output: True True False
print(issubclass(Dog, Animal))
# Output: True
```

### Method overriding - Ghi đè method

Class con có thể **định nghĩa lại** method của class cha:

```python
class Animal:
    def __init__(self, name):
        self.name = name

    def speak(self):
        return "..."


class Dog(Animal):
    def speak(self):                # Ghi đè
        return "Gâu gâu!"


class Cat(Animal):
    def speak(self):                # Ghi đè
        return "Meo meo!"


print(Dog("Lu").speak(), Cat("Mướp").speak(), Animal("?").speak())
# Output: Gâu gâu! Meo meo! ...
```

### super() - Gọi method của class cha

Khi class con có `__init__` riêng, cần gọi `super().__init__(...)` để class cha khởi tạo phần của nó:

```python
class Employee:
    def __init__(self, name: str, salary: int):
        self.name = name
        self.salary = salary

    def describe(self) -> str:
        return f"{self.name} - lương {self.salary:,}đ"


class Manager(Employee):
    def __init__(self, name: str, salary: int, team_size: int):
        super().__init__(name, salary)          # ✅ Để Employee thiết lập name, salary
        self.team_size = team_size              # Thêm phần riêng

    def describe(self) -> str:
        base = super().describe()               # Tái sử dụng method của cha
        return f"{base} - quản lý {self.team_size} người"


m = Manager("Hùng", 30_000_000, 8)
print(m.describe())
# Output: Hùng - lương 30,000,000đ - quản lý 8 người
```

> ⚠️ Nếu quên `super().__init__(...)`, object sẽ **không có** `name` và `salary` → `AttributeError` khi dùng.

### Đa kế thừa và MRO (tham khảo)

Python cho phép kế thừa **nhiều class**. Thứ tự tìm method được gọi là **MRO** (Method Resolution Order):

```python
class Flyable:
    def move(self):
        return "bay"


class Swimmable:
    def move(self):
        return "bơi"

    def dive(self):
        return "lặn"


class Duck(Flyable, Swimmable):     # Tìm ở Flyable trước, rồi Swimmable
    pass


d = Duck()
print(d.move(), d.dive())
# Output: bay lặn
print([cls.__name__ for cls in Duck.__mro__])
# Output: ['Duck', 'Flyable', 'Swimmable', 'object']
```

> 💡 Đa kế thừa mạnh nhưng dễ rối. Người mới nên dùng **kế thừa đơn** và **composition** (object chứa object khác) - "has-a" thay vì "is-a".

### Composition - "Có một" thay vì "là một"

```python
class Engine:
    def start(self):
        return "Động cơ khởi động 🔥"


class Car:
    def __init__(self, brand):
        self.brand = brand
        self.engine = Engine()      # Car CÓ MỘT Engine (không phải Car LÀ MỘT Engine)

    def start(self):
        return f"{self.brand}: {self.engine.start()}"


print(Car("VinFast").start())
# Output: VinFast: Động cơ khởi động 🔥
```

## 📖 7. Đa hình (Polymorphism) và Duck Typing

### Đa hình

Cùng một lời gọi method, mỗi object phản hồi theo cách của riêng nó:

```python
class Shape:
    def area(self) -> float:
        raise NotImplementedError


class Rectangle(Shape):
    def __init__(self, w, h):
        self.w, self.h = w, h

    def area(self):
        return self.w * self.h


class Circle(Shape):
    def __init__(self, r):
        self.r = r

    def area(self):
        return 3.14159 * self.r ** 2


shapes = [Rectangle(3, 4), Circle(1), Rectangle(2, 2)]
for shape in shapes:
    # Không cần if/elif kiểm tra loại - mỗi shape tự biết tính diện tích
    print(f"{type(shape).__name__}: {shape.area():.2f}")
# Output:
# Rectangle: 12.00
# Circle: 3.14
# Rectangle: 4.00

print(f"Tổng diện tích: {sum(s.area() for s in shapes):.2f}")
# Output: Tổng diện tích: 19.14
```

> 🧠 **Ví dụ dễ hiểu**: Người chỉ huy dàn nhạc giơ tay ra hiệu "Chơi!". Người đánh trống thì đánh trống, người kéo violin thì kéo violin. Người chỉ huy không cần biết từng nhạc cụ hoạt động thế nào.

### Duck Typing

> *"If it walks like a duck and quacks like a duck, then it must be a duck."*
> Nếu nó đi như vịt và kêu như vịt, thì nó là vịt.

Python **không quan tâm object thuộc class nào**, chỉ quan tâm nó **có method cần thiết hay không**:

```python
class Duck:
    def sound(self):
        return "Quạc quạc"


class Robot:                        # Không kế thừa gì từ Duck
    def sound(self):
        return "Bíp bíp"


def make_sound(thing):              # Chỉ cần thing có method sound()
    print(thing.sound())


make_sound(Duck())
# Output: Quạc quạc
make_sound(Robot())
# Output: Bíp bíp
```

Đây là lý do `len()` dùng được với chuỗi, list, dict, và cả **class của bạn** - miễn là nó có method `__len__`. Xem phần tiếp theo!

## 📖 8. Dunder Methods (Magic Methods)

### Dunder là gì?

**Dunder** = **D**ouble **UNDER**score: các method có dạng `__tên__`. Python **tự động gọi** chúng trong các tình huống đặc biệt:

| Bạn viết | Python gọi |
| --- | --- |
| `obj = MyClass()` | `__init__` |
| `str(obj)`, `print(obj)` | `__str__` |
| `repr(obj)`, hiển thị trong REPL/list | `__repr__` |
| `a == b` | `__eq__` |
| `a < b` | `__lt__` |
| `len(obj)` | `__len__` |
| `a + b` | `__add__` |
| `obj[key]` | `__getitem__` |
| `x in obj` | `__contains__` |
| `for x in obj` | `__iter__` |
| `obj()` | `__call__` |
| `bool(obj)`, `if obj:` | `__bool__` (hoặc `__len__`) |

### `__str__` và `__repr__`

```python
class Book:
    def __init__(self, title, author, price):
        self.title = title
        self.author = author
        self.price = price


b = Book("Dế Mèn phiêu lưu ký", "Tô Hoài", 50000)
print(b)                    # Mặc định: không hữu ích
# Output (ví dụ): <__main__.Book object at 0x7f8b2c3d4e50>
```

```python
class Book:
    def __init__(self, title, author, price):
        self.title = title
        self.author = author
        self.price = price

    def __str__(self):
        """Dành cho NGƯỜI DÙNG: dễ đọc, thân thiện."""
        return f"📖 {self.title} - {self.author}"

    def __repr__(self):
        """Dành cho LẬP TRÌNH VIÊN: rõ ràng, lý tưởng là tạo lại được object."""
        return f"Book({self.title!r}, {self.author!r}, {self.price})"


b = Book("Dế Mèn phiêu lưu ký", "Tô Hoài", 50000)
print(b)                        # Dùng __str__
# Output: 📖 Dế Mèn phiêu lưu ký - Tô Hoài
print(repr(b))                  # Dùng __repr__
# Output: Book('Dế Mèn phiêu lưu ký', 'Tô Hoài', 50000)
print([b])                      # List hiển thị phần tử bằng __repr__
# Output: [Book('Dế Mèn phiêu lưu ký', 'Tô Hoài', 50000)]
print(f"{b}")                   # f-string dùng __str__
# Output: 📖 Dế Mèn phiêu lưu ký - Tô Hoài
```

> 💡 Nếu chỉ viết **một** trong hai, hãy viết `__repr__` - vì khi không có `__str__`, Python dùng `__repr__` thay thế.

### `__eq__` và so sánh

```python
from functools import total_ordering


@total_ordering                 # Tự sinh <=, >, >= từ __eq__ và __lt__
class Money:
    def __init__(self, amount: int, currency: str = "VND"):
        self.amount = amount
        self.currency = currency

    def __eq__(self, other):
        if not isinstance(other, Money):
            return NotImplemented       # Để Python thử cách khác / trả về False
        return self.amount == other.amount and self.currency == other.currency

    def __lt__(self, other):
        return self.amount < other.amount

    def __add__(self, other):
        return Money(self.amount + other.amount, self.currency)

    def __repr__(self):
        return f"Money({self.amount:,} {self.currency})"


a = Money(50_000)
b = Money(50_000)
c = Money(20_000)

print(a == b)           # Không có __eq__ thì sẽ là False (so sánh identity)
# Output: True
print(a is b)
# Output: False
print(c < a, a >= c)
# Output: True True
print(a + c)
# Output: Money(70,000 VND)
print(sorted([a, c, Money(100)]))
# Output: [Money(100 VND), Money(20,000 VND), Money(50,000 VND)]
```

> ⚠️ Khi định nghĩa `__eq__`, Python tự đặt `__hash__ = None` → object **không dùng được làm key dict / phần tử set** nữa, trừ khi bạn định nghĩa thêm `__hash__`.

### Container: `__len__`, `__getitem__`, `__contains__`, `__iter__`

```python
class Playlist:
    def __init__(self, name):
        self.name = name
        self._songs = []

    def add(self, song):
        self._songs.append(song)
        return self                     # Trả về self để "nối chuỗi" method

    def __len__(self):
        return len(self._songs)

    def __getitem__(self, index):
        return self._songs[index]       # Hỗ trợ cả index lẫn slicing!

    def __contains__(self, song):
        return song in self._songs

    def __iter__(self):
        return iter(self._songs)

    def __bool__(self):
        return len(self._songs) > 0


p = Playlist("Chill")
p.add("Nơi này có anh").add("Lạc trôi").add("Hãy trao cho anh")

print(len(p))
# Output: 3
print(p[0])
# Output: Nơi này có anh
print(p[-2:])
# Output: ['Lạc trôi', 'Hãy trao cho anh']
print("Lạc trôi" in p)
# Output: True
for i, song in enumerate(p, 1):
    print(i, song)
# Output:
# 1 Nơi này có anh
# 2 Lạc trôi
# 3 Hãy trao cho anh
print(bool(Playlist("Trống")))
# Output: False
```

### `__call__` - Object gọi được như hàm

```python
class Multiplier:
    def __init__(self, factor):
        self.factor = factor

    def __call__(self, x):
        return x * self.factor


double = Multiplier(2)
print(double(21))           # Gọi object như hàm
# Output: 42
```

## 📖 9. Dataclasses - Class gọn gàng

### Vấn đề: Code "boilerplate"

Với class chủ yếu chứa dữ liệu, bạn phải viết đi viết lại `__init__`, `__repr__`, `__eq__`... rất nhàm chán.

### @dataclass tự động sinh code cho bạn

```python
from dataclasses import dataclass, field


@dataclass
class Product:
    name: str                   # Khai báo field bằng type hint
    price: int
    quantity: int = 0           # Có giá trị mặc định
    tags: list[str] = field(default_factory=list)   # ✅ Mutable default đúng cách

    def total_value(self) -> int:
        return self.price * self.quantity


p1 = Product("Bàn phím", 500_000, 10)
p2 = Product("Bàn phím", 500_000, 10)
p3 = Product("Chuột", 200_000, tags=["gaming"])

print(p1)                       # __repr__ tự động
# Output: Product(name='Bàn phím', price=500000, quantity=10, tags=[])
print(p1 == p2)                 # __eq__ tự động so sánh từng field
# Output: True
print(p3.total_value())
# Output: 0
print(p1.total_value())
# Output: 5000000
```

Chỉ với vài dòng, `@dataclass` đã sinh ra `__init__`, `__repr__`, `__eq__` cho bạn!

### Các tùy chọn hữu ích

```python
from dataclasses import dataclass, field, asdict


@dataclass(frozen=True)         # Bất biến - không sửa được sau khi tạo (và hashable)
class Point:
    x: float
    y: float


p = Point(1, 2)
try:
    p.x = 10
except Exception as error:
    print(type(error).__name__)
# Output: FrozenInstanceError
print({p: "gốc"})               # frozen → dùng làm key dict được
# Output: {Point(x=1, y=2): 'gốc'}


@dataclass(order=True)          # Sinh <, <=, >, >= (so sánh theo thứ tự field)
class Version:
    major: int
    minor: int
    patch: int = 0


print(sorted([Version(1, 10), Version(1, 2), Version(0, 9, 5)]))
# Output: [Version(major=0, minor=9, patch=5), Version(major=1, minor=2, patch=0), Version(major=1, minor=10, patch=0)]


@dataclass
class User:
    username: str
    email: str
    password: str = field(repr=False)           # Ẩn khỏi repr (bảo mật)
    is_admin: bool = False

    def __post_init__(self):                    # Chạy SAU __init__ tự sinh - để kiểm tra dữ liệu
        if "@" not in self.email:
            raise ValueError(f"Email không hợp lệ: {self.email}")
        self.username = self.username.lower()


u = User("AnNguyen", "an@mail.com", "secret123")
print(u)
# Output: User(username='annguyen', email='an@mail.com', is_admin=False)
print(asdict(u))                # Chuyển sang dict - tiện để lưu JSON
# Output: {'username': 'annguyen', 'email': 'an@mail.com', 'password': 'secret123', 'is_admin': False}
```

> ✅ **Khi nào dùng dataclass?** Khi class **chủ yếu chứa dữ liệu** (model, config, DTO). Bạn sẽ dùng dataclass trong [dự án cuối khóa](./10-final-project.md).

## 📖 10. Abstract Class (abc)

### Vấn đề

Ở ví dụ `Shape` phía trên, nếu ai đó tạo class con mà **quên viết `area()`**, lỗi chỉ xuất hiện khi gọi `area()` - có thể là rất lâu sau đó.

### Giải pháp: Abstract Base Class

**Abstract class** là class **không thể tạo object trực tiếp**, dùng làm "hợp đồng" bắt buộc class con phải implement các method nhất định.

> 🧠 **Ví dụ dễ hiểu**: Abstract class giống **bản mô tả công việc**: "Mọi nhân viên giao hàng PHẢI biết `giao_hàng()`". Bạn không thể thuê "một nhân viên giao hàng chung chung" - phải thuê người giao bằng xe máy, ô tô hay drone cụ thể, và mỗi người phải tự biết cách giao.

```python
from abc import ABC, abstractmethod


class PaymentMethod(ABC):                   # Kế thừa ABC
    @abstractmethod
    def pay(self, amount: int) -> str:
        """Class con BẮT BUỘC phải implement."""

    def receipt(self, amount: int) -> str:  # Method thường - class con được dùng chung
        return f"🧾 Hóa đơn: {self.pay(amount)}"


class CreditCard(PaymentMethod):
    def __init__(self, number: str):
        self.number = number

    def pay(self, amount: int) -> str:
        return f"Thanh toán {amount:,}đ bằng thẻ ****{self.number[-4:]}"


class MoMo(PaymentMethod):
    def __init__(self, phone: str):
        self.phone = phone

    def pay(self, amount: int) -> str:
        return f"Thanh toán {amount:,}đ qua ví {self.phone}"


class BrokenPayment(PaymentMethod):         # Quên implement pay()
    pass


# ❌ Không tạo được object từ abstract class
try:
    PaymentMethod()
except TypeError as error:
    print("Lỗi:", error)
# Output: Lỗi: Can't instantiate abstract class PaymentMethod with abstract method pay

# ❌ Class con thiếu method → báo lỗi NGAY khi tạo object
try:
    BrokenPayment()
except TypeError as error:
    print("Lỗi:", error)
# Output: Lỗi: Can't instantiate abstract class BrokenPayment with abstract method pay

# ✅ Đa hình với abstract class
for method in [CreditCard("4111222233334444"), MoMo("0901234567")]:
    print(method.receipt(150_000))
# Output:
# 🧾 Hóa đơn: Thanh toán 150,000đ bằng thẻ ****4444
# 🧾 Hóa đơn: Thanh toán 150,000đ qua ví 0901234567
```

## ⚠️ Lỗi thường gặp

### 1. Quên `self` trong định nghĩa method

```python
class Greeter:
    def hello():                        # ❌ Thiếu self
        print("Hello")


try:
    Greeter().hello()
except TypeError as error:
    print(error)
# Output: Greeter.hello() takes 0 positional arguments but 1 was given
```

**Giải thích**: `Greeter().hello()` thực chất là `Greeter.hello(obj)` → truyền 1 đối số, nhưng hàm không nhận tham số nào.

### 2. Quên `self.` khi truy cập attribute

```python
class Counter:
    def __init__(self):
        self.count = 0

    def increment(self):
        try:
            count += 1                  # ❌ Biến local, không phải attribute
        except UnboundLocalError:
            print("Lỗi: phải viết self.count")
        self.count += 1                 # ✅


Counter().increment()
# Output: Lỗi: phải viết self.count
```

### 3. Quên gọi `super().__init__()`

```python
class Animal:
    def __init__(self, name):
        self.name = name


class Dog(Animal):
    def __init__(self, name, breed):
        # ❌ Quên super().__init__(name)
        self.breed = breed


try:
    print(Dog("Lu", "Corgi").name)
except AttributeError as error:
    print(error)
# Output: 'Dog' object has no attribute 'name'
```

### 4. Viết sai tên `__init__`

```text
class User:
    def __int__(self, name):        # ❌ __int__ (thiếu chữ i) hoặc _init_ (1 dấu gạch)
        self.name = name

User("An")   # TypeError: User() takes no arguments
```

### 5. Mutable class attribute dùng chung

Xem lại phần 3: `members = []` ở cấp class → mọi object dùng chung. Luôn khởi tạo list/dict trong `__init__` hoặc dùng `field(default_factory=list)` với dataclass.

### 6. Gọi property như method

```python
class Circle:
    def __init__(self, r):
        self.r = r

    @property
    def area(self):
        return 3.14 * self.r ** 2


c = Circle(2)
print(c.area)               # ✅ Không có ()
# Output: 12.56
try:
    c.area()                # ❌ c.area là float, không gọi được
except TypeError as error:
    print(error)
# Output: 'float' object is not callable
```

### 7. Lạm dụng kế thừa

```text
# ❌ Stack KHÔNG PHẢI là một list (nó không nên có insert, sort...)
class Stack(list):
    pass

# ✅ Stack CÓ MỘT list bên trong (composition)
class Stack:
    def __init__(self):
        self._items = []
```

## 🏋️ Bài tập

### Bài tập 1: Class Rectangle

Tạo class `Rectangle` với `width`, `height` (dùng `@property` kiểm tra > 0), method `area()`, `perimeter()`, `is_square()`, `__str__`, `__eq__` (hai hình bằng nhau nếu cùng kích thước).

### Bài tập 2: Hệ thống nhân viên

- Class cha `Employee(name, base_salary)` với method `calculate_salary()`
- `FullTime`: lương = base_salary
- `PartTime(hours, rate)`: lương = hours × rate
- `Intern`: lương = base_salary × 0.5
- In bảng lương cho danh sách nhân viên hỗn hợp (đa hình)

### Bài tập 3: Abstract class Notifier

Tạo abstract class `Notifier` với abstract method `send(message)`. Implement `EmailNotifier`, `SMSNotifier`, `SlackNotifier`. Viết hàm `broadcast(notifiers, message)` gửi qua tất cả kênh.

### Bài tập 4: Vector 2D

Tạo class `Vector` hỗ trợ: `v1 + v2`, `v1 - v2`, `v * 3`, `abs(v)` (độ dài, dùng `__abs__`), `v1 == v2`, `repr(v)` → `Vector(3, 4)`.

### Bài tập 5: Giỏ hàng với dunder methods

Tạo `CartItem` (dataclass) và `ShoppingCart` hỗ trợ: `len(cart)`, `cart[0]`, `"Táo" in cart`, `for item in cart`, `cart + other_cart`, `print(cart)` in hóa đơn đẹp.

<details>
<summary>💡 Xem đáp án Bài tập 4</summary>

```python
import math


class Vector:
    def __init__(self, x: float, y: float):
        self.x = x
        self.y = y

    def __add__(self, other):
        return Vector(self.x + other.x, self.y + other.y)

    def __sub__(self, other):
        return Vector(self.x - other.x, self.y - other.y)

    def __mul__(self, scalar):
        return Vector(self.x * scalar, self.y * scalar)

    def __abs__(self):
        return math.hypot(self.x, self.y)

    def __eq__(self, other):
        return isinstance(other, Vector) and (self.x, self.y) == (other.x, other.y)

    def __repr__(self):
        return f"Vector({self.x}, {self.y})"


v1 = Vector(3, 4)
v2 = Vector(1, 1)
print(v1 + v2, v1 - v2, v1 * 3)
# Output: Vector(4, 5) Vector(2, 3) Vector(9, 12)
print(abs(v1))
# Output: 5.0
print(v1 == Vector(3, 4))
# Output: True
```

</details>

## ✅ Checklist hoàn thành

- [ ] Giải thích được class, object, attribute, method bằng ví dụ đời thường
- [ ] Viết `__init__` và hiểu `self`
- [ ] Phân biệt instance attribute và class attribute
- [ ] Biết khi nào dùng `@classmethod`, `@staticmethod`
- [ ] Dùng `@property` với getter/setter có kiểm tra dữ liệu
- [ ] Kế thừa class, ghi đè method, gọi `super()`
- [ ] Hiểu đa hình và duck typing
- [ ] Viết `__str__`, `__repr__`, `__eq__`, `__len__`, `__add__`...
- [ ] Dùng `@dataclass` với `field(default_factory=...)`, `frozen`, `order`
- [ ] Tạo abstract class với `ABC` và `@abstractmethod`
- [ ] Hoàn thành ít nhất 3 bài tập

## 🚀 Tiếp theo

Bạn đã biết cách tự thiết kế kiểu dữ liệu với class. Nhưng chương trình thực tế luôn gặp sự cố: file không tồn tại, người dùng nhập sai, mạng mất kết nối... Bài tiếp theo sẽ dạy bạn cách **xử lý lỗi** một cách chuyên nghiệp và **làm việc với file**.

**Bài tiếp theo**: [Exceptions & Làm việc với File](./07-exceptions-files.md)

---

💡 **Tips nhớ lâu**:

- **Class = bản thiết kế, Object = sản phẩm thật**
- **`self` = "chính object này"**
- **Mutable data → khởi tạo trong `__init__`**, không đặt ở cấp class
- **Luôn viết `__repr__`** - debug dễ hơn gấp bội
- **Class chứa dữ liệu → `@dataclass`**
- **Ưu tiên composition ("có một") hơn inheritance ("là một")** khi phân vân
