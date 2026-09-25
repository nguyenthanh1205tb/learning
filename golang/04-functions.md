# 📚 Bài 4: Hàm (Functions)

## 🎯 Mục tiêu bài học

- Khai báo và gọi hàm, hiểu tham số và giá trị trả về
- Hiểu Go truyền tham số theo **giá trị** (pass by value)
- Trả về **nhiều giá trị** - tính năng "đặc sản" của Go
- Sử dụng **named return values** (giá trị trả về có tên)
- Viết **variadic function** - hàm nhận số lượng tham số tùy ý
- Hiểu hàm là **giá trị** (first-class function): gán vào biến, truyền vào hàm khác, trả về từ hàm
- Viết **hàm ẩn danh** (anonymous function) và **closure**
- Viết hàm **đệ quy** (recursion)
- Nắm vững **thứ tự chạy của `defer`** và tương tác với giá trị trả về

## 📖 1. Hàm là gì và tại sao cần hàm?

**Hàm** là một khối code được đặt tên, có thể **tái sử dụng** nhiều lần.

> 💡 **Ví von**: Hàm giống như một **chiếc máy xay sinh tố**: bạn bỏ nguyên liệu vào (**tham số**), máy xử lý bên trong (**thân hàm**), và cho ra sinh tố (**giá trị trả về**). Bạn không cần biết máy hoạt động bên trong thế nào, chỉ cần biết cho gì vào và nhận được gì.

Lợi ích của hàm:

- ♻️ **Tái sử dụng**: Viết một lần, dùng nhiều lần
- 📦 **Tổ chức**: Chia bài toán lớn thành các phần nhỏ dễ hiểu
- 🧪 **Dễ kiểm thử**: Test từng hàm riêng biệt
- 🔧 **Dễ sửa**: Sửa ở một chỗ, mọi nơi gọi hàm đều được cập nhật

## 📖 2. Khai báo hàm

### Cú pháp cơ bản

```go
func tênHàm(thamSố1 kiểu1, thamSố2 kiểu2) kiểuTrảVề {
	// thân hàm
	return giáTrị
}
```

```go
package main

import "fmt"

// Hàm không có tham số, không trả về gì
func sayHello() {
	fmt.Println("Xin chào!")
}

// Hàm có tham số
func greet(name string) {
	fmt.Println("Chào", name)
}

// Hàm có tham số và giá trị trả về
func add(a int, b int) int {
	return a + b
}

// Các tham số CÙNG KIỂU liên tiếp có thể viết gọn
func multiply(a, b int) int {
	return a * b
}

// Tham số khác kiểu
func describe(name string, age int, height float64) string {
	return fmt.Sprintf("%s, %d tuổi, cao %.2fm", name, age, height)
}

func main() {
	sayHello()
	greet("Gopher")
	fmt.Println(add(3, 4))
	fmt.Println(multiply(5, 6))
	fmt.Println(describe("Minh", 25, 1.72))
}

// Output:
// Xin chào!
// Chào Gopher
// 7
// 30
// Minh, 25 tuổi, cao 1.72m
```

### Quy tắc đặt tên hàm

- **camelCase**: `calculateTotal`, `getUserByID`
- **Chữ cái đầu viết HOA** → hàm **exported** (dùng được từ package khác): `CalculateTotal`
- **Chữ cái đầu viết thường** → hàm **unexported** (chỉ dùng trong package): `calculateTotal`
- Tên nên là **động từ** hoặc cụm động từ: `parse`, `sendEmail`, `isValid`

> 💡 **So sánh**: Go **không có overloading** - không thể có 2 hàm cùng tên khác tham số như Java/C#. Mỗi hàm một tên riêng: `addInts`, `addFloats`... (hoặc dùng generics, xem [Bài 6](./06-structs-methods-interfaces.md)). Go **cũng không có tham số mặc định** (`func f(x int = 5)` ❌).

### Thứ tự khai báo không quan trọng

Không như C, trong Go bạn có thể gọi hàm được khai báo **bên dưới** hàm gọi nó. Compiler đọc toàn bộ package trước.

## 📖 3. Pass by Value - Truyền tham số theo giá trị

**Mọi tham số trong Go đều được truyền bằng cách SAO CHÉP giá trị** (pass by value).

