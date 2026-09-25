# 📚 Bài 3: Cấu trúc điều khiển

## 🎯 Mục tiêu bài học

- Sử dụng `if`, `else if`, `else` và `if` với **câu lệnh khởi tạo** (init statement)
- Thành thạo vòng lặp `for` với **cả 4 dạng**: kiểu C, kiểu while, vô hạn và `range`
- Sử dụng `switch` - mạnh mẽ và an toàn hơn C/Java (không cần `break`)
- Dùng `switch` không có biểu thức để thay thế chuỗi `if-else` dài
- Điều khiển vòng lặp với `break`, `continue` và **label**
- Hiểu `defer` cơ bản - "hẹn làm sau"

## 📖 1. Câu lệnh `if`

### `if` cơ bản

```go
package main

import "fmt"

func main() {
	temperature := 32

	if temperature > 30 {
		fmt.Println("Trời nóng quá! 🥵")
	}

	score := 7.5
	if score >= 8 {
		fmt.Println("Giỏi")
	} else if score >= 6.5 {
		fmt.Println("Khá")
	} else if score >= 5 {
		fmt.Println("Trung bình")
	} else {
		fmt.Println("Yếu")
	}
}

// Output:
// Trời nóng quá! 🥵
// Khá
```

Những điểm khác với C/Java/JavaScript:

- ✅ **Không cần** ngoặc tròn quanh điều kiện: `if x > 5 {`
- ✅ **Bắt buộc** có ngoặc nhọn `{}` kể cả khi chỉ có 1 dòng
- ✅ `else` phải nằm **cùng dòng** với `}` đóng: `} else {`
- ✅ Điều kiện **bắt buộc** là kiểu `bool` - không có "truthy/falsy"

```go
// ❌ Không hợp lệ trong Go:
// if x > 5 fmt.Println("lớn")   // Thiếu {}
// if name { }                    // name là string, không phải bool
// }
// else {                         // else phải cùng dòng với }
```

### `if` với câu lệnh khởi tạo (init statement) ⭐

Đây là tính năng **rất đặc trưng** của Go. Bạn có thể chạy một câu lệnh ngắn **trước** điều kiện, ngăn cách bằng dấu `;`:

```go
if <câu lệnh khởi tạo>; <điều kiện> {
	// ...
}
```

Ví dụ thực tế:

```go
package main

import (
	"fmt"
	"strconv"
)

func main() {
	input := "42"

	// num và err chỉ tồn tại bên trong khối if/else này
	if num, err := strconv.Atoi(input); err != nil {
		fmt.Println("Lỗi:", err)
	} else {
		fmt.Println("Số gấp đôi:", num*2)
	}

	// fmt.Println(num) // ❌ Lỗi: undefined: num (ra khỏi phạm vi)

	// Ví dụ khác: tính toán rồi so sánh
	price, qty := 150_000, 3
	if total := price * qty; total > 400_000 {
		fmt.Println("Được miễn phí vận chuyển! Tổng:", total)
	}
}

// Output:
// Số gấp đôi: 84
// Được miễn phí vận chuyển! Tổng: 450000
```

**Tại sao lại hay?**

- 🎯 **Giới hạn phạm vi (scope)**: Biến `num`, `err` chỉ sống trong `if/else`, không "rò rỉ" ra ngoài làm rối code
- 🎯 **Gọn gàng**: Gom việc "lấy giá trị" và "kiểm tra" vào một chỗ
- 🎯 Bạn sẽ thấy mẫu `if err := doSomething(); err != nil { ... }` ở khắp nơi trong code Go

### Phong cách "return sớm" (early return)

Trong Go, người ta **tránh lồng `if` sâu**. Thay vào đó, xử lý trường hợp lỗi/đặc biệt trước rồi `return`:

> 📝 Ví dụ dưới đây (và một vài ví dụ khác trong bài) dùng hàm tự viết dạng `func tên(thamSố kiểu) kiểuTrảVề { ... }` như hàm `greet` ở Bài 1. `return` nghĩa là "kết thúc hàm và trả giá trị về". Bạn sẽ học kỹ về hàm ở [Bài 4](./04-functions.md).

```go
// ❌ Lồng nhau khó đọc ("mũi tên hướng phải")
func checkAge(age int) string {
	if age >= 0 {
		if age < 150 {
			if age >= 18 {
				return "Người lớn"
			} else {
				return "Trẻ em"
			}
		} else {
			return "Tuổi không hợp lệ"
		}
	} else {
		return "Tuổi không hợp lệ"
	}
}

// ✅ Return sớm - "happy path" nằm ở lề trái
func checkAgeBetter(age int) string {
	if age < 0 || age >= 150 {
		return "Tuổi không hợp lệ"
	}
	if age < 18 {
		return "Trẻ em"
	}
	return "Người lớn"
}
```

