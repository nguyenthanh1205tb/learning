# 📚 Bài 6: Struct, Method và Interface

## 🎯 Mục tiêu bài học

- Định nghĩa và sử dụng **struct** để gom dữ liệu liên quan
- Hiểu **con trỏ** (`&` và `*`) - không đáng sợ như bạn nghĩ!
- Gắn **method** vào kiểu dữ liệu
- Phân biệt **value receiver** và **pointer receiver**, biết khi nào dùng loại nào
- Viết **constructor** theo quy ước `NewX`
- Dùng **embedding** (nhúng) thay cho kế thừa
- Hiểu **interface** và cơ chế **implement ngầm định** (implicit) của Go
- Sử dụng **empty interface** (`any`), **type assertion** và **type switch**
- Implement interface **`fmt.Stringer`** để tùy biến cách in
- Viết code tổng quát với **generics** (type parameters, constraints)

## 📖 1. Struct - Gom dữ liệu lại với nhau

### Struct là gì?

Giả sử bạn quản lý thông tin sinh viên. Nếu dùng biến riêng lẻ:

```go
name1, age1, gpa1 := "An", 20, 3.5
name2, age2, gpa2 := "Bình", 21, 3.2
// ... 100 sinh viên thì sao? 😵
```

**Struct** cho phép bạn tạo **kiểu dữ liệu mới** gom nhiều trường (field) liên quan lại:

> 💡 **Ví von**: Struct giống như **mẫu hồ sơ** (form) có các ô trống: Họ tên, Tuổi, GPA. Mỗi sinh viên là một **tờ hồ sơ** được điền theo mẫu đó.

> 💡 **So sánh**: Struct của Go giống `struct`/`class` chỉ có field trong C#, `class` chỉ có thuộc tính trong Java, `dataclass` trong Python.

### Định nghĩa và khởi tạo struct

```go
package main

import "fmt"

// Định nghĩa kiểu Student
type Student struct {
	Name  string
	Age   int
	GPA   float64
	Email string
}

func main() {
	// Cách 1: Khởi tạo với tên field (KHUYÊN DÙNG)
	s1 := Student{
		Name: "Nguyễn Văn An",
		Age:  20,
		GPA:  3.5,
	} // Email không gán → zero value ""

	// Cách 2: Theo thứ tự field (không khuyến khích - dễ sai khi thêm field)
	s2 := Student{"Trần Thị Bình", 21, 3.8, "binh@mail.com"}

	// Cách 3: Zero value - mọi field đều là zero value
	var s3 Student

	// Truy cập và thay đổi field bằng dấu chấm
	s3.Name = "Lê Chi"
	s3.Age = 19

	fmt.Println(s1)
	fmt.Printf("%+v\n", s2) // %+v in kèm tên field
	fmt.Printf("%#v\n", s3) // %#v in cú pháp Go
	fmt.Println(s1.Name, "có GPA", s1.GPA)
}

// Output:
// {Nguyễn Văn An 20 3.5 }
// {Name:Trần Thị Bình Age:21 GPA:3.8 Email:binh@mail.com}
// main.Student{Name:"Lê Chi", Age:19, GPA:0, Email:""}
// Nguyễn Văn An có GPA 3.5
```

### Struct là value type - gán là sao chép

```go
package main

import "fmt"

type Point struct {
	X, Y int // Các field cùng kiểu viết gọn trên một dòng
}

func main() {
	p1 := Point{X: 1, Y: 2}
	p2 := p1 // Sao chép toàn bộ struct
	p2.X = 100

	fmt.Println(p1, p2)
	fmt.Println(p1 == Point{1, 2}) // Struct so sánh được bằng == nếu mọi field so sánh được
}

// Output:
// {1 2} {100 2}
// true
```

### Struct ẩn danh và struct lồng nhau

```go
package main

import "fmt"

type Address struct {
	Street string
	City   string
}

type Employee struct {
	Name    string
	Salary  int
	Address Address  // Struct lồng struct
	Skills  []string // Field có thể là slice, map...
}

func main() {
	e := Employee{
		Name:   "Minh",
		Salary: 20_000_000,
		Address: Address{
			Street: "123 Lê Lợi",
			City:   "TP.HCM",
		},
		Skills: []string{"Go", "SQL"},
	}
	fmt.Println(e.Name, "sống ở", e.Address.City)

	// Struct ẩn danh - dùng một lần, không cần đặt tên kiểu
	config := struct {
		Host string
		Port int
	}{
		Host: "localhost",
		Port: 8080,
	}
	fmt.Printf("%s:%d\n", config.Host, config.Port)
}

// Output:
// Minh sống ở TP.HCM
// localhost:8080
```

> 💡 Struct ẩn danh rất hay dùng trong **test** (table-driven tests - [Bài 9](./09-packages-modules-testing.md)) và khi đọc/ghi JSON tạm thời.

### Struct tags (xem trước)

Field có thể gắn "nhãn" (tag) để thư viện khác đọc, ví dụ `encoding/json`:

```go
type User struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	Password string `json:"-"`              // Không xuất ra JSON
	Email    string `json:"email,omitempty"` // Bỏ qua nếu rỗng
}
```

Bạn sẽ dùng tag thực tế ở [Bài 10](./10-final-project.md).

## 📖 2. Con trỏ (Pointers) - `&` và `*`

### Con trỏ là gì?

Mọi biến đều nằm ở một **địa chỉ** trong bộ nhớ. **Con trỏ** là biến **lưu địa chỉ** của biến khác.