```go
package main

import "fmt"

func tryToChange(x int) {
	x = 100 // Chỉ thay đổi bản sao
	fmt.Println("Trong hàm:", x)
}

func main() {
	num := 5
	tryToChange(num)
	fmt.Println("Ngoài hàm:", num) // Vẫn là 5!
}

// Output:
// Trong hàm: 100
// Ngoài hàm: 5
```

> 💡 **Ví von**: Giống như bạn **photo** một tờ giấy đưa cho bạn bè. Họ có viết gì lên bản photo thì bản gốc của bạn vẫn nguyên vẹn.

Muốn hàm **thay đổi được biến gốc**? Truyền **con trỏ** (địa chỉ của biến):

```go
package main

import "fmt"

func reallyChange(x *int) { // *int: con trỏ tới int
	*x = 100 // *x: "giá trị tại địa chỉ x"
}

func main() {
	num := 5
	reallyChange(&num) // &num: "địa chỉ của num"
	fmt.Println(num)
}

// Output:
// 100
```

Con trỏ sẽ được giải thích kỹ ở [Bài 6](./06-structs-methods-interfaces.md). Tạm thời chỉ cần nhớ: `&` lấy địa chỉ, `*` truy cập giá trị tại địa chỉ.

## 📖 4. Trả về nhiều giá trị ⭐

Đây là tính năng **cực kỳ quan trọng** của Go. Một hàm có thể trả về **2, 3 hoặc nhiều giá trị** cùng lúc.

```go
package main

import (
	"errors"
	"fmt"
)

// Trả về 2 giá trị: thương và số dư
func divmod(a, b int) (int, int) {
	return a / b, a % b
}

// Mẫu phổ biến nhất: (kết quả, lỗi)
func divide(a, b float64) (float64, error) {
	if b == 0 {
		return 0, errors.New("không thể chia cho 0")
	}
	return a / b, nil // nil nghĩa là "không có lỗi"
}

// Trả về giá trị nhỏ nhất và lớn nhất
func minMax(nums []int) (int, int) {
	lo, hi := nums[0], nums[0]
	for _, n := range nums[1:] {
		if n < lo {
			lo = n
		}
		if n > hi {
			hi = n
		}
	}
	return lo, hi
}

func main() {
	q, r := divmod(17, 5)
	fmt.Printf("17 / 5 = %d dư %d\n", q, r)

	result, err := divide(10, 4)
	if err != nil {
		fmt.Println("Lỗi:", err)
	} else {
		fmt.Println("Kết quả:", result)
	}

	_, err = divide(1, 0) // Dùng _ để bỏ qua giá trị không cần
	if err != nil {
		fmt.Println("Lỗi:", err)
	}

	lo, hi := minMax([]int{4, 9, 1, 7, 3})
	fmt.Println("Min:", lo, "Max:", hi)
}

// Output:
// 17 / 5 = 3 dư 2
// Kết quả: 2.5
// Lỗi: không thể chia cho 0
// Min: 1 Max: 9
```

**Tại sao nhiều giá trị trả về lại quan trọng?**

So sánh cách xử lý lỗi của các ngôn ngữ:

| Ngôn ngữ | Cách báo lỗi | Vấn đề |
|----------|-------------|--------|
| C | Trả về `-1` hoặc mã lỗi đặc biệt | Dễ nhầm lẫn giá trị lỗi với giá trị thật |
| Java/Python/C# | Ném exception | Luồng code "nhảy" khó đoán, dễ quên bắt lỗi |
| **Go** | Trả về `(kết quả, error)` | Lỗi hiển hiện rõ ràng, bắt buộc phải nghĩ đến |

> 💡 **Quy ước**: Nếu hàm có trả về `error`, nó **luôn là giá trị cuối cùng**.

### Truyền trực tiếp kết quả nhiều giá trị

```go
func pair() (int, int) { return 3, 4 }
func sum(a, b int) int  { return a + b }

fmt.Println(sum(pair())) // Output: 7 - kết quả của pair() được truyền thẳng vào sum
```

## 📖 5. Named Return Values - Giá trị trả về có tên

Bạn có thể **đặt tên** cho giá trị trả về. Chúng được khai báo như biến bình thường (với zero value) ở đầu hàm:

```go
package main

import "fmt"

// width, height là biến đã được khai báo sẵn, giá trị ban đầu = 0
func rectangleInfo(w, h float64) (area, perimeter float64) {
	area = w * h
	perimeter = 2 * (w + h)
	return // "Naked return" - tự động trả về area và perimeter
}

func main() {
	a, p := rectangleInfo(3, 4)
	fmt.Println("Diện tích:", a, "Chu vi:", p)
}

// Output:
// Diện tích: 12 Chu vi: 14
```

### Khi nào nên dùng named return?

✅ **Nên dùng**:
- Làm **tài liệu**: Khi các giá trị trả về cùng kiểu, tên giúp người đọc hiểu cái nào là cái nào: `func split(s string) (head, tail string)`
- Khi cần **sửa giá trị trả về trong `defer`** (xem mục 10)

❌ **Không nên**:
- Dùng **naked return** (`return` trống) trong hàm dài → người đọc phải cuộn lên để biết hàm trả về gì
- ✅ Có thể vừa đặt tên vừa `return` tường minh: `return area, perimeter`

## 📖 6. Variadic Functions - Số lượng tham số tùy ý

Hàm **variadic** nhận **0 hoặc nhiều** tham số cùng kiểu, dùng `...` trước kiểu:

```go
package main

import "fmt"

// nums có kiểu []int bên trong hàm
func sum(nums ...int) int {
	total := 0
	for _, n := range nums {
		total += n
	}
	return total
}

// Tham số variadic phải là tham số CUỐI CÙNG
func greetAll(greeting string, names ...string) {
	for _, name := range names {
		fmt.Println(greeting, name)
	}
}

func main() {
	fmt.Println(sum())           // Không tham số nào
	fmt.Println(sum(1, 2))       // 2 tham số
	fmt.Println(sum(1, 2, 3, 4)) // 4 tham số

	// Truyền một slice có sẵn: thêm ... phía sau
	numbers := []int{10, 20, 30}
	fmt.Println(sum(numbers...))

	greetAll("Xin chào", "An", "Bình", "Chi")
}

// Output:
// 0
// 3
// 10
// 60
// Xin chào An
// Xin chào Bình
// Xin chào Chi
```

> 💡 Bạn đã dùng variadic function từ Bài 1 rồi đấy! `fmt.Println(a ...any)` chính là variadic - đó là lý do nó nhận bao nhiêu tham số cũng được.

### Nhớ phân biệt vị trí của `...`

| Cú pháp | Vị trí | Ý nghĩa |
|---------|--------|---------|
| `func f(nums ...int)` | **Trước** kiểu, khi khai báo | "Nhận nhiều int, gom thành slice" |
| `f(slice...)` | **Sau** biến, khi gọi | "Rải slice ra thành nhiều tham số" |

## 📖 7. Hàm là giá trị (First-class Functions)

Trong Go, hàm là **"công dân hạng nhất"**: có thể gán vào biến, truyền làm tham số, trả về từ hàm khác - giống như số hay chuỗi.

### Gán hàm vào biến

```go
package main

import "fmt"

func add(a, b int) int      { return a + b }
func subtract(a, b int) int { return a - b }

func main() {
	var op func(int, int) int // Biến có kiểu "hàm nhận 2 int, trả về int"

	op = add
	fmt.Println(op(10, 3))

	op = subtract
	fmt.Println(op(10, 3))

	fmt.Printf("%T\n", op)

	// Map chứa hàm - tạo "bảng tra cứu" phép tính
	operations := map[string]func(int, int) int{
		"+": add,
		"-": subtract,
		"*": func(a, b int) int { return a * b }, // Hàm ẩn danh
	}
	for _, sym := range []string{"+", "-", "*"} {
		fmt.Printf("8 %s 2 = %d\n", sym, operations[sym](8, 2))
	}
}

// Output:
// 13
// 7
// func(int, int) int
// 8 + 2 = 10
// 8 - 2 = 6
// 8 * 2 = 16
```

### Định nghĩa kiểu hàm với `type`

Khi kiểu hàm dài và dùng nhiều lần, hãy đặt tên cho nó:

```go
type MathFunc func(float64) float64
type Predicate func(int) bool
```

### Truyền hàm vào hàm khác (Higher-order function)

```go
package main

import "fmt"

type Predicate func(int) bool

// filter giữ lại các phần tử thỏa mãn điều kiện keep
func filter(nums []int, keep Predicate) []int {
	var result []int
	for _, n := range nums {
		if keep(n) {
			result = append(result, n)
		}
	}
	return result
}

// apply áp dụng hàm f lên từng phần tử
func apply(nums []int, f func(int) int) []int {
	result := make([]int, len(nums))
	for i, n := range nums {
		result[i] = f(n)
	}
	return result
}

func isEven(n int) bool { return n%2 == 0 }

func main() {
	nums := []int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}

	fmt.Println(filter(nums, isEven))
	fmt.Println(filter(nums, func(n int) bool { return n > 7 }))
	fmt.Println(apply(nums, func(n int) int { return n * n }))
}

// Output:
// [2 4 6 8 10]
// [8 9 10]
// [1 4 9 16 25 36 49 64 81 100]
```

> 💡 Đây chính là tư tưởng của `filter`/`map` trong JavaScript hay Python. Thư viện chuẩn của Go cũng dùng rất nhiều: `sort.Slice(s, func(i, j int) bool {...})`, `strings.FieldsFunc`, `http.HandleFunc`...

## 📖 8. Hàm ẩn danh (Anonymous Functions)

Hàm **không có tên**, thường dùng khi chỉ cần dùng một lần:

```go
package main

import "fmt"

func main() {
	// Gán hàm ẩn danh vào biến
	square := func(x int) int {
		return x * x
	}
	fmt.Println(square(7))

	// Định nghĩa và GỌI NGAY (IIFE - Immediately Invoked Function Expression)
	result := func(a, b int) int {
		return a*10 + b
	}(4, 2) // ← Dấu () ở cuối để gọi ngay
	fmt.Println(result)

	func() {
		fmt.Println("Tôi chạy ngay lập tức!")
	}()
}

// Output:
// 49
// 42
// Tôi chạy ngay lập tức!
```

Hàm ẩn danh rất hay dùng với `defer` và `go` (goroutine - [Bài 8](./08-concurrency.md)):

```go
defer func() {
	fmt.Println("Dọn dẹp nhiều thứ cùng lúc")
}()

go func() {
	fmt.Println("Chạy song song")
}()
```

## 📖 9. Closure - Hàm "nhớ" môi trường của nó ⭐

**Closure** là hàm ẩn danh **tham chiếu tới biến bên ngoài** nó. Điều đặc biệt: closure **"nhớ" và giữ các biến đó sống** kể cả khi hàm bên ngoài đã kết thúc.

```go
package main

import "fmt"

// counter trả về một HÀM. Hàm đó "nhớ" biến count
func counter() func() int {
	count := 0 // Biến này "sống" trong closure
	return func() int {
		count++
		return count
	}
}

func main() {
	next := counter()
	fmt.Println(next()) // count = 1
	fmt.Println(next()) // count = 2
	fmt.Println(next()) // count = 3

	// Mỗi lần gọi counter() tạo ra một count MỚI, độc lập
	other := counter()
	fmt.Println(other()) // count riêng của other = 1
	fmt.Println(next())  // count của next tiếp tục = 4
}

// Output:
// 1
// 2
// 3
// 1
// 4
```

> 💡 **Ví von**: Closure giống một **chiếc ba lô**. Khi hàm bên trong được tạo ra, nó "đeo ba lô" chứa các biến xung quanh mà nó cần. Dù đi đâu, nó vẫn mang theo ba lô đó. Mỗi lần gọi `counter()` là một ba lô mới.

### Ứng dụng thực tế của closure

**1. Hàm tạo hàm (function factory)**

```go
package main

import "fmt"

func multiplier(factor int) func(int) int {
	return func(x int) int {
		return x * factor // "nhớ" factor
	}
}

func makeGreeter(greeting string) func(string) string {
	return func(name string) string {
		return greeting + ", " + name + "!"
	}
}

func main() {
	double := multiplier(2)
	triple := multiplier(3)
	fmt.Println(double(5), triple(5))

	hello := makeGreeter("Hello")
	xinChao := makeGreeter("Xin chào")
	fmt.Println(hello("Tom"))
	fmt.Println(xinChao("Lan"))
}

// Output:
// 10 15
// Hello, Tom!
// Xin chào, Lan!
```