> 💡 **Quy tắc**: Nếu khối `if` kết thúc bằng `return`, thì **không cần `else`**. Công cụ lint của Go sẽ nhắc bạn điều này.

## 📖 2. Vòng lặp `for` - Vòng lặp DUY NHẤT của Go

Go chỉ có **một** từ khóa vòng lặp là `for`. Không có `while`, không có `do-while`. Nhưng `for` "biến hình" được thành mọi loại vòng lặp.

> 💡 **Ví von**: `for` giống một con dao Thụy Sĩ - một công cụ, nhiều chức năng. Ít từ khóa hơn → ít thứ phải nhớ hơn.

### Dạng 1: Kiểu C cổ điển (init; condition; post)

```go
package main

import "fmt"

func main() {
	for i := 1; i <= 5; i++ {
		fmt.Print(i, " ")
	}
	fmt.Println()

	// Đếm ngược, bước nhảy 2
	for i := 10; i > 0; i -= 2 {
		fmt.Print(i, " ")
	}
	fmt.Println()

	// Tính tổng 1 + 2 + ... + 100
	sum := 0
	for i := 1; i <= 100; i++ {
		sum += i
	}
	fmt.Println("Tổng:", sum)
}

// Output:
// 1 2 3 4 5
// 10 8 6 4 2
// Tổng: 5050
```

Ba phần của vòng lặp:
1. **`i := 1`** (init): chạy **một lần** trước khi bắt đầu
2. **`i <= 5`** (condition): kiểm tra **trước mỗi vòng**, nếu `false` thì dừng
3. **`i++`** (post): chạy **sau mỗi vòng**

### Dạng 1b: Lặp N lần với `range` số nguyên (Go 1.22+)

Từ Go 1.22, bạn có thể `range` trực tiếp trên một số nguyên:

```go
package main

import "fmt"

func main() {
	for i := range 5 { // i chạy từ 0 đến 4
		fmt.Print(i, " ")
	}
	fmt.Println()

	for range 3 { // Không cần biến đếm
		fmt.Println("Go!")
	}
}

// Output:
// 0 1 2 3 4
// Go!
// Go!
// Go!
```

### Dạng 2: Kiểu "while" (chỉ có điều kiện)

```go
package main

import "fmt"

func main() {
	// Tương đương while (n < 100) trong ngôn ngữ khác
	n := 1
	for n < 100 {
		n *= 2
	}
	fmt.Println(n)

	// Đếm số chữ số của một số
	number := 98765
	digits := 0
	for number > 0 {
		number /= 10
		digits++
	}
	fmt.Println("Số chữ số:", digits)
}

// Output:
// 128
// Số chữ số: 5
```

### Dạng 3: Vòng lặp vô hạn

```go
package main

import "fmt"

func main() {
	count := 0
	for { // Không có điều kiện = lặp mãi mãi
		count++
		if count == 3 {
			fmt.Println("Dừng ở lần", count)
			break // Thoát vòng lặp
		}
		fmt.Println("Lần", count)
	}
}

// Output:
// Lần 1
// Lần 2
// Dừng ở lần 3
```

Vòng lặp vô hạn thường dùng cho: server chờ request, game loop, đọc dữ liệu đến khi hết, worker xử lý công việc...

**Mô phỏng `do-while`** (chạy ít nhất 1 lần):

```go
for {
	// làm việc gì đó...
	if !condition {
		break
	}
}
```

### Dạng 4: `for ... range` - Duyệt qua tập hợp

`range` dùng để duyệt qua slice, array, string, map, channel. (Chi tiết về slice và map ở [Bài 5](./05-arrays-slices-maps.md).)

```go
package main

import "fmt"

func main() {
	fruits := []string{"Táo", "Cam", "Xoài"}

	// Lấy cả index và giá trị
	for i, fruit := range fruits {
		fmt.Printf("%d: %s\n", i, fruit)
	}

	// Chỉ lấy giá trị (bỏ index bằng _)
	for _, fruit := range fruits {
		fmt.Print(fruit, " ")
	}
	fmt.Println()

	// Chỉ lấy index
	for i := range fruits {
		fmt.Print(i, " ")
	}
	fmt.Println()

	// Duyệt chuỗi: i là vị trí BYTE, r là ký tự (rune)
	for i, r := range "Gò" {
		fmt.Printf("byte %d: %c\n", i, r)
	}

	// Duyệt map (thứ tự NGẪU NHIÊN mỗi lần chạy!)
	ages := map[string]int{"An": 20}
	for name, age := range ages {
		fmt.Println(name, "->", age)
	}
}

// Output:
// 0: Táo
// 1: Cam
// 2: Xoài
// Táo Cam Xoài
// 0 1 2
// byte 0: G
// byte 1: ò
// An -> 20
```