> 💡 **Ví von**: Biến là **ngôi nhà**, giá trị là **đồ đạc trong nhà**. Con trỏ là **tờ giấy ghi địa chỉ nhà**. Đưa ai đó tờ giấy địa chỉ, họ có thể đến và **sắp xếp lại đồ đạc** trong nhà bạn. Còn nếu bạn đưa họ **bản sao đồ đạc** (pass by value), họ làm gì cũng không ảnh hưởng nhà bạn.

- **`&x`**: lấy **địa chỉ** của `x` ("address of")
- **`*T`**: kiểu "con trỏ tới T"
- **`*p`**: lấy/sửa **giá trị** tại địa chỉ mà `p` trỏ tới ("dereference")

```go
package main

import "fmt"

func main() {
	x := 42
	p := &x // p là con trỏ, lưu địa chỉ của x. Kiểu của p là *int

	fmt.Printf("x = %d, kiểu của p: %T\n", x, p)
	fmt.Println("Giá trị tại p:", *p)

	*p = 100 // Sửa giá trị tại địa chỉ p trỏ tới → sửa x
	fmt.Println("x sau khi sửa qua p:", x)

	// Zero value của con trỏ là nil
	var q *int
	fmt.Println(q == nil)
	// fmt.Println(*q) // 💥 panic: runtime error: invalid memory address or nil pointer dereference
}

// Output:
// x = 42, kiểu của p: *int
// Giá trị tại p: 42
// x sau khi sửa qua p: 100
// true
```

```text
    x (ở địa chỉ 0xc000012080)        p (ở địa chỉ 0xc000014028)
   ┌──────────┐                       ┌──────────────┐
   │   100    │ ◄──────────────────── │ 0xc000012080 │
   └──────────┘                       └──────────────┘
```

### Con trỏ tới struct

```go
package main

import "fmt"

type Account struct {
	Owner   string
	Balance int
}

// Nhận bản sao → không thay đổi được bản gốc
func depositWrong(a Account, amount int) {
	a.Balance += amount
}

// Nhận con trỏ → thay đổi được bản gốc
func deposit(a *Account, amount int) {
	a.Balance += amount // Go tự hiểu a.Balance là (*a).Balance
}

func main() {
	acc := Account{Owner: "Lan", Balance: 100}

	depositWrong(acc, 50)
	fmt.Println("Sau depositWrong:", acc.Balance)

	deposit(&acc, 50)
	fmt.Println("Sau deposit:", acc.Balance)

	// Tạo con trỏ tới struct trực tiếp
	p := &Account{Owner: "Hùng", Balance: 500}
	p.Balance -= 200 // Không cần viết (*p).Balance
	fmt.Println(p.Owner, p.Balance)

	// new(T) cấp phát T với zero value, trả về *T
	q := new(Account)
	fmt.Printf("%+v\n", *q)
}

// Output:
// Sau depositWrong: 100
// Sau deposit: 150
// Hùng 300
// {Owner: Balance:0}
```

### Khi nào dùng con trỏ?

| Dùng con trỏ khi | Ví dụ |
|------------------|-------|
| Hàm cần **thay đổi** dữ liệu gốc | `deposit(&acc, 50)` |
| Struct **lớn**, muốn tránh sao chép tốn kém | Struct có hàng chục field |
| Cần biểu diễn "**không có giá trị**" (`nil`) | `func findUser(id int) *User` trả về `nil` nếu không thấy |

> 💡 **Yên tâm**: Go **không có phép toán con trỏ** (pointer arithmetic) như C (`p++` ❌), và có **garbage collector**. Trả về con trỏ tới biến cục bộ là hoàn toàn an toàn trong Go (khác với C!).

## 📖 3. Method - Hàm gắn với kiểu dữ liệu

**Method** là hàm có thêm một tham số đặc biệt gọi là **receiver**, đặt giữa `func` và tên hàm:

```go
func (r Rectangle) Area() float64 {
//   └─ receiver ─┘
	return r.Width * r.Height
}
```

```go
package main

import (
	"fmt"
	"math"
)

type Rectangle struct {
	Width, Height float64
}

type Circle struct {
	Radius float64
}

// Method của Rectangle
func (r Rectangle) Area() float64 {
	return r.Width * r.Height
}

func (r Rectangle) Perimeter() float64 {
	return 2 * (r.Width + r.Height)
}

// Method cùng tên Area nhưng của Circle - hoàn toàn OK
func (c Circle) Area() float64 {
	return math.Pi * c.Radius * c.Radius
}

func main() {
	rect := Rectangle{Width: 4, Height: 3}
	circle := Circle{Radius: 2}

	fmt.Println("Diện tích HCN:", rect.Area())
	fmt.Println("Chu vi HCN:", rect.Perimeter())
	fmt.Printf("Diện tích hình tròn: %.2f\n", circle.Area())
}

// Output:
// Diện tích HCN: 12
// Chu vi HCN: 14
// Diện tích hình tròn: 12.57
```

> 💡 **So sánh**: Trong Java/C#, method viết **bên trong** class. Trong Go, method viết **bên ngoài** struct, liên kết qua receiver. Dữ liệu (struct) và hành vi (method) tách bạch nhưng vẫn gắn kết.

### Method cho kiểu bất kỳ (không chỉ struct)

Bạn có thể gắn method cho **mọi kiểu do bạn định nghĩa** trong cùng package:

```go
package main

import "fmt"

type Celsius float64
type Weekday int

func (c Celsius) ToFahrenheit() float64 {
	return float64(c)*9/5 + 32
}

func (d Weekday) IsWeekend() bool {
	return d == 0 || d == 6
}

func main() {
	temp := Celsius(37)
	fmt.Println(temp.ToFahrenheit())

	fmt.Println(Weekday(6).IsWeekend(), Weekday(2).IsWeekend())
}

// Output:
// 98.6
// true false
```