**2. Middleware / Decorator - "bọc" thêm chức năng cho hàm**

```go
package main

import (
	"fmt"
	"time"
)

// withTiming bọc hàm f, thêm chức năng đo thời gian
func withTiming(name string, f func()) func() {
	return func() {
		start := time.Now()
		f()
		fmt.Printf("[%s] chạy xong trong %v\n", name, time.Since(start).Round(time.Millisecond))
	}
}

func slowTask() {
	time.Sleep(50 * time.Millisecond)
	fmt.Println("Đã xử lý xong công việc chậm")
}

func main() {
	timed := withTiming("slowTask", slowTask)
	timed()
}

// Output:
// Đã xử lý xong công việc chậm
// [slowTask] chạy xong trong 50ms
```

> ⏱️ Thời gian đo được trên máy bạn có thể chênh lệch vài mili giây (ví dụ `51ms`).

> 💡 Mẫu "bọc hàm" này chính là cách **middleware** hoạt động trong web server Go (logging, xác thực...). Bạn sẽ gặp lại ở [Bài 10](./10-final-project.md).

**3. Memoization - Ghi nhớ kết quả đã tính**

```go
package main

import "fmt"

func memoize(f func(int) int) func(int) int {
	cache := map[int]int{}
	return func(n int) int {
		if v, ok := cache[n]; ok {
			fmt.Printf("(cache hit %d) ", n)
			return v
		}
		v := f(n)
		cache[n] = v
		return v
	}
}

func main() {
	slowSquare := func(n int) int { return n * n }
	fast := memoize(slowSquare)
	fmt.Println(fast(4))
	fmt.Println(fast(4))
	fmt.Println(fast(5))
}

// Output:
// 16
// (cache hit 4) 16
// 25
```

### ⚠️ Closure bắt BIẾN, không bắt GIÁ TRỊ

```go
package main

import "fmt"

func main() {
	x := 1
	show := func() { fmt.Println("x =", x) }

	show()
	x = 99 // Thay đổi x SAU khi tạo closure
	show() // Closure thấy giá trị MỚI vì nó tham chiếu tới chính biến x
}

// Output:
// x = 1
// x = 99
```

> 💡 **Biến vòng lặp và closure**: Trước Go 1.22, mọi vòng lặp `for` dùng **chung một** biến `i` → closure tạo trong vòng lặp thường in ra cùng một giá trị (bug kinh điển). Từ **Go 1.22**, mỗi vòng lặp có biến `i` **riêng**, nên bug này không còn nữa (với module khai báo `go 1.22` trở lên trong `go.mod`). Chi tiết ở [Bài 8](./08-concurrency.md).

## 📖 10. Đệ quy (Recursion)

**Đệ quy** là khi một hàm **gọi chính nó**. Mỗi hàm đệ quy cần:

1. **Trường hợp cơ sở (base case)**: điều kiện dừng
2. **Bước đệ quy**: gọi lại chính nó với bài toán **nhỏ hơn**

> 💡 **Ví von**: Giống **búp bê Nga (Matryoshka)** - mở một con búp bê thấy con nhỏ hơn bên trong, cứ thế đến con nhỏ nhất không mở được nữa (base case).

```go
package main

import "fmt"

// Giai thừa: n! = n × (n-1)!
func factorial(n int) int {
	if n <= 1 { // Base case
		return 1
	}
	return n * factorial(n-1) // Bước đệ quy
}

// Fibonacci: F(n) = F(n-1) + F(n-2)
func fibonacci(n int) int {
	if n < 2 {
		return n
	}
	return fibonacci(n-1) + fibonacci(n-2)
}

// Tính tổng các chữ số: 1234 → 1+2+3+4 = 10
func digitSum(n int) int {
	if n < 10 {
		return n
	}
	return n%10 + digitSum(n/10)
}

// Đảo ngược chuỗi (theo rune để hỗ trợ tiếng Việt)
func reverse(s []rune) string {
	if len(s) <= 1 {
		return string(s)
	}
	return reverse(s[1:]) + string(s[0])
}

func main() {
	fmt.Println("5! =", factorial(5))

	fmt.Print("Fibonacci: ")
	for i := range 10 {
		fmt.Print(fibonacci(i), " ")
	}
	fmt.Println()

	fmt.Println("Tổng chữ số 98765:", digitSum(98765))
	fmt.Println(reverse([]rune("Gopher Việt")))
}

// Output:
// 5! = 120
// Fibonacci: 0 1 1 2 3 5 8 13 21 34
// Tổng chữ số 98765: 35
// tệiV rehpoG
```