### ⚠️ `range` tạo BẢN SAO của giá trị

```go
package main

import "fmt"

func main() {
	nums := []int{1, 2, 3}

	for _, n := range nums {
		n *= 10 // ❌ Chỉ thay đổi BẢN SAO, không ảnh hưởng nums
	}
	fmt.Println(nums)

	for i := range nums {
		nums[i] *= 10 // ✅ Thay đổi trực tiếp qua index
	}
	fmt.Println(nums)
}

// Output:
// [1 2 3]
// [10 20 30]
```

### Bảng tổng hợp các dạng `for`

| Dạng | Cú pháp | Tương đương |
|------|---------|-------------|
| Cổ điển | `for i := 0; i < n; i++ { }` | `for` của C/Java |
| Range số (1.22+) | `for i := range n { }` | `for i in range(n)` của Python |
| While | `for cond { }` | `while (cond)` |
| Vô hạn | `for { }` | `while (true)` |
| Range | `for i, v := range items { }` | `foreach` (C#), `for...of` (JS) |

## 📖 3. `break`, `continue` và Label

### `break` và `continue`

```go
package main

import "fmt"

func main() {
	// continue: bỏ qua phần còn lại của vòng hiện tại, sang vòng tiếp theo
	fmt.Print("Số lẻ: ")
	for i := 1; i <= 10; i++ {
		if i%2 == 0 {
			continue // Bỏ qua số chẵn
		}
		fmt.Print(i, " ")
	}
	fmt.Println()

	// break: thoát hẳn khỏi vòng lặp
	numbers := []int{4, 8, 15, 16, 23, 42}
	for _, n := range numbers {
		if n > 20 {
			fmt.Println("Số đầu tiên > 20 là:", n)
			break
		}
	}
}

// Output:
// Số lẻ: 1 3 5 7 9
// Số đầu tiên > 20 là: 23
```

### Label - Thoát khỏi vòng lặp lồng nhau

Vấn đề: `break` chỉ thoát khỏi vòng lặp **gần nhất**. Nếu có 2 vòng lồng nhau thì sao?

```go
package main

import "fmt"

func main() {
	matrix := [][]int{
		{1, 2, 3},
		{4, 5, 6},
		{7, 8, 9},
	}
	target := 5

outer: // Đặt nhãn cho vòng lặp ngoài
	for i, row := range matrix {
		for j, val := range row {
			if val == target {
				fmt.Printf("Tìm thấy %d tại [%d][%d]\n", target, i, j)
				break outer // Thoát khỏi CẢ HAI vòng lặp
			}
		}
	}

	// continue với label: bỏ qua phần còn lại của vòng NGOÀI
	fmt.Println("Các hàng không chứa số chẵn > 7:")
rows:
	for i, row := range matrix {
		for _, val := range row {
			if val%2 == 0 && val > 7 {
				continue rows // Chuyển sang hàng tiếp theo
			}
		}
		fmt.Println("Hàng", i)
	}
}

// Output:
// Tìm thấy 5 tại [1][1]
// Các hàng không chứa số chẵn > 7:
// Hàng 0
// Hàng 1
```

> 💡 Label là một cái tên + dấu `:`, đặt ngay trước vòng lặp. Quy ước đặt tên bằng chữ thường như `outer`, `loop`, `rows`. Đừng lạm dụng - nếu lồng quá sâu, hãy tách thành hàm riêng và dùng `return`.

## 📖 4. Câu lệnh `switch`

### `switch` cơ bản

```go
package main

import "fmt"

func main() {
	day := 3

	switch day {
	case 1:
		fmt.Println("Thứ Hai")
	case 2:
		fmt.Println("Thứ Ba")
	case 3:
		fmt.Println("Thứ Tư")
	case 6, 7: // Nhiều giá trị trong một case
		fmt.Println("Cuối tuần")
	default:
		fmt.Println("Ngày khác")
	}
}

// Output:
// Thứ Tư
```

### ⭐ Không cần `break` - Go tự dừng sau mỗi case!

Trong C/Java/JavaScript, quên `break` là bug kinh điển:

```javascript
// JavaScript - quên break
switch (day) {
  case 3:
    console.log("Thứ Tư");
    // quên break → chạy tiếp xuống case 4! 🐛
  case 4:
    console.log("Thứ Năm");
}
```

Go **tự động dừng** sau mỗi case (không "rơi" xuống case tiếp theo). Nếu thực sự muốn chạy tiếp, dùng `fallthrough` tường minh:

```go
package main

import "fmt"

func main() {
	level := 2
	fmt.Println("Quyền của level", level, ":")
	switch level {
	case 3:
		fmt.Println("- Xóa dữ liệu")
		fallthrough
	case 2:
		fmt.Println("- Sửa dữ liệu")
		fallthrough
	case 1:
		fmt.Println("- Xem dữ liệu")
	}
}

// Output:
// Quyền của level 2 :
// - Sửa dữ liệu
// - Xem dữ liệu
```

> ⚠️ `fallthrough` chạy case kế tiếp **vô điều kiện** (không kiểm tra giá trị case đó). Trong thực tế rất hiếm khi dùng - thường gộp giá trị bằng dấu phẩy `case 1, 2:` là đủ.

### `switch` với câu lệnh khởi tạo

```go
package main

import (
	"fmt"
	"runtime"
)

func main() {
	switch os := runtime.GOOS; os {
	case "windows":
		fmt.Println("Bạn dùng Windows 🪟")
	case "darwin":
		fmt.Println("Bạn dùng macOS 🍎")
	case "linux":
		fmt.Println("Bạn dùng Linux 🐧")
	default:
		fmt.Println("Hệ điều hành:", os)
	}
}

// Output (trên Linux):
// Bạn dùng Linux 🐧
```

### ⭐ `switch` không có biểu thức (tagless switch)

Khi bỏ trống biểu thức sau `switch`, mỗi `case` là **một điều kiện bool**. Đây là cách **thay thế chuỗi if-else dài** rất gọn gàng:

```go
package main

import "fmt"

func classify(score float64) string {
	switch { // Tương đương switch true
	case score < 0 || score > 10:
		return "Điểm không hợp lệ"
	case score >= 9:
		return "Xuất sắc"
	case score >= 8:
		return "Giỏi"
	case score >= 6.5:
		return "Khá"
	case score >= 5:
		return "Trung bình"
	default:
		return "Yếu"
	}
}

func main() {
	for _, s := range []float64{9.5, 8.0, 7.2, 5.5, 3.0, 11} {
		fmt.Printf("%.1f → %s\n", s, classify(s))
	}
}

// Output:
// 9.5 → Xuất sắc
// 8.0 → Giỏi
// 7.2 → Khá
// 5.5 → Trung bình
// 3.0 → Yếu
// 11.0 → Điểm không hợp lệ
```

Các case được kiểm tra **từ trên xuống**, case **đầu tiên** đúng sẽ được chạy.

### `switch` với chuỗi và nhiều kiểu giá trị

```go
func httpMethodAction(method string) string {
	switch method {
	case "GET":
		return "Đọc dữ liệu"
	case "POST":
		return "Tạo mới"
	case "PUT", "PATCH":
		return "Cập nhật"
	case "DELETE":
		return "Xóa"
	default:
		return "Không hỗ trợ"
	}
}
```

> 💡 Còn một loại `switch` nữa là **type switch** (`switch v := x.(type)`) dùng để kiểm tra kiểu của interface - bạn sẽ học ở [Bài 6](./06-structs-methods-interfaces.md).

### `break` bên trong `switch` nằm trong `for`

⚠️ **Cẩn thận**: `break` trong `switch` chỉ thoát khỏi `switch`, **không** thoát khỏi `for`!

```go
package main

import "fmt"

func main() {
	commands := []string{"run", "jump", "quit", "run"}

loop:
	for _, cmd := range commands {
		switch cmd {
		case "quit":
			fmt.Println("Thoát!")
			break loop // ✅ Cần label để thoát khỏi for
		default:
			fmt.Println("Thực hiện:", cmd)
		}
	}
}

// Output:
// Thực hiện: run
// Thực hiện: jump
// Thoát!
```

Nếu chỉ viết `break` (không có `loop`), chương trình sẽ in "Thoát!" rồi **tiếp tục** với "run" - một bug rất khó phát hiện!

## 📖 5. `defer` - "Hẹn làm sau" (cơ bản)

`defer` hoãn việc thực thi một lời gọi hàm cho đến khi **hàm bao quanh kết thúc** (return hoặc panic).

> 💡 **Ví von**: `defer` giống như tờ giấy nhớ bạn dán lên cửa: "Khi ra về nhớ tắt đèn". Dù bạn ra về lúc nào, bằng cửa nào, bạn cũng sẽ thấy tờ giấy và tắt đèn.

```go
package main

import "fmt"

func main() {
	fmt.Println("Bắt đầu")
	defer fmt.Println("Dọn dẹp (chạy cuối cùng)")
	fmt.Println("Đang làm việc...")
}

// Output:
// Bắt đầu
// Đang làm việc...
// Dọn dẹp (chạy cuối cùng)
```

### Tại sao cần `defer`?

Dùng để **dọn dẹp tài nguyên**: đóng file, đóng kết nối database, mở khóa mutex... Viết lệnh dọn dẹp **ngay cạnh** lệnh mở giúp bạn **không bao giờ quên**:

```go
// Kiểu trả về error và cách xử lý lỗi sẽ học kỹ ở Bài 7
func readConfig(path string) error {
	file, err := os.Open(path) // Mở file (package os)
	if err != nil {
		return err
	}
	defer file.Close() // ✅ Viết ngay sau khi mở thành công - chắc chắn sẽ đóng

	// ... 50 dòng code xử lý, có nhiều chỗ return ...
	// Dù return ở đâu, file.Close() vẫn được gọi
	return nil
}
```

So sánh với `try...finally` trong Java/C#/Python: `defer` đạt cùng mục đích nhưng gọn hơn và đặt ngay cạnh chỗ mở tài nguyên.

### Nhiều `defer` chạy theo thứ tự ngược (LIFO)

```go
package main

import "fmt"

func main() {
	for i := 1; i <= 3; i++ {
		defer fmt.Println("defer", i)
	}
	fmt.Println("Kết thúc main")
}

// Output:
// Kết thúc main
// defer 3
// defer 2
// defer 1
```

**LIFO** = Last In, First Out, như **chồng đĩa**: đĩa đặt lên sau cùng được lấy ra trước. Điều này hợp lý: tài nguyên mở sau thường phụ thuộc vào tài nguyên mở trước, nên phải đóng trước.

### Tham số của `defer` được tính NGAY LẬP TỨC

```go
package main

import "fmt"

func main() {
	x := 10
	defer fmt.Println("Giá trị lúc defer:", x) // x = 10 được "chụp" ngay lúc này
	x = 20
	fmt.Println("Giá trị hiện tại:", x)
}

// Output:
// Giá trị hiện tại: 20
// Giá trị lúc defer: 10
```

> 💡 Chi tiết hơn về `defer` (kết hợp với closure, named return, `recover`) ở [Bài 4](./04-functions.md) và [Bài 7](./07-error-handling.md).

## 📖 6. Ví dụ tổng hợp: Trò chơi FizzBuzz và số nguyên tố

```go
package main

import "fmt"

func main() {
	// FizzBuzz: bài phỏng vấn kinh điển
	fmt.Println("=== FizzBuzz 1-15 ===")
	for i := 1; i <= 15; i++ {
		switch {
		case i%15 == 0:
			fmt.Print("FizzBuzz ")
		case i%3 == 0:
			fmt.Print("Fizz ")
		case i%5 == 0:
			fmt.Print("Buzz ")
		default:
			fmt.Print(i, " ")
		}
	}
	fmt.Println()

	// Liệt kê số nguyên tố nhỏ hơn 30
	fmt.Println("=== Số nguyên tố < 30 ===")
next:
	for n := 2; n < 30; n++ {
		for d := 2; d*d <= n; d++ {
			if n%d == 0 {
				continue next // n không phải số nguyên tố, xét số tiếp theo
			}
		}
		fmt.Print(n, " ")
	}
	fmt.Println()
}

// Output:
// === FizzBuzz 1-15 ===
// 1 2 Fizz 4 Buzz Fizz 7 8 Fizz Buzz 11 Fizz 13 14 FizzBuzz
// === Số nguyên tố < 30 ===
// 2 3 5 7 11 13 17 19 23 29
```

### Ví dụ: Máy ATM đơn giản

```go
package main

import "fmt"

func main() {
	balance := 1_000_000
	actions := []string{"check", "withdraw", "withdraw", "deposit", "unknown", "exit", "check"}
	amounts := []int{0, 300_000, 900_000, 500_000, 0, 0, 0}

	for i, action := range actions {
		if action == "exit" {
			fmt.Println("👋 Cảm ơn quý khách!")
			break
		}

		switch amount := amounts[i]; action {
		case "check":
			fmt.Printf("💰 Số dư: %d đ\n", balance)
		case "withdraw":
			if amount > balance {
				fmt.Printf("❌ Không đủ tiền để rút %d đ\n", amount)
				continue
			}
			balance -= amount
			fmt.Printf("✅ Đã rút %d đ, còn %d đ\n", amount, balance)
		case "deposit":
			balance += amount
			fmt.Printf("✅ Đã nạp %d đ, còn %d đ\n", amount, balance)
		default:
			fmt.Println("⚠️ Lệnh không hợp lệ:", action)
		}
	}
}

// Output:
// 💰 Số dư: 1000000 đ
// ✅ Đã rút 300000 đ, còn 700000 đ
// ❌ Không đủ tiền để rút 900000 đ
// ✅ Đã nạp 500000 đ, còn 1200000 đ
// ⚠️ Lệnh không hợp lệ: unknown
// 👋 Cảm ơn quý khách!
```

## 🌍 Ứng dụng thực tế

`if`, `for`, `switch` là nơi **quy tắc nghiệp vụ** (business rules) được viết ra: tính phí, xếp loại, duyệt/từ chối... Hai ví dụ dưới đây mô phỏng những đoạn code có thật trong app giao hàng và phần mềm quản lý trường học.

### Ví dụ 1: Tính phí ship theo vùng, cân nặng và khuyến mãi

Quy tắc: phí cơ bản theo vùng (đã gồm 1kg đầu), mỗi 500g vượt thêm cộng 5.000 đ, đơn nội thành từ 500.000 đ được miễn phí ship, vùng chưa hỗ trợ thì bỏ qua. Ví dụ cũng có hàm `formatVND` **tổng quát** dùng vòng lặp (nâng cấp từ bản đơn giản ở Bài 2):

```go
package main

import (
	"fmt"
	"strconv"
)

const freeShipThreshold = 500_000 // Đơn từ 500.000 đ được miễn phí ship nội thành

// formatVND - phiên bản TỔNG QUÁT dùng vòng lặp: 1250000 → "1.250.000 đ"
func formatVND(amount int) string {
	s := strconv.Itoa(amount)
	result := ""
	for i, ch := range s {
		// Chèn dấu chấm trước mỗi nhóm 3 chữ số tính từ bên phải
		if i > 0 && (len(s)-i)%3 == 0 {
			result += "."
		}
		result += string(ch)
	}
	return result + " đ"
}

func main() {
	// Mỗi vị trí i là một đơn hàng: vùng giao, cân nặng (gram), giá trị đơn
	regions := []string{"noi-thanh", "noi-thanh", "ngoai-thanh", "lien-tinh", "lien-tinh", "dao"}
	weights := []int{800, 1200, 2500, 400, 3200, 1000}
	orderValues := []int{650_000, 120_000, 300_000, 90_000, 1_250_000, 200_000}

	totalShip := 0
	for i, region := range regions {
		weight, value := weights[i], orderValues[i]

		// 1. Phí cơ bản theo vùng (bao gồm 1kg đầu tiên)
		var baseFee int
		switch region {
		case "noi-thanh":
			baseFee = 15_000
		case "ngoai-thanh":
			baseFee = 25_000
		case "lien-tinh":
			baseFee = 35_000
		default:
			fmt.Printf("Đơn %d: ❌ chưa hỗ trợ giao tới vùng %q\n", i+1, region)
			continue // Bỏ qua đơn này, xét đơn tiếp theo
		}

		// 2. Phụ phí 5.000 đ cho mỗi 500g vượt quá 1kg (làm tròn lên)
		extraFee := 0
		if weight > 1000 {
			extraSteps := (weight - 1000 + 499) / 500 // Chia làm tròn lên
			extraFee = extraSteps * 5_000
		}
		fee := baseFee + extraFee

		// 3. Miễn phí ship nội thành cho đơn lớn
		note := ""
		if region == "noi-thanh" && value >= freeShipThreshold {
			fee, note = 0, " (miễn phí ship 🎉)"
		}

		totalShip += fee
		fmt.Printf("Đơn %d: %-11s %5dg  giá trị %13s → ship %s%s\n",
			i+1, region, weight, formatVND(value), formatVND(fee), note)
	}
	fmt.Println("Tổng phí ship:", formatVND(totalShip))
}

// Output:
// Đơn 1: noi-thanh     800g  giá trị     650.000 đ → ship 0 đ (miễn phí ship 🎉)
// Đơn 2: noi-thanh    1200g  giá trị     120.000 đ → ship 20.000 đ
// Đơn 3: ngoai-thanh  2500g  giá trị     300.000 đ → ship 40.000 đ
// Đơn 4: lien-tinh     400g  giá trị      90.000 đ → ship 35.000 đ
// Đơn 5: lien-tinh    3200g  giá trị   1.250.000 đ → ship 60.000 đ
// Đơn 6: ❌ chưa hỗ trợ giao tới vùng "dao"
// Tổng phí ship: 155.000 đ
```

> 💡 **Chia làm tròn lên** với số nguyên: `(a + b - 1) / b`. Ở đây `(weight - 1000 + 499) / 500` nghĩa là "vượt 1g cũng tính thêm một nấc 500g" - đúng cách các hãng vận chuyển tính cước.

### Ví dụ 2: Xếp loại học lực theo nhiều điều kiện

Trong thực tế, xếp loại không chỉ dựa vào điểm trung bình mà còn yêu cầu **không có môn nào quá thấp**. Tagless `switch` giúp viết các điều kiện phức hợp này rất gọn:

```go
package main

import "fmt"

func main() {
	// Bảng điểm học kỳ: môn, hệ số, điểm (Toán và Văn tính hệ số 2)
	subjects := []string{"Toán", "Văn", "Anh", "Lý", "Hóa", "Sử"}
	weights := []int{2, 2, 1, 1, 1, 1}

	students := []string{"An", "Bình", "Chi", "Dũng"}
	scores := [][]float64{ // Mỗi dòng là điểm của một học sinh (slice lồng nhau: Bài 5)
		{9.0, 8.5, 8.0, 8.5, 9.0, 7.0},
		{9.5, 9.0, 9.0, 9.5, 9.0, 6.0}, // Rất giỏi nhưng Sử chỉ 6.0
		{7.0, 6.5, 5.5, 6.0, 7.5, 6.5},
		{4.0, 5.0, 3.0, 5.5, 4.5, 5.0},
	}

	for i, name := range students {
		total, totalWeight := 0.0, 0
		lowest := 10.0
		weakest := ""

		// Tính điểm trung bình có hệ số và tìm môn thấp nhất
		for j, score := range scores[i] {
			total += score * float64(weights[j])
			totalWeight += weights[j]
			if score < lowest {
				lowest, weakest = score, subjects[j]
			}
		}
		avg := total / float64(totalWeight)

		// Xếp loại: phải đạt CẢ điểm trung bình VÀ điểm môn thấp nhất
		var rank string
		switch {
		case avg >= 8.0 && lowest >= 6.5:
			rank = "Giỏi"
		case avg >= 6.5 && lowest >= 5.0:
			rank = "Khá"
		case avg >= 5.0 && lowest >= 3.5:
			rank = "Trung bình"
		default:
			rank = "Yếu"
		}

		fmt.Printf("%-5s ĐTB %.2f | thấp nhất %-3s %.1f → %s\n", name, avg, weakest, lowest, rank)

		// Gợi ý cho học sinh "hụt" loại Giỏi chỉ vì một môn
		if avg >= 8.0 && rank != "Giỏi" {
			fmt.Printf("      💡 Cần nâng %s lên 6.5 để đạt loại Giỏi\n", weakest)
		}
	}
}

// Output:
// An    ĐTB 8.44 | thấp nhất Sử  7.0 → Giỏi
// Bình  ĐTB 8.81 | thấp nhất Sử  6.0 → Khá
//       💡 Cần nâng Sử lên 6.5 để đạt loại Giỏi
// Chi   ĐTB 6.56 | thấp nhất Anh 5.5 → Khá
// Dũng  ĐTB 4.50 | thấp nhất Anh 3.0 → Yếu
```

> 💡 Thứ tự các `case` rất quan trọng: `switch` dừng ở case **đầu tiên** đúng, nên phải xét từ loại cao xuống thấp. Bình có ĐTB 8.81 nhưng rơi xuống "Khá" vì môn Sử - đây chính là kiểu logic mà nếu viết bằng if-else lồng nhau sẽ rất dễ sai.

## ⚠️ Lỗi thường gặp

### Lỗi 1: Đặt `else` xuống dòng mới

```go
if x > 0 {
	fmt.Println("dương")
}
else { // ❌ syntax error: unexpected keyword else, expected }
	fmt.Println("âm")
}
```

✅ Viết `} else {` trên cùng một dòng.

### Lỗi 2: Dùng giá trị không phải bool làm điều kiện

```go
items := 3
if items { }        // ❌ non-boolean condition in if statement
if items > 0 { }    // ✅
```

### Lỗi 3: Dùng biến từ init statement bên ngoài `if`

```go
if n, err := strconv.Atoi("5"); err == nil {
	fmt.Println(n)
}
fmt.Println(n) // ❌ undefined: n
```

✅ Nếu cần dùng sau `if`, hãy khai báo trước:

```go
n, err := strconv.Atoi("5")
if err != nil {
	return
}
fmt.Println(n)
```

### Lỗi 4: `break` trong `switch` không thoát khỏi `for`

Xem lại mục 4 - dùng **label** (`break loop`) hoặc `return`.

### Lỗi 5: Sửa phần tử qua biến `range` (chỉ là bản sao)

```go
for _, n := range nums {
	n = n * 2 // ❌ Không thay đổi nums
}
for i := range nums {
	nums[i] *= 2 // ✅
}
```

### Lỗi 6: Vòng lặp vô hạn ngoài ý muốn

```go
i := 0
for i < 5 {
	fmt.Println(i)
	// ❌ Quên i++ → lặp mãi mãi!
}
```

✅ Nhấn `Ctrl+C` để dừng chương trình, rồi thêm `i++`.

### Lỗi 7: Dùng `defer` trong vòng lặp để đóng file

```go
for _, path := range paths {
	f, _ := os.Open(path)
	defer f.Close() // ⚠️ Tất cả file chỉ được đóng khi HÀM kết thúc, không phải mỗi vòng lặp!
}
```

Nếu có 10.000 file, bạn sẽ mở 10.000 file cùng lúc → hết tài nguyên. ✅ Tách phần thân vòng lặp thành một hàm riêng, `defer` bên trong hàm đó.

### Lỗi 8: Tưởng rằng `range` trên map có thứ tự

```go
m := map[string]int{"a": 1, "b": 2, "c": 3}
for k := range m {
	fmt.Print(k) // Có thể ra "abc", "bca", "cab"... mỗi lần chạy khác nhau!
}
```

✅ Nếu cần thứ tự, lấy danh sách key ra rồi sắp xếp (xem [Bài 5](./05-arrays-slices-maps.md)).

## 🏋️ Bài tập

### Bài tập 1: Xếp loại học lực

Viết hàm `grade(score float64) string` dùng **tagless switch** trả về: "A" (≥ 8.5), "B" (≥ 7), "C" (≥ 5.5), "D" (≥ 4), "F" (< 4). Trả về "Không hợp lệ" nếu điểm ngoài khoảng 0-10. Test với ít nhất 6 giá trị.

### Bài tập 2: Bảng cửu chương

In bảng cửu chương từ 2 đến 9 bằng 2 vòng `for` lồng nhau, căn chỉnh đẹp với `Printf("%2d x %2d = %2d")`.

**Nâng cao**: Chỉ in các phép nhân có kết quả là số chẵn, dùng `continue`.

### Bài tập 3: Đoán số (mô phỏng)

Cho `secret := 42` và một danh sách các lần đoán `guesses := []int{50, 25, 37, 43, 42, 10}`. Duyệt danh sách, với mỗi lần đoán in ra "Lớn quá", "Nhỏ quá" hoặc "Chính xác sau N lần!" rồi dừng lại ngay (các lần đoán sau không được xét).

### Bài tập 4: Tìm cặp số

Cho `nums := []int{2, 7, 11, 15, 3, 6}` và `target := 9`. Dùng 2 vòng lặp lồng nhau và **label** để tìm **cặp số đầu tiên** có tổng bằng `target`, in ra chỉ số của chúng rồi thoát cả hai vòng lặp.

### Bài tập 5: Đếm ngược với defer

Viết chương trình dùng vòng `for` và `defer` để in ra:

```text
Chuẩn bị phóng tên lửa...
3
2
1
🚀 Phóng!
```

**Gợi ý**: `defer` chạy theo thứ tự LIFO. Nghĩ xem nên `defer` những gì và theo thứ tự nào.

### Bài tập 6: Số hoàn hảo

Số hoàn hảo là số bằng tổng các ước số của nó (không kể chính nó), ví dụ 6 = 1 + 2 + 3. Tìm tất cả số hoàn hảo nhỏ hơn 10.000.

**Kết quả mong đợi**: `6 28 496 8128`

## ✅ Checklist hoàn thành

- [ ] Viết `if/else if/else` đúng cú pháp Go (không ngoặc tròn, `} else {` cùng dòng)
- [ ] Sử dụng `if` với init statement (`if v, err := f(); err != nil`)
- [ ] Áp dụng phong cách "return sớm" thay vì lồng if sâu
- [ ] Viết được cả 4 dạng `for`: cổ điển, while, vô hạn, range
- [ ] Biết `for i := range 10` (Go 1.22+)
- [ ] Hiểu biến trong `range` là bản sao
- [ ] Dùng `break`, `continue` và label cho vòng lặp lồng nhau
- [ ] Hiểu `switch` không cần `break` và biết `fallthrough`
- [ ] Dùng tagless `switch` thay cho chuỗi if-else dài
- [ ] Biết `break` trong `switch` không thoát `for`
- [ ] Hiểu `defer` chạy khi hàm kết thúc, theo thứ tự LIFO
- [ ] Viết được quy tắc nghiệp vụ thực tế: phí ship theo vùng/cân nặng, xếp loại học lực nhiều điều kiện
- [ ] Hoàn thành ít nhất 4 bài tập

## 🚀 Tiếp theo

Bạn đã biết cách điều khiển luồng chương trình! Tiếp theo là **hàm** - viên gạch cơ bản để tổ chức code:

- Hàm trả về nhiều giá trị
- Variadic function
- Hàm là "công dân hạng nhất" (first-class citizen)
- Closure và đệ quy

**Bài tiếp theo**: [Hàm (Functions)](./04-functions.md)

---

💡 **Tips ghi nhớ**:

- **Go chỉ có `for`** - nhưng `for` làm được mọi loại vòng lặp
- **`switch` không cần `break`** - an toàn hơn C/Java
- **Tagless switch** là cách viết if-else dài đẹp nhất
- **`if v, err := ...; err != nil`** - mẫu code bạn sẽ gõ hàng nghìn lần
- **`defer` ngay sau khi mở tài nguyên** - không bao giờ quên dọn dẹp