## 📖 4. Value Receiver vs Pointer Receiver ⭐

Đây là một trong những điểm **quan trọng nhất** của bài.

```go
package main

import "fmt"

type Counter struct {
	Count int
}

// Value receiver: c là BẢN SAO
func (c Counter) IncrementValue() {
	c.Count++ // Chỉ tăng bản sao!
}

// Pointer receiver: c trỏ tới BẢN GỐC
func (c *Counter) Increment() {
	c.Count++ // Tăng bản gốc ✅
}

// Value receiver phù hợp cho method CHỈ ĐỌC
func (c Counter) Get() int {
	return c.Count
}

func main() {
	c := Counter{}

	c.IncrementValue()
	fmt.Println("Sau IncrementValue:", c.Get())

	c.Increment() // Go tự động chuyển thành (&c).Increment()
	c.Increment()
	fmt.Println("Sau 2 lần Increment:", c.Get())
}

// Output:
// Sau IncrementValue: 0
// Sau 2 lần Increment: 2
```

### Quy tắc chọn receiver

✅ **Dùng pointer receiver `(t *T)`** khi:
- Method cần **thay đổi** dữ liệu của receiver
- Struct **lớn** (tránh sao chép)
- Struct chứa field không được sao chép như `sync.Mutex` ([Bài 8](./08-concurrency.md))

✅ **Dùng value receiver `(t T)`** khi:
- Struct **nhỏ** và **bất biến** (như `Point`, `Money`, `time.Time`)
- Kiểu là map, func, chan (bản thân đã là tham chiếu)

⚠️ **Quy tắc nhất quán**: Nếu **một** method của kiểu dùng pointer receiver, thì **tất cả** method của kiểu đó nên dùng pointer receiver. Đừng trộn lẫn.

> 💡 **Nếu phân vân → dùng pointer receiver.** Đây là lựa chọn an toàn trong phần lớn trường hợp.

### Go tự động lấy địa chỉ / giải tham chiếu

```go
c := Counter{}
c.Increment()   // Go tự viết lại thành (&c).Increment()

p := &Counter{}
p.Get()         // Go tự viết lại thành (*p).Get()
```

Nhưng việc "tự động" này **không áp dụng khi implement interface** - xem mục 7.

## 📖 5. Constructor - Hàm `NewX`

Go **không có constructor** như Java/C#. Quy ước là viết hàm tên **`NewTênKiểu`** trả về giá trị đã khởi tạo:

```go
package main

import (
	"errors"
	"fmt"
)

type BankAccount struct {
	owner   string // chữ thường → unexported: bên ngoài package không truy cập trực tiếp được
	balance int
}

// Constructor: kiểm tra dữ liệu đầu vào, đặt giá trị mặc định
func NewBankAccount(owner string, initial int) (*BankAccount, error) {
	if owner == "" {
		return nil, errors.New("tên chủ tài khoản không được rỗng")
	}
	if initial < 0 {
		return nil, errors.New("số dư ban đầu không được âm")
	}
	return &BankAccount{owner: owner, balance: initial}, nil
}

// Getter - Go KHÔNG dùng tiền tố "Get": Balance() chứ không phải GetBalance()
func (a *BankAccount) Balance() int {
	return a.balance
}

func (a *BankAccount) Withdraw(amount int) error {
	if amount <= 0 {
		return errors.New("số tiền rút phải lớn hơn 0")
	}
	if amount > a.balance {
		return fmt.Errorf("không đủ số dư: cần %d, còn %d", amount, a.balance)
	}
	a.balance -= amount
	return nil
}

func main() {
	acc, err := NewBankAccount("Lan", 1000)
	if err != nil {
		fmt.Println("Lỗi:", err)
		return
	}

	if err := acc.Withdraw(300); err != nil {
		fmt.Println("Lỗi:", err)
	}
	if err := acc.Withdraw(5000); err != nil {
		fmt.Println("Lỗi:", err)
	}
	fmt.Println("Số dư:", acc.Balance())

	_, err = NewBankAccount("", 100)
	fmt.Println("Lỗi:", err)
}

// Output:
// Lỗi: không đủ số dư: cần 5000, còn 700
// Số dư: 700
// Lỗi: tên chủ tài khoản không được rỗng
```

**Tại sao cần constructor?**
- 🔒 **Encapsulation**: Field chữ thường không thể bị sửa tùy tiện từ package khác
- ✅ **Validation**: Đảm bảo object luôn ở trạng thái hợp lệ
- ⚙️ **Giá trị mặc định**: Khởi tạo map, slice, giá trị cấu hình mặc định

> 💡 **Tip thiết kế**: Nếu zero value của struct đã dùng được ngay (như `sync.Mutex`, `bytes.Buffer`, `strings.Builder`), thì không cần constructor. Go gọi đây là **"make the zero value useful"**.

## 📖 6. Embedding - "Kế thừa" kiểu Go

Go **không có kế thừa** (inheritance). Thay vào đó, Go dùng **composition** (kết hợp) thông qua **embedding** (nhúng).

> 💡 **Ví von**: Kế thừa là "**Chó LÀ MỘT động vật**" (is-a). Embedding là "**Xe hơi CÓ MỘT động cơ**" (has-a) - nhưng Go cho phép bạn gọi thẳng `car.Start()` thay vì `car.Engine.Start()`.