Cách `factorial(4)` chạy:

```text
factorial(4)
= 4 * factorial(3)
= 4 * (3 * factorial(2))
= 4 * (3 * (2 * factorial(1)))
= 4 * (3 * (2 * 1))          ← base case
= 24
```

### ⚠️ Lưu ý về đệ quy

- **Quên base case** → gọi mãi → `fatal error: stack overflow` (Go cho phép stack lớn tới ~1GB nên sẽ chạy khá lâu mới báo lỗi)
- **Fibonacci đệ quy thuần rất chậm** (`fibonacci(45)` mất vài giây) vì tính lặp lại nhiều lần → dùng vòng lặp hoặc memoization
- Go **không tối ưu tail call** → với dữ liệu rất sâu, ưu tiên dùng vòng lặp

Fibonacci bằng vòng lặp (nhanh hơn rất nhiều):

```go
func fibIter(n int) int {
	a, b := 0, 1
	for range n {
		a, b = b, a+b
	}
	return a
}
```

## 📖 11. `defer` chuyên sâu - Thứ tự chạy

Bạn đã biết `defer` cơ bản ở [Bài 3](./03-control-flow.md). Giờ hãy xem chi tiết hơn.

### Ba quy tắc của `defer`

**Quy tắc 1**: Tham số được tính **ngay khi gặp `defer`**, không phải khi chạy.

**Quy tắc 2**: Các `defer` chạy theo thứ tự **LIFO** (vào sau, ra trước).

**Quy tắc 3**: `defer` có thể **đọc và sửa named return values**.

```go
package main

import "fmt"

func rule1() {
	i := 0
	defer fmt.Println("rule1 - defer thấy i =", i) // i = 0 được chụp lại NGAY
	i++
	fmt.Println("rule1 - i hiện tại =", i)
}

func rule2() {
	fmt.Print("rule2: ")
	for i := range 4 {
		defer fmt.Print(i, " ")
	}
}

func rule3() (result int) {
	defer func() {
		result *= 2 // Sửa giá trị trả về SAU khi return đã gán result = 21
	}()
	return 21
}

func main() {
	rule1()
	rule2()
	fmt.Println()
	fmt.Println("rule3 trả về:", rule3())
}

// Output:
// rule1 - i hiện tại = 1
// rule1 - defer thấy i = 0
// rule2: 3 2 1 0
// rule3 trả về: 42
```

### Thứ tự chính xác khi hàm `return`

```text
return 21
   │
   ├─ 1. Gán giá trị trả về: result = 21
   ├─ 2. Chạy các defer (LIFO): result *= 2 → result = 42
   └─ 3. Hàm thực sự kết thúc, trả về 42
```

### Defer với closure: muốn thấy giá trị MỚI NHẤT

```go
package main

import "fmt"

func main() {
	x := 1
	defer fmt.Println("defer trực tiếp:", x) // Chụp x = 1
	defer func() {
		fmt.Println("defer closure:", x) // Đọc x lúc chạy → 3
	}()
	x = 3
}

// Output:
// defer closure: 3
// defer trực tiếp: 1
```

### Ứng dụng thực tế: log khi vào và ra khỏi hàm

```go
package main

import "fmt"

func trace(name string) func() {
	fmt.Println("➡️  Vào", name)
	return func() { fmt.Println("⬅️  Ra", name) }
}

func step2() {
	defer trace("step2")() // Chú ý dấu () thứ hai: gọi trace NGAY, defer hàm nó trả về
	fmt.Println("   đang làm step2")
}

func step1() {
	defer trace("step1")()
	fmt.Println("   đang làm step1")
	step2()
}

func main() {
	step1()
}

// Output:
// ➡️  Vào step1
//    đang làm step1
// ➡️  Vào step2
//    đang làm step2
// ⬅️  Ra step2
// ⬅️  Ra step1
```