```go
package main

import "fmt"

type Engine struct {
	Horsepower int
}

func (e *Engine) Start() {
	fmt.Printf("Động cơ %d mã lực khởi động: Brừm brừm!\n", e.Horsepower)
}

type Wheels struct {
	Count int
}

type Car struct {
	Engine // Nhúng Engine: không có tên field, chỉ có kiểu
	Wheels // Nhúng Wheels
	Brand  string
}

func main() {
	car := Car{
		Engine: Engine{Horsepower: 150},
		Wheels: Wheels{Count: 4},
		Brand:  "VinFast",
	}

	// Field và method của Engine được "thăng cấp" (promoted) lên Car
	car.Start()                 // Thay vì car.Engine.Start()
	fmt.Println(car.Horsepower) // Thay vì car.Engine.Horsepower
	fmt.Println(car.Count, "bánh")

	// Vẫn truy cập đầy đủ được
	fmt.Println(car.Engine.Horsepower)
}

// Output:
// Động cơ 150 mã lực khởi động: Brừm brừm!
// 150
// 4 bánh
// 150
```

### "Ghi đè" method (shadowing)

```go
package main

import "fmt"

type Animal struct {
	Name string
}

func (a Animal) Speak() string { return a.Name + " phát ra âm thanh" }
func (a Animal) Eat() string   { return a.Name + " đang ăn" }

type Dog struct {
	Animal
	Breed string
}

// Dog định nghĩa Speak riêng → "che" Speak của Animal
func (d Dog) Speak() string { return d.Name + " sủa: Gâu gâu!" }

func main() {
	d := Dog{Animal: Animal{Name: "Milu"}, Breed: "Corgi"}
	fmt.Println(d.Speak())        // Dùng Speak của Dog
	fmt.Println(d.Animal.Speak()) // Vẫn gọi được Speak của Animal
	fmt.Println(d.Eat())          // Eat được thăng cấp từ Animal
}

// Output:
// Milu sủa: Gâu gâu!
// Milu phát ra âm thanh
// Milu đang ăn
```

⚠️ **Embedding KHÔNG phải kế thừa**: `Dog` **không phải** là `Animal`. Bạn **không thể** truyền `Dog` vào hàm nhận `Animal`:

```go
func describe(a Animal) {}
// describe(d)         // ❌ cannot use d (variable of struct type Dog) as Animal value
describe(d.Animal)     // ✅
```

Để có tính **đa hình** (polymorphism), Go dùng **interface**.

## 📖 7. Interface - Hợp đồng hành vi ⭐⭐

### Interface là gì?

**Interface** định nghĩa một **tập các method** (hành vi). Bất kỳ kiểu nào **có đủ các method đó** đều **tự động** thỏa mãn interface.

> 💡 **Ví von**: Interface giống như **tin tuyển dụng**: "Cần người **biết lái xe** và **biết nói tiếng Anh**". Không cần biết bạn là ai, học trường nào - miễn bạn **làm được** hai việc đó là đủ điều kiện. Không cần "nộp đơn" (khai báo `implements`).

```go
package main

import (
	"fmt"
	"math"
)

// Interface Shape: "bất cứ thứ gì có Area() và Perimeter()"
type Shape interface {
	Area() float64
	Perimeter() float64
}

type Rectangle struct{ W, H float64 }
type Circle struct{ R float64 }
type Triangle struct{ A, B, C float64 }

func (r Rectangle) Area() float64      { return r.W * r.H }
func (r Rectangle) Perimeter() float64 { return 2 * (r.W + r.H) }

func (c Circle) Area() float64      { return math.Pi * c.R * c.R }
func (c Circle) Perimeter() float64 { return 2 * math.Pi * c.R }

func (t Triangle) Perimeter() float64 { return t.A + t.B + t.C }
func (t Triangle) Area() float64 {
	s := t.Perimeter() / 2 // Công thức Heron
	return math.Sqrt(s * (s - t.A) * (s - t.B) * (s - t.C))
}

// Hàm nhận BẤT KỲ Shape nào - đây là đa hình (polymorphism)
func printInfo(s Shape) {
	fmt.Printf("%-24T diện tích=%6.2f chu vi=%6.2f\n", s, s.Area(), s.Perimeter())
}

func totalArea(shapes []Shape) float64 {
	total := 0.0
	for _, s := range shapes {
		total += s.Area()
	}
	return total
}

func main() {
	shapes := []Shape{
		Rectangle{W: 4, H: 3},
		Circle{R: 1},
		Triangle{A: 3, B: 4, C: 5},
	}
	for _, s := range shapes {
		printInfo(s)
	}
	fmt.Printf("Tổng diện tích: %.2f\n", totalArea(shapes))
}

// Output:
// main.Rectangle           diện tích= 12.00 chu vi= 14.00
// main.Circle              diện tích=  3.14 chu vi=  6.28
// main.Triangle            diện tích=  6.00 chu vi= 12.00
// Tổng diện tích: 21.14
```

### Implement ngầm định (implicit) - Tại sao hay?

So sánh với Java/C#:

```java
// Java: PHẢI khai báo rõ "implements"
class Rectangle implements Shape { ... }
```

```go
// Go: KHÔNG cần khai báo gì. Có đủ method là xong!
type Rectangle struct{ W, H float64 }
func (r Rectangle) Area() float64      { ... }
func (r Rectangle) Perimeter() float64 { ... }
```

Lợi ích:
- 🔓 **Tách rời (decoupling)**: Kiểu dữ liệu không cần biết interface nào tồn tại
- 🔌 **Tạo interface cho code có sẵn**: Bạn có thể định nghĩa interface mới mà các kiểu trong thư viện chuẩn (hoặc thư viện của người khác) **tự động thỏa mãn**, không cần sửa code của họ
- 🧪 **Dễ test**: Tạo "mock" chỉ cần viết struct có đủ method

### Interface nhỏ là interface tốt

Thư viện chuẩn của Go có rất nhiều interface **chỉ 1 method**:

```go
type Reader interface {       // io.Reader
	Read(p []byte) (n int, err error)
}

type Writer interface {       // io.Writer
	Write(p []byte) (n int, err error)
}

type Stringer interface {     // fmt.Stringer
	String() string
}

type error interface {        // Kiểu error dựng sẵn!
	Error() string
}
```

> 💡 **Châm ngôn Go**: *"The bigger the interface, the weaker the abstraction."* - Interface càng lớn, sự trừu tượng càng yếu. Quy ước đặt tên interface 1 method: **tên method + "er"** (`Reader`, `Writer`, `Closer`, `Stringer`).

Interface có thể **gộp** từ interface khác:

```go
type ReadWriter interface {
	Reader
	Writer
}
```

### ⚠️ Pointer receiver và interface

```go
package main

import "fmt"

type Speaker interface {
	Speak() string
}

type Cat struct{ Name string }

func (c *Cat) Speak() string { // Pointer receiver!
	return c.Name + ": Meo meo"
}

func main() {
	var s Speaker

	s = &Cat{Name: "Tom"} // ✅ *Cat có method Speak
	fmt.Println(s.Speak())

	// s = Cat{Name: "Tom"} // ❌ Cat does not implement Speaker (method Speak has pointer receiver)
}

// Output:
// Tom: Meo meo
```

**Quy tắc**:
- Method có **value receiver** `(c Cat)` → cả `Cat` và `*Cat` đều thỏa mãn interface
- Method có **pointer receiver** `(c *Cat)` → **chỉ `*Cat`** thỏa mãn interface

### Kiểm tra implement lúc biên dịch

Mẹo phổ biến để đảm bảo một kiểu implement interface (compiler sẽ báo lỗi nếu thiếu method):

```go
var _ Shape = Rectangle{}   // Kiểm tra Rectangle implement Shape
var _ Speaker = (*Cat)(nil) // Kiểm tra *Cat implement Speaker
```

## 📖 8. Empty Interface (`any`), Type Assertion và Type Switch

### Empty interface - `interface{}` hay `any`

Interface **không có method nào** → **mọi kiểu** đều thỏa mãn. Từ Go 1.18, `any` là bí danh của `interface{}`.

```go
package main

import "fmt"

func describe(v any) {
	fmt.Printf("Giá trị: %v, Kiểu: %T\n", v, v)
}

func main() {
	describe(42)
	describe("hello")
	describe(3.14)
	describe([]int{1, 2})

	// Slice chứa nhiều kiểu khác nhau
	things := []any{1, "hai", true, nil}
	fmt.Println(things)
}

// Output:
// Giá trị: 42, Kiểu: int
// Giá trị: hello, Kiểu: string
// Giá trị: 3.14, Kiểu: float64
// Giá trị: [1 2], Kiểu: []int
// [1 hai true <nil>]
```

> ⚠️ **Đừng lạm dụng `any`**: Dùng `any` nghĩa là **mất đi sự kiểm tra kiểu** của compiler. Chỉ dùng khi thật sự cần (như `fmt.Println`, xử lý JSON không rõ cấu trúc). Với code tổng quát, ưu tiên **generics** (mục 10).

### Type Assertion - "Lấy lại" kiểu cụ thể

```go
package main

import "fmt"

func main() {
	var v any = "Xin chào"

	// Cách 1: Assertion trực tiếp - PANIC nếu sai kiểu
	s := v.(string)
	fmt.Println(s)

	// n := v.(int) // 💥 panic: interface conversion: interface {} is string, not int

	// Cách 2: Comma-ok - AN TOÀN ✅
	n, ok := v.(int)
	fmt.Println(n, ok) // n là zero value, ok = false

	if str, ok := v.(string); ok {
		fmt.Println("Là chuỗi, độ dài", len(str))
	}
}

// Output:
// Xin chào
// 0 false
// Là chuỗi, độ dài 9
```

### Type Switch - Xử lý nhiều kiểu

```go
package main

import "fmt"

type Dog struct{}

func (Dog) Speak() string { return "Gâu" }

type Speaker interface{ Speak() string }

func classify(v any) string {
	switch x := v.(type) { // x có kiểu tương ứng trong từng case
	case nil:
		return "nil"
	case int:
		return fmt.Sprintf("int, gấp đôi = %d", x*2)
	case string:
		return fmt.Sprintf("string dài %d byte", len(x))
	case bool:
		if x {
			return "bool: đúng"
		}
		return "bool: sai"
	case []int:
		return fmt.Sprintf("slice int có %d phần tử", len(x))
	case Speaker: // Có thể kiểm tra theo interface!
		return "Biết nói: " + x.Speak()
	case error:
		return "Lỗi: " + x.Error()
	default:
		return fmt.Sprintf("kiểu khác: %T", x)
	}
}

func main() {
	values := []any{21, "Go", true, []int{1, 2, 3}, Dog{}, 3.14, nil, fmt.Errorf("oops")}
	for _, v := range values {
		fmt.Println(classify(v))
	}
}

// Output:
// int, gấp đôi = 42
// string dài 2 byte
// bool: đúng
// slice int có 3 phần tử
// Biết nói: Gâu
// kiểu khác: float64
// nil
// Lỗi: oops
```