## 📖 12. Ví dụ tổng hợp: Máy tính với bảng phép toán

```go
package main

import (
	"errors"
	"fmt"
)

type operation func(a, b float64) (float64, error)

func calculator() map[string]operation {
	return map[string]operation{
		"+": func(a, b float64) (float64, error) { return a + b, nil },
		"-": func(a, b float64) (float64, error) { return a - b, nil },
		"*": func(a, b float64) (float64, error) { return a * b, nil },
		"/": func(a, b float64) (float64, error) {
			if b == 0 {
				return 0, errors.New("chia cho 0")
			}
			return a / b, nil
		},
	}
}

func evaluate(ops map[string]operation, a float64, op string, b float64) (string, error) {
	f, ok := ops[op]
	if !ok {
		return "", fmt.Errorf("phép toán %q không được hỗ trợ", op)
	}
	result, err := f(a, b)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%g %s %g = %g", a, op, b, result), nil
}

func main() {
	ops := calculator()
	tests := []struct {
		a  float64
		op string
		b  float64
	}{
		{6, "+", 4}, {6, "-", 4}, {6, "*", 4}, {6, "/", 4}, {6, "/", 0}, {6, "^", 2},
	}

	for _, t := range tests {
		if s, err := evaluate(ops, t.a, t.op, t.b); err != nil {
			fmt.Println("❌ Lỗi:", err)
		} else {
			fmt.Println("✅", s)
		}
	}
}

// Output:
// ✅ 6 + 4 = 10
// ✅ 6 - 4 = 2
// ✅ 6 * 4 = 24
// ✅ 6 / 4 = 1.5
// ❌ Lỗi: chia cho 0
// ❌ Lỗi: phép toán "^" không được hỗ trợ
```

## ⚠️ Lỗi thường gặp

### Lỗi 1: Quên `return` trong hàm có giá trị trả về

```go
func sign(n int) string {
	if n > 0 {
		return "dương"
	} else if n < 0 {
		return "âm"
	}
} // ❌ missing return
```

✅ Compiler yêu cầu mọi đường đi đều phải có `return`. Thêm `return "không"` ở cuối.

### Lỗi 2: Không dùng hết giá trị trả về

```go
result := divide(10, 2) // ❌ assignment mismatch: 1 variable but divide returns 2 values
result, err := divide(10, 2) // ✅
result, _ := divide(10, 2)   // ✅ (nếu chắc chắn không lỗi - nhưng hãy cẩn thận!)
```

### Lỗi 3: Mong đợi hàm thay đổi biến truyền vào

```go
func reset(x int) { x = 0 }
n := 5
reset(n)
fmt.Println(n) // Vẫn 5! Go truyền bản sao
```

✅ Trả về giá trị mới (`n = reset(n)`) hoặc truyền con trỏ (`reset(&n)`).

### Lỗi 4: Đặt tham số variadic không ở cuối

```go
func f(nums ...int, name string) {} // ❌ can only use ... with final parameter in list
func f(name string, nums ...int) {} // ✅
```

### Lỗi 5: Quên `...` khi truyền slice vào variadic

```go
nums := []int{1, 2, 3}
sum(nums)    // ❌ cannot use nums (variable of type []int) as int value in argument to sum
sum(nums...) // ✅
```

### Lỗi 6: Quên `()` khi defer/gọi hàm ẩn danh

```go
defer func() { fmt.Println("bye") }  // ❌ expression in defer must be function call
defer func() { fmt.Println("bye") }() // ✅
```

### Lỗi 7: Shadowing - Vô tình tạo biến mới trong scope con

```go
func findUser() (name string, err error) {
	if true {
		name, err := "An", error(nil) // ⚠️ := tạo biến MỚI che biến name, err bên ngoài
		_ = name
		_ = err
	}
	return // Trả về "", nil - không phải "An"!
}
```

✅ Dùng `=` thay vì `:=` khi muốn gán vào biến đã có. `go vet` với analyzer `shadow` có thể giúp phát hiện.