## 📖 9. Interface `fmt.Stringer` - Tùy biến cách in

Khi bạn in một giá trị bằng `fmt.Println` hoặc `%v`, `fmt` sẽ kiểm tra: kiểu đó có method `String() string` không? Nếu có, dùng kết quả của nó.

```go
package main

import "fmt"

type Money int64 // Lưu theo đồng

func (m Money) String() string {
	// Thêm dấu chấm phân cách hàng nghìn
	s := fmt.Sprintf("%d", int64(m))
	out := ""
	for i, c := range s {
		if i > 0 && (len(s)-i)%3 == 0 {
			out += "."
		}
		out += string(c)
	}
	return out + " ₫"
}

type Status int

const (
	Pending Status = iota
	Active
	Banned
)

func (s Status) String() string {
	switch s {
	case Pending:
		return "Chờ duyệt"
	case Active:
		return "Hoạt động"
	case Banned:
		return "Bị khóa"
	default:
		return fmt.Sprintf("Status(%d)", int(s))
	}
}

type User struct {
	Name    string
	Balance Money
	Status  Status
}

func main() {
	u := User{Name: "An", Balance: 1500000, Status: Active}
	fmt.Println(u.Balance)
	fmt.Println(u.Status)
	fmt.Printf("%v\n", u) // Các field cũng dùng String() của chúng
	fmt.Println(Status(9))
}

// Output:
// 1.500.000 ₫
// Hoạt động
// {An 1.500.000 ₫ Hoạt động}
// Status(9)
```

> ⚠️ **Bẫy đệ quy vô hạn**: Trong `String()`, **đừng** viết `fmt.Sprintf("%v", s)` với chính `s` - vì `%v` lại gọi `String()` → gọi mãi mãi. Hãy chuyển về kiểu cơ bản trước: `int(s)`.

## 📖 10. Generics cơ bản (Go 1.18+)

### Vấn đề: Code lặp lại

```go
func SumInts(nums []int) int {
	total := 0
	for _, n := range nums { total += n }
	return total
}

func SumFloats(nums []float64) float64 {
	total := 0.0
	for _, n := range nums { total += n }
	return total
}
// ... giống hệt nhau, chỉ khác kiểu 😩
```

### Giải pháp: Type Parameters

```go
package main

import "fmt"

// Number là một CONSTRAINT: tập hợp các kiểu được phép
type Number interface {
	~int | ~int64 | ~float64 // ~int nghĩa là "int VÀ mọi kiểu có kiểu nền là int"
}

// [T Number]: T là type parameter, phải thỏa mãn constraint Number
func Sum[T Number](nums []T) T {
	var total T
	for _, n := range nums {
		total += n
	}
	return total
}

// Map áp dụng hàm f lên từng phần tử, có 2 type parameter
func Map[T, U any](items []T, f func(T) U) []U {
	result := make([]U, 0, len(items))
	for _, item := range items {
		result = append(result, f(item))
	}
	return result
}

// comparable: các kiểu so sánh được bằng == (dùng được làm key map)
func Contains[T comparable](items []T, target T) bool {
	for _, item := range items {
		if item == target {
			return true
		}
	}
	return false
}

type Score int // Kiểu nền là int → thỏa mãn ~int

func main() {
	fmt.Println(Sum([]int{1, 2, 3}))           // T được suy luận là int
	fmt.Println(Sum([]float64{1.5, 2.5}))      // T = float64
	fmt.Println(Sum([]Score{10, 20}))          // T = Score (nhờ ~int)
	fmt.Println(Sum[int64]([]int64{100, 200})) // Chỉ định T tường minh

	lengths := Map([]string{"go", "rust", "python"}, func(s string) int { return len(s) })
	fmt.Println(lengths)

	fmt.Println(Contains([]string{"a", "b"}, "b"))
	fmt.Println(Contains([]int{1, 2, 3}, 5))
}

// Output:
// 6
// 4
// 30
// 300
// [2 4 6]
// true
// false
```

### Các constraint hay dùng

| Constraint | Ý nghĩa | Từ đâu |
|-----------|---------|--------|
| `any` | Mọi kiểu | Dựng sẵn |
| `comparable` | Kiểu so sánh được bằng `==`, `!=` | Dựng sẵn |
| `cmp.Ordered` | Kiểu so sánh được bằng `<`, `>` (số, chuỗi) | Package `cmp` |
| Tự định nghĩa | `interface{ ~int \| ~float64 }` | Bạn tự viết |

### Generic type - Kiểu dữ liệu tổng quát

```go
package main

import (
	"cmp"
	"fmt"
)

// Stack tổng quát: chứa được phần tử kiểu bất kỳ
type Stack[T any] struct {
	items []T
}

func (s *Stack[T]) Push(item T) {
	s.items = append(s.items, item)
}

func (s *Stack[T]) Pop() (T, bool) {
	var zero T // zero value của T
	if len(s.items) == 0 {
		return zero, false
	}
	last := s.items[len(s.items)-1]
	s.items = s.items[:len(s.items)-1]
	return last, true
}

func (s *Stack[T]) Len() int { return len(s.items) }

// Pair chứa 2 giá trị có kiểu khác nhau
type Pair[K comparable, V any] struct {
	Key   K
	Value V
}

// MaxOf dùng cmp.Ordered để so sánh bằng >
func MaxOf[T cmp.Ordered](a, b T) T {
	if a > b {
		return a
	}
	return b
}

func main() {
	var ints Stack[int]
	ints.Push(1)
	ints.Push(2)
	ints.Push(3)
	v, _ := ints.Pop()
	fmt.Println("Pop:", v, "- còn lại:", ints.Len())

	names := &Stack[string]{}
	names.Push("Go")
	top, ok := names.Pop()
	fmt.Println(top, ok)
	_, ok = names.Pop()
	fmt.Println("Pop stack rỗng:", ok)

	p := Pair[string, int]{Key: "tuổi", Value: 30}
	fmt.Printf("%+v\n", p)

	fmt.Println(MaxOf(3, 7), MaxOf("apple", "banana"))
}

// Output:
// Pop: 3 - còn lại: 2
// Go true
// Pop stack rỗng: false
// {Key:tuổi Value:30}
// 7 banana
```

### Khi nào dùng generics?

✅ **Nên dùng**:
- Cấu trúc dữ liệu tổng quát: Stack, Queue, Tree, Cache
- Hàm xử lý slice/map không quan tâm kiểu phần tử: `Map`, `Filter`, `Contains`

❌ **Không nên dùng**:
- Khi interface thông thường đã đủ (ví dụ hàm nhận `io.Reader`)
- Khi chỉ có một kiểu duy nhất được dùng
- "Cho oai" - generics làm code khó đọc hơn nếu lạm dụng

> 💡 **Châm ngôn**: *"Viết code cụ thể trước. Chỉ dùng generics khi bạn thấy mình viết cùng một đoạn code cho nhiều kiểu."* Package `slices` và `maps` ([Bài 5](./05-arrays-slices-maps.md)) chính là generics trong thư viện chuẩn.

## 📖 11. Ví dụ tổng hợp: Hệ thống thông báo

```go
package main

import (
	"fmt"
	"strings"
)

// Interface: bất cứ thứ gì gửi được thông báo
type Notifier interface {
	Notify(to, message string) error
}

type EmailNotifier struct {
	From string
}

func (e EmailNotifier) Notify(to, message string) error {
	if !strings.Contains(to, "@") {
		return fmt.Errorf("email không hợp lệ: %s", to)
	}
	fmt.Printf("📧 [%s → %s] %s\n", e.From, to, message)
	return nil
}

type SMSNotifier struct {
	sent int // Đếm số tin đã gửi → cần pointer receiver
}

func (s *SMSNotifier) Notify(to, message string) error {
	s.sent++
	fmt.Printf("📱 [SMS #%d → %s] %s\n", s.sent, to, message)
	return nil
}

// Service không quan tâm gửi bằng gì - chỉ cần một Notifier
type OrderService struct {
	notifiers []Notifier
}

func NewOrderService(ns ...Notifier) *OrderService {
	return &OrderService{notifiers: ns}
}

func (o *OrderService) PlaceOrder(customer, contact string) {
	msg := fmt.Sprintf("Cảm ơn %s, đơn hàng đã được đặt!", customer)
	for _, n := range o.notifiers {
		if err := n.Notify(contact, msg); err != nil {
			fmt.Printf("⚠️  %T lỗi: %v\n", n, err)
		}
	}
}

func main() {
	sms := &SMSNotifier{}
	service := NewOrderService(EmailNotifier{From: "shop@go.vn"}, sms)

	service.PlaceOrder("An", "an@mail.com")
	service.PlaceOrder("Bình", "0901234567")
	fmt.Println("Tổng SMS đã gửi:", sms.sent)
}

// Output:
// 📧 [shop@go.vn → an@mail.com] Cảm ơn An, đơn hàng đã được đặt!
// 📱 [SMS #1 → an@mail.com] Cảm ơn An, đơn hàng đã được đặt!
// ⚠️  main.EmailNotifier lỗi: email không hợp lệ: 0901234567
// 📱 [SMS #2 → 0901234567] Cảm ơn Bình, đơn hàng đã được đặt!
// Tổng SMS đã gửi: 2
```

> 💡 Muốn thêm kênh Telegram, Slack? Chỉ cần viết struct mới có method `Notify` - **không cần sửa** `OrderService`. Đây là sức mạnh của interface!

## ⚠️ Lỗi thường gặp

### Lỗi 1: Dùng value receiver khi cần thay đổi dữ liệu

```go
func (c Counter) Increment() { c.Count++ } // ❌ Chỉ tăng bản sao
func (c *Counter) Increment() { c.Count++ } // ✅
```

### Lỗi 2: Nil pointer dereference

```go
var u *User
fmt.Println(u.Name) // 💥 panic: runtime error: invalid memory address or nil pointer dereference
```

✅ Luôn kiểm tra `if u != nil` khi hàm có thể trả về `nil`.

### Lỗi 3: Kiểu không implement interface vì pointer receiver

```go
var s Speaker = Cat{} // ❌ Cat does not implement Speaker (method Speak has pointer receiver)
var s Speaker = &Cat{} // ✅
```

### Lỗi 4: Type assertion không kiểm tra → panic

```go
n := v.(int)      // 💥 Nếu v không phải int
n, ok := v.(int)  // ✅ An toàn
```

### Lỗi 5: Interface chứa con trỏ nil KHÔNG bằng nil

```go
package main

import "fmt"

type MyErr struct{}

func (*MyErr) Error() string { return "lỗi" }

func mayFail() error {
	var p *MyErr = nil
	return p // ⚠️ Trả về interface chứa (kiểu *MyErr, giá trị nil)
}

func main() {
	err := mayFail()
	fmt.Println(err == nil) // false! 😱
}

// Output:
// false
```

Một interface chỉ bằng `nil` khi **cả kiểu và giá trị** đều nil. ✅ Hãy `return nil` trực tiếp khi không có lỗi.

### Lỗi 6: Truy cập field unexported từ package khác