### Lỗi 8: Đệ quy không có base case

```go
func countdown(n int) {
	fmt.Println(n)
	countdown(n - 1) // ❌ Không bao giờ dừng → stack overflow
}
```

✅ Luôn viết base case **trước tiên**: `if n < 0 { return }`.

## 🏋️ Bài tập

### Bài tập 1: Thống kê

Viết hàm `stats(nums ...float64) (min, max, avg float64)` trả về giá trị nhỏ nhất, lớn nhất và trung bình. Xử lý trường hợp không có tham số nào (trả về 0, 0, 0).

### Bài tập 2: Kiểm tra số nguyên tố

Viết hàm `isPrime(n int) bool`, sau đó dùng hàm `filter` (ở mục 7) để lọc các số nguyên tố từ 1 đến 50.

### Bài tập 3: Closure đếm theo bước

Viết hàm `stepCounter(start, step int) func() int`. Mỗi lần gọi hàm trả về, giá trị tăng thêm `step`:

```go
c := stepCounter(10, 5)
fmt.Println(c(), c(), c()) // 10 15 20
```

### Bài tập 4: Compose

Viết hàm `compose(f, g func(int) int) func(int) int` trả về hàm tính `f(g(x))`. Thử với `f = x + 1` và `g = x * 2`: `compose(f, g)(5)` phải bằng `11`.

### Bài tập 5: Đệ quy

1. Viết hàm đệ quy `power(base, exp int) int` tính lũy thừa
2. Viết hàm đệ quy `isPalindrome(s string) bool` kiểm tra chuỗi đối xứng (ví dụ "radar", "level")
3. **Nâng cao**: Tháp Hà Nội - in ra các bước di chuyển 3 đĩa từ cột A sang cột C

### Bài tập 6: Dự đoán output

Không chạy code, hãy đoán output của chương trình sau, rồi chạy thử để kiểm tra:

```go
package main

import "fmt"

func f() (x int) {
	defer func() { x++ }()
	defer fmt.Println("x lúc defer:", x)
	x = 10
	return x * 2
}

func main() {
	fmt.Println("kết quả:", f())
}
```

<details>
<summary>👉 Xem đáp án</summary>

```text
x lúc defer: 0
kết quả: 21
```

Giải thích: `fmt.Println` được defer với `x = 0` (tính ngay lúc gặp defer). `return x * 2` gán `x = 20`, sau đó closure chạy `x++` → `21`.

</details>

## ✅ Checklist hoàn thành

- [ ] Khai báo hàm có tham số và giá trị trả về
- [ ] Hiểu Go truyền tham số theo giá trị (bản sao)
- [ ] Viết hàm trả về nhiều giá trị, đặc biệt mẫu `(kết quả, error)`
- [ ] Hiểu named return và khi nào nên/không nên dùng naked return
- [ ] Viết và gọi variadic function, biết `slice...`
- [ ] Gán hàm vào biến, truyền hàm làm tham số
- [ ] Viết hàm ẩn danh và gọi ngay (IIFE)
- [ ] Hiểu closure "nhớ" biến bên ngoài
- [ ] Viết hàm đệ quy có base case đúng
- [ ] Nắm 3 quy tắc của `defer`
- [ ] Hoàn thành ít nhất 4 bài tập

## 🚀 Tiếp theo

Bạn đã nắm vững hàm - công cụ tổ chức code quan trọng nhất! Tiếp theo, hãy học cách lưu trữ **tập hợp dữ liệu**:

- Array - mảng cố định
- Slice - "mảng động" dùng nhiều nhất trong Go
- Map - bảng tra cứu key-value
- Package `slices` và `maps` hiện đại

**Bài tiếp theo**: [Array, Slice & Map](./05-arrays-slices-maps.md)

---

💡 **Tips ghi nhớ**:

- **`(result, error)`** - mẫu trả về quan trọng nhất trong Go
- **Hàm là giá trị** - truyền qua lại như số hay chuỗi
- **Closure = hàm + ba lô biến** - rất mạnh cho factory và middleware
- **`defer` chạy LIFO**, tham số tính ngay, có thể sửa named return
- **Không overloading, không tham số mặc định** - Go chọn sự đơn giản