```go
// Package bank có: type Account struct { balance int }
acc.balance = 1000 // ❌ acc.balance undefined (cannot refer to unexported field balance)
```

✅ Dùng method exported (`acc.Deposit(1000)`) hoặc constructor.

### Lỗi 7: Vòng lặp vô hạn trong `String()`

```go
func (s Status) String() string {
	return fmt.Sprintf("Status: %v", s) // ❌ Gọi lại String() mãi mãi → stack overflow
}
func (s Status) String() string {
	return fmt.Sprintf("Status: %d", int(s)) // ✅
}
```

### Lỗi 8: Sao chép struct chứa `sync.Mutex`

```go
type SafeCounter struct {
	mu sync.Mutex
	n  int
}
func (c SafeCounter) Inc() { c.mu.Lock(); c.n++; c.mu.Unlock() } // ❌ Khóa bản sao - vô dụng!
```

✅ Dùng pointer receiver. `go vet` sẽ cảnh báo: *"passes lock by value"*.

### Lỗi 9: Sửa field của struct nằm trong map

```go
students := map[string]Student{"an": {Name: "An", Age: 20}}
students["an"].Age = 21 // ❌ cannot assign to struct field students["an"].Age in map
```

Map lưu **bản sao** của struct, nên không sửa trực tiếp field được. ✅ Lấy ra, sửa, rồi gán lại (hoặc dùng `map[string]*Student`):

```go
s := students["an"]
s.Age = 21
students["an"] = s // ✅ Gán lại vào map
```

## 🏋️ Bài tập

### Bài tập 1: Quản lý sách

Tạo struct `Book` (Title, Author, Year, Pages) và `Library` chứa `[]Book`. Viết các method:
- `(l *Library) Add(b Book)`
- `(l *Library) FindByAuthor(author string) []Book`
- `(l Library) OldestBook() (Book, bool)` - trả về `false` nếu thư viện rỗng
- `(b Book) String() string` - in dạng `"Dế Mèn phiêu lưu ký" - Tô Hoài (1941)`

### Bài tập 2: Hình học với interface

Mở rộng interface `Shape` ở mục 7: thêm hình `Square` (dùng embedding `Rectangle` hoặc tự viết). Viết hàm `largest(shapes []Shape) Shape` trả về hình có diện tích lớn nhất. Sắp xếp các hình theo diện tích tăng dần bằng `slices.SortFunc`.

### Bài tập 3: Nhân viên và lương

Tạo interface `Payable` với method `Salary() int`. Implement cho:
- `FullTime` (lương cố định tháng)
- `PartTime` (số giờ × lương/giờ)
- `Intern` (trợ cấp cố định)

Tính tổng quỹ lương cho một `[]Payable`. Dùng type switch để đếm số nhân viên mỗi loại.

### Bài tập 4: Generic Queue

Viết `Queue[T any]` với các method `Enqueue(T)`, `Dequeue() (T, bool)`, `Peek() (T, bool)`, `Len() int`, `IsEmpty() bool`. Test với `Queue[string]` và `Queue[int]`.

### Bài tập 5: Generic Filter và Reduce

Viết:
- `Filter[T any](items []T, keep func(T) bool) []T`
- `Reduce[T, A any](items []T, initial A, f func(A, T) A) A`

Dùng chúng để tính tổng bình phương các số chẵn trong `[]int{1..10}` (kết quả: 220).

### Bài tập 6: Stringer cho enum

Tạo kiểu `Direction` với `North, East, South, West` bằng `iota`. Implement `String()` và method `TurnRight() Direction` (West quay phải thành North).

## ✅ Checklist hoàn thành

- [ ] Định nghĩa struct, khởi tạo bằng tên field
- [ ] Hiểu struct là value type (gán = sao chép)
- [ ] Dùng `&` lấy địa chỉ, `*` truy cập giá trị qua con trỏ
- [ ] Viết method với value receiver và pointer receiver
- [ ] Biết quy tắc chọn receiver và giữ nhất quán
- [ ] Viết constructor `NewX` có validation
- [ ] Dùng embedding và hiểu nó không phải kế thừa
- [ ] Định nghĩa interface và hiểu implement ngầm định
- [ ] Biết pointer receiver ảnh hưởng tới việc implement interface
- [ ] Dùng type assertion với comma-ok và type switch
- [ ] Implement `String()` để tùy biến cách in
- [ ] Viết hàm generic và kiểu generic với constraint
- [ ] Hoàn thành ít nhất 4 bài tập

## 🚀 Tiếp theo

Bạn đã nắm được cách Go tổ chức dữ liệu và hành vi! Bạn cũng đã thấy `error` thực chất chỉ là một interface. Bài tiếp theo sẽ đi sâu vào **xử lý lỗi** - một trong những điểm đặc trưng nhất của Go:

- Interface `error` và cách tạo lỗi
- Bọc lỗi (wrapping) với `%w`
- `errors.Is` và `errors.As`
- `panic` và `recover`

**Bài tiếp theo**: [Xử lý lỗi (Error Handling)](./07-error-handling.md)

---

💡 **Tips ghi nhớ**:

- **Struct = dữ liệu, Method = hành vi, Interface = hợp đồng**
- **Phân vân receiver → dùng pointer**
- **Composition over inheritance** - dùng embedding, không có kế thừa
- **Interface nhỏ** (1-3 method), định nghĩa ở **phía sử dụng**
- **"Accept interfaces, return structs"** - hàm nhận interface, trả về kiểu cụ thể
- **Generics** khi thấy code lặp lại cho nhiều kiểu, không phải "cho oai"
