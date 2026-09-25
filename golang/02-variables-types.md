# 📚 Bài 2: Biến và Kiểu dữ liệu

## 🎯 Mục tiêu bài học

- Khai báo biến bằng `var` và `:=`, biết khi nào dùng cách nào
- Hiểu khái niệm **zero value** - "giá trị mặc định" của Go
- Nắm vững các kiểu dữ liệu cơ bản: `int`, `float64`, `string`, `bool`, `rune`, `byte`
- Sử dụng hằng số `const` và bộ đếm `iota`
- Chuyển đổi kiểu dữ liệu (type conversion) một cách an toàn
- Sử dụng các toán tử số học, so sánh, logic
- Định dạng output với `fmt.Printf` và các "verb" (`%v`, `%d`, `%s`, `%T`...)
- Xử lý chuỗi cơ bản với package `strings`
- Chuyển đổi giữa chuỗi và số với package `strconv`

## 📖 1. Biến là gì?

Hãy tưởng tượng **biến** như một **chiếc hộp có dán nhãn**:

- **Tên biến** là nhãn dán trên hộp (`age`, `name`)
- **Kiểu dữ liệu** quy định hộp đựng được thứ gì (hộp đựng số, hộp đựng chữ...)
- **Giá trị** là thứ đang nằm trong hộp

Trong Go, **mỗi chiếc hộp chỉ đựng được một loại đồ duy nhất**. Hộp đựng số (`int`) không thể bỏ chữ vào. Đây gọi là **static typing** (kiểu tĩnh) - khác với Python/JavaScript nơi một biến có thể lúc là số, lúc là chuỗi.

## 📖 2. Khai báo biến

### Cách 1: `var` với kiểu dữ liệu tường minh

```go
var age int = 25            // Khai báo biến age kiểu int, giá trị 25
var name string = "Minh"    // Biến name kiểu string
var isStudent bool = true   // Biến isStudent kiểu bool
```

Cú pháp: `var <tên> <kiểu> = <giá trị>`

> 💡 **Để ý**: Go đặt **kiểu sau tên biến** (`age int`), ngược với C/Java (`int age`). Lý do: đọc từ trái sang phải tự nhiên hơn - "biến age có kiểu int".

### Cách 2: `var` và để Go tự suy luận kiểu (type inference)

```go
var age = 25          // Go tự hiểu age là int
var name = "Minh"     // Go tự hiểu name là string
var price = 99.5      // Go tự hiểu price là float64
```

### Cách 3: Khai báo ngắn `:=` (dùng nhiều nhất!)

```go
age := 25             // Tương đương: var age = 25
name := "Minh"
price := 99.5
```

`:=` là cách **ngắn gọn nhất**, nghĩa là "khai báo biến mới VÀ gán giá trị". Bạn sẽ thấy nó ở khắp mọi nơi trong code Go.

⚠️ **Nhưng** `:=` **chỉ dùng được bên trong hàm**:

```go
package main

// x := 10        // ❌ Lỗi: syntax error: non-declaration statement outside function body
var x = 10 // ✅ Ở cấp package phải dùng var

func main() {
	y := 20 // ✅ Trong hàm dùng := thoải mái
	_ = y
}
```

### Cách 4: Khai báo không gán giá trị

```go
var count int     // count = 0 (zero value)
var message string // message = "" (chuỗi rỗng)
```

### Khai báo nhiều biến cùng lúc

```go
// Nhiều biến cùng kiểu
var a, b, c int = 1, 2, 3

// Nhiều biến khác kiểu với :=
name, age, height := "Lan", 22, 1.65

// Khối var (thường dùng ở cấp package)
var (
	appName    = "Todo App"
	version    = "1.0.0"
	maxUsers   = 100
	debugMode  bool // zero value: false
)
```

### Gán lại giá trị với `=`

```go
score := 10    // Khai báo mới dùng :=
score = 20     // Gán lại dùng = (KHÔNG phải :=)
score += 5     // score = 25

// score := 30 // ❌ Lỗi: no new variables on left side of :=
```

**Quy tắc vàng**: `:=` để **tạo mới**, `=` để **thay đổi**.

> 💡 **Trường hợp đặc biệt**: `:=` vẫn dùng được nếu **ít nhất một biến bên trái là mới**:
>
> ```go
> a, b := 1, 2
> b, c := 3, 4   // ✅ OK vì c là biến mới; b chỉ được gán lại
> ```
>
> Điều này rất hay gặp khi làm việc với `err`: `x, err := f1()` rồi `y, err := f2()`.

### Hoán đổi giá trị (swap)

```go
a, b := 1, 2
a, b = b, a        // Hoán đổi không cần biến tạm!
fmt.Println(a, b)  // Output: 2 1
```

### Khi nào dùng `var`, khi nào dùng `:=`?

| Tình huống | Nên dùng | Ví dụ |
|-----------|----------|-------|
| Trong hàm, có giá trị ban đầu | `:=` | `total := 0` |
| Ở cấp package | `var` | `var db *Database` |
| Muốn zero value, chưa có giá trị | `var` | `var result []string` |
| Muốn kiểu khác kiểu mặc định | `var` | `var ratio float32 = 0.5` |

### 💡 Tips quan trọng

- **Tên biến** dùng **camelCase**: `userName`, `totalPrice` ✅, `user_name` ❌ (không phải phong cách Go)
- **Tên ngắn** cho phạm vi nhỏ: `i`, `n`, `err` ✅. **Tên rõ nghĩa** cho phạm vi lớn: `customerCount` ✅
- Chữ viết tắt giữ nguyên hoa/thường: `userID`, `httpURL`, `apiKey` ✅, `userId`, `HttpUrl` ❌
- Biến khai báo mà **không dùng** → **lỗi biên dịch** (xem Bài 1)

## 📖 3. Zero Value - Giá trị mặc định

Trong nhiều ngôn ngữ, biến chưa gán giá trị là "rác" (C) hoặc `undefined`/`null` (JavaScript/Java). Trong Go, **mọi biến luôn có giá trị hợp lệ ngay từ khi sinh ra** - gọi là **zero value**.

```go
package main

import "fmt"

func main() {
	var i int
	var f float64
	var s string
	var b bool
	var p *int // con trỏ (Bài 6)

	fmt.Printf("int: %v\n", i)
	fmt.Printf("float64: %v\n", f)
	fmt.Printf("string: %q\n", s) // %q in chuỗi trong dấu ngoặc kép để thấy chuỗi rỗng
	fmt.Printf("bool: %v\n", b)
	fmt.Printf("pointer: %v\n", p)
}

// Output:
// int: 0
// float64: 0
// string: ""
// bool: false
// pointer: <nil>
```

| Kiểu | Zero value |
|------|-----------|
| Số (`int`, `float64`, ...) | `0` |
| `string` | `""` (chuỗi rỗng) |
| `bool` | `false` |
| Con trỏ, slice, map, channel, function, interface | `nil` |
| Struct | Mỗi field mang zero value của nó |

**Tại sao zero value hữu ích?** Nó giúp code ngắn gọn và an toàn:

```go
var total int // Không cần viết total := 0
for _, price := range []int{100, 200, 300} {
	total += price
}
fmt.Println(total) // Output: 600
```

## 📖 4. Các kiểu dữ liệu cơ bản

### 🔢 Số nguyên (Integer)

```go
var a int = 42        // Kiểu số nguyên "mặc định", 64 bit trên máy 64 bit
var b int8 = 127      // 8 bit: -128 đến 127
var c int16 = 32000   // 16 bit: -32768 đến 32767
var d int32 = 2e9     // 32 bit: khoảng ±2.1 tỷ
var e int64 = 9e18    // 64 bit: khoảng ±9.2 tỷ tỷ

var u uint = 42       // Số không âm (unsigned)
var u8 uint8 = 255    // 0 đến 255
```

| Kiểu | Kích thước | Phạm vi |
|------|-----------|---------|
| `int8` | 1 byte | -128 → 127 |
| `int16` | 2 byte | -32 768 → 32 767 |
| `int32` | 4 byte | ≈ -2.1 tỷ → 2.1 tỷ |
| `int64` | 8 byte | ≈ -9.2×10¹⁸ → 9.2×10¹⁸ |
| `int` | 4 hoặc 8 byte (theo máy) | Thường là 64 bit ngày nay |
| `uint8`...`uint64`, `uint` | như trên | Chỉ số ≥ 0, gấp đôi phạm vi dương |

✅ **Quy tắc thực tế**: **Cứ dùng `int`** trừ khi có lý do đặc biệt (làm việc với file nhị phân, giao thức mạng, tiết kiệm bộ nhớ cho mảng cực lớn).

**Tràn số (overflow)** - Go không báo lỗi khi chạy mà "quay vòng":

```go
var small int8 = 127
small++
fmt.Println(small) // Output: -128 (quay vòng!)
```

Cách viết số cho dễ đọc:

```go
population := 100_000_000 // Dấu _ giúp dễ đọc, Go bỏ qua nó
hex := 0xFF               // Hệ 16: 255
binary := 0b1010          // Hệ 2: 10
octal := 0o17             // Hệ 8: 15
```

### 🔢 Số thực (Floating point)

```go
var f32 float32 = 3.14      // Độ chính xác ~7 chữ số
var f64 float64 = 3.14159265 // Độ chính xác ~15 chữ số (MẶC ĐỊNH)

price := 19.99 // Go tự hiểu là float64
```

✅ **Luôn dùng `float64`** trừ khi có lý do đặc biệt. (Khác Unity/C# nơi `float` là phổ biến - trong Go, `float64` là mặc định và thư viện `math` đều dùng `float64`.)

⚠️ **Cẩn thận sai số số thực** (xảy ra ở MỌI ngôn ngữ, không riêng Go):

```go
fmt.Println(0.1 + 0.2)          // Output: 0.30000000000000004
fmt.Println(0.1+0.2 == 0.3)     // Output: false 😱
```

> 💡 Vì sao? Máy tính lưu số thực ở hệ nhị phân, mà 0.1 trong hệ nhị phân là số vô hạn tuần hoàn (giống 1/3 = 0.333... trong hệ thập phân). **Đừng dùng float cho tiền tệ!** Hãy lưu tiền bằng `int` theo đơn vị nhỏ nhất (đồng, cent).

### 🔤 Chuỗi (String)

```go
greeting := "Xin chào"        // Dấu ngoặc kép: chuỗi thông thường
path := `C:\Users\minh\go`    // Dấu backtick: raw string, KHÔNG xử lý ký tự đặc biệt
multiline := `Dòng 1
Dòng 2
Dòng 3`                        // Raw string có thể viết nhiều dòng

escaped := "Tab:\tXuống dòng:\nNgoặc kép: \"" // Ký tự escape trong chuỗi thường
```

Đặc điểm quan trọng của string trong Go:

- **Bất biến (immutable)**: Không thể thay đổi một ký tự trong chuỗi, chỉ có thể tạo chuỗi mới
- **Là dãy byte mã hóa UTF-8**: Hỗ trợ tiếng Việt, emoji tự nhiên
- **`len(s)` trả về số BYTE, không phải số ký tự!**

```go
s := "Go"
fmt.Println(len(s)) // Output: 2

v := "Việt"
fmt.Println(len(v)) // Output: 6 (chữ "ệ" chiếm 3 byte trong UTF-8!)

// Đếm số ký tự thật sự:
fmt.Println(utf8.RuneCountInString(v)) // Output: 4 (cần import "unicode/utf8")
fmt.Println(len([]rune(v)))            // Output: 4
```

Nối chuỗi:

```go
first := "Nguyễn"
last := "An"
full := first + " " + last // Dùng dấu +
fmt.Println(full)          // Output: Nguyễn An

// s[0] = 'g' // ❌ Lỗi: cannot assign to s[0] (string là bất biến)
```

### ✅ Boolean

```go
isActive := true
isDeleted := false

// Go KHÔNG tự chuyển số sang bool như C/JavaScript/Python
count := 5
// if count { }      // ❌ Lỗi: non-boolean condition in if statement
if count > 0 {       // ✅ Phải so sánh rõ ràng
	fmt.Println("Có dữ liệu")
}
```

### 🔠 `byte` và `rune` - Ký tự trong Go

Go không có kiểu `char`. Thay vào đó có:

- **`byte`** = bí danh (alias) của `uint8` → đại diện **1 byte** (dùng cho ASCII, dữ liệu nhị phân)
- **`rune`** = bí danh của `int32` → đại diện **1 ký tự Unicode** (code point), dùng cho tiếng Việt, emoji...

```go
package main

import "fmt"

func main() {
	var b byte = 'A' // Dấu nháy đơn = một ký tự
	var r rune = 'ệ' // rune chứa được ký tự Unicode
	emoji := '🐹'     // Mặc định ký tự nháy đơn là rune

	fmt.Println(b, r, emoji)              // In ra giá trị SỐ
	fmt.Printf("%c %c %c\n", b, r, emoji) // %c in ra KÝ TỰ
	fmt.Printf("%T %T %T\n", b, r, emoji) // %T in ra KIỂU
	fmt.Printf("U+%04X\n", r)             // Mã Unicode của 'ệ'
}

// Output:
// 65 7879 128057
// A ệ 🐹
// uint8 int32 int32
// U+1EC7
```

> 💡 **Ví von**: Chuỗi `"Việt"` giống một **đoàn tàu 6 toa (byte)** chở **4 hành khách (rune)**. Hành khách "ệ" to quá nên chiếm tới 3 toa. `len()` đếm toa, còn `[]rune` đếm hành khách. Bạn sẽ học cách duyệt chuỗi theo rune ở [Bài 5](./05-arrays-slices-maps.md).

## 📖 5. Hằng số `const` và `iota`

### Hằng số cơ bản

**Hằng số** là giá trị **cố định lúc biên dịch**, không bao giờ thay đổi.

```go
const Pi = 3.14159
const AppName = "My App"
const MaxRetries = 3

const (
	StatusOK       = 200
	StatusNotFound = 404
)

// Pi = 3.14 // ❌ Lỗi: cannot assign to Pi (neither addressable nor a map index expression)
```

⚠️ Hằng số chỉ chứa được **giá trị biết lúc biên dịch** (số, chuỗi, bool):

```go
const now = time.Now() // ❌ Lỗi: time.Now() chỉ biết khi chạy
```

### Untyped constants - Hằng số "chưa định kiểu"

Hằng số không ghi kiểu có sức mạnh đặc biệt: nó **linh hoạt** dùng được với nhiều kiểu.

```go
const big = 100 // untyped constant

var i int = big        // ✅ OK
var f float64 = big    // ✅ OK
var u8 uint8 = big     // ✅ OK

var x int = 100
// var y float64 = x   // ❌ Biến int không tự thành float64 được
```

### `iota` - Bộ đếm tự động

`iota` là một "bộ đếm" đặc biệt trong khối `const`: bắt đầu từ **0** và **tăng 1** sau mỗi dòng. Rất hữu ích để tạo **enum** (Go không có từ khóa `enum`).

```go
package main

import "fmt"

type Weekday int

const (
	Sunday    Weekday = iota // 0
	Monday                   // 1 (tự lặp lại biểu thức "Weekday = iota")
	Tuesday                  // 2
	Wednesday                // 3
	Thursday                 // 4
	Friday                   // 5
	Saturday                 // 6
)

func main() {
	fmt.Println(Sunday, Wednesday, Saturday)
	fmt.Printf("%T\n", Monday)
}

// Output:
// 0 3 6
// main.Weekday
```

Các "mẹo" với `iota`:

```go
package main

import "fmt"

// Bắt đầu từ 1 thay vì 0
const (
	Low    = iota + 1 // 1
	Medium            // 2
	High              // 3
)

// Bỏ qua giá trị bằng _
const (
	_  = iota             // 0 - bỏ qua
	KB = 1 << (10 * iota) // 1 << 10 = 1024
	MB                    // 1 << 20 = 1048576
	GB                    // 1 << 30 = 1073741824
)

// Cờ bit (bit flags) - dùng cho quyền hạn
const (
	Read    = 1 << iota // 1  (001)
	Write               // 2  (010)
	Execute             // 4  (100)
)

func main() {
	fmt.Println(Low, Medium, High)
	fmt.Println(KB, MB, GB)

	perm := Read | Write // Kết hợp quyền bằng phép OR bit
	fmt.Println("Quyền:", perm)
	fmt.Println("Có quyền ghi?", perm&Write != 0)
	fmt.Println("Có quyền chạy?", perm&Execute != 0)
}

// Output:
// 1 2 3
// 1024 1048576 1073741824
// Quyền: 3
// Có quyền ghi? true
// Có quyền chạy? false
```

> 💡 `iota` **reset về 0** ở mỗi khối `const (...)` mới.

## 📖 6. Chuyển đổi kiểu (Type Conversion)

Go **KHÔNG BAO GIỜ tự động chuyển kiểu** (không có "implicit conversion"), kể cả `int` sang `float64`! Bạn phải chuyển **tường minh** bằng cú pháp `KiểuMới(giáTrị)`.

```go
package main

import "fmt"

func main() {
	a := 10  // int
	b := 3.5 // float64

	// sum := a + b             // ❌ Lỗi: mismatched types int and float64
	sum := float64(a) + b // ✅ Chuyển a sang float64
	fmt.Println(sum)

	// float → int: CẮT phần thập phân (không làm tròn!)
	f := 9.99
	i := int(f)
	fmt.Println(i)

	// Chia nguyên vs chia thực
	x, y := 7, 2
	fmt.Println(x / y)                   // Chia nguyên
	fmt.Println(float64(x) / float64(y)) // Chia thực

	// Giữa các kiểu số nguyên
	var big int64 = 300
	small := int8(big) // ⚠️ Tràn số: 300 không vừa int8
	fmt.Println(small)
}

// Output:
// 13.5
// 9
// 3
// 3.5
// 44
```

**Tại sao Go khắt khe vậy?** Trong C, `int + float` tự chuyển ngầm, gây ra nhiều bug khó phát hiện (mất độ chính xác, tràn số). Go bắt bạn **viết rõ ý định** để người đọc code biết chính xác chuyện gì xảy ra.

### ⚠️ Cái bẫy: `string(số)` KHÔNG ra chuỗi số!

```go
n := 65
s := string(rune(n)) // "A" - chuyển mã Unicode 65 thành ký tự!
fmt.Println(s)       // Output: A

// Muốn "65" thì phải dùng strconv (xem mục 10)
s2 := strconv.Itoa(n)
fmt.Println(s2) // Output: 65
```

> 💡 `go vet` sẽ cảnh báo nếu bạn viết `string(n)` với `n` là `int`: *"conversion from int to string yields a string of one rune, not a string of digits"*.

### Chuyển giữa string, []byte, []rune

```go
s := "Xin chào"
bs := []byte(s)   // Chuỗi → mảng byte
rs := []rune(s)   // Chuỗi → mảng rune
fmt.Println(len(bs), len(rs)) // Output: 10 8

back := string(rs) // Mảng rune → chuỗi
fmt.Println(back)  // Output: Xin chào
```

## 📖 7. Toán tử (Operators)

### Toán tử số học

```go
a, b := 17, 5

fmt.Println(a + b)  // 22 - Cộng
fmt.Println(a - b)  // 12 - Trừ
fmt.Println(a * b)  // 85 - Nhân
fmt.Println(a / b)  // 3  - Chia nguyên (cả hai là int)
fmt.Println(a % b)  // 2  - Chia lấy dư

fmt.Println(17.0 / 5) // 3.4 - Có số thực thì chia thực

// Toán tử gán kết hợp
x := 10
x += 5  // x = 15
x -= 3  // x = 12
x *= 2  // x = 24
x /= 4  // x = 6
x %= 4  // x = 2

// Tăng/giảm
x++     // x = 3
x--     // x = 2
```

⚠️ **Khác biệt với C/Java**:

```go
i := 0
i++           // ✅ OK - là một CÂU LỆNH (statement)
// j := i++   // ❌ Lỗi: i++ không phải biểu thức, không trả về giá trị
// ++i        // ❌ Lỗi: Go không có ++i (tiền tố)
```

### Toán tử so sánh

```go
x, y := 10, 20
fmt.Println(x == y) // false - Bằng
fmt.Println(x != y) // true  - Khác
fmt.Println(x < y)  // true  - Nhỏ hơn
fmt.Println(x <= y) // true  - Nhỏ hơn hoặc bằng
fmt.Println(x > y)  // false - Lớn hơn
fmt.Println(x >= y) // false - Lớn hơn hoặc bằng

// So sánh chuỗi theo thứ tự từ điển (theo byte)
fmt.Println("apple" < "banana") // true
fmt.Println("Go" == "go")       // false - phân biệt hoa thường
```

### Toán tử logic

```go
age := 20
hasTicket := true

fmt.Println(age >= 18 && hasTicket) // true  - AND: cả hai đều true
fmt.Println(age < 18 || hasTicket)  // true  - OR: ít nhất một true
fmt.Println(!hasTicket)             // false - NOT: đảo ngược
```

**Short-circuit** (đánh giá tắt): Với `&&`, nếu vế trái `false` thì **không** xét vế phải. Với `||`, nếu vế trái `true` thì **không** xét vế phải. Rất hữu ích để tránh lỗi:

```go
// Nếu len(list) == 0 thì không truy cập list[0] → không bị panic
if len(list) > 0 && list[0] == "admin" {
	fmt.Println("Admin đứng đầu")
}
```

### Toán tử bit (tham khảo)

```go
a, b := 6, 3        // 110, 011 (nhị phân)
fmt.Println(a & b)  // 2  (010) - AND
fmt.Println(a | b)  // 7  (111) - OR
fmt.Println(a ^ b)  // 5  (101) - XOR
fmt.Println(a << 1) // 12 (1100) - Dịch trái = nhân 2
fmt.Println(a >> 1) // 3  (011) - Dịch phải = chia 2
```

## 📖 8. `fmt.Printf` và các "verb" định dạng

`Printf` = **Print formatted**. Bạn viết một "khuôn mẫu" có các **verb** (bắt đầu bằng `%`), và Go thay giá trị vào.

### Bảng verb hay dùng nhất

| Verb | Ý nghĩa | Ví dụ | Kết quả |
|------|---------|-------|---------|
| `%v` | Giá trị mặc định (dùng được cho MỌI kiểu) | `Printf("%v", 42)` | `42` |
| `%+v` | Như `%v` nhưng in thêm tên field của struct | `Printf("%+v", p)` | `{Name:An Age:20}` |
| `%#v` | Cú pháp Go của giá trị | `Printf("%#v", "hi")` | `"hi"` |
| `%T` | Kiểu dữ liệu | `Printf("%T", 3.0)` | `float64` |
| `%d` | Số nguyên hệ 10 | `Printf("%d", 42)` | `42` |
| `%b` / `%x` / `%o` | Nhị phân / hex / bát phân | `Printf("%x", 255)` | `ff` |
| `%f` | Số thực | `Printf("%f", 3.14)` | `3.140000` |
| `%.2f` | Số thực, 2 chữ số thập phân | `Printf("%.2f", 3.14159)` | `3.14` |
| `%e` | Ký hiệu khoa học | `Printf("%e", 123456.0)` | `1.234560e+05` |
| `%s` | Chuỗi | `Printf("%s", "Go")` | `Go` |
| `%q` | Chuỗi trong ngoặc kép | `Printf("%q", "Go")` | `"Go"` |
| `%c` | Ký tự (rune) | `Printf("%c", 'A')` | `A` |
| `%U` | Mã Unicode | `Printf("%U", 'A')` | `U+0041` |
| `%t` | Boolean | `Printf("%t", true)` | `true` |
| `%p` | Địa chỉ con trỏ | `Printf("%p", &x)` | `0xc000012345` |
| `%%` | Ký tự `%` | `Printf("100%%")` | `100%` |

### Căn chỉnh độ rộng

```go
package main

import "fmt"

func main() {
	fmt.Printf("|%5d|\n", 42)  // Rộng 5, căn phải
	fmt.Printf("|%-5d|\n", 42) // Rộng 5, căn trái
	fmt.Printf("|%05d|\n", 42) // Rộng 5, thêm số 0 phía trước
	fmt.Printf("|%8.2f|\n", 3.14159)
	fmt.Printf("|%-10s|%10s|\n", "Trái", "Phải")

	// In bảng đẹp
	fmt.Printf("%-10s %5s %8s\n", "Sản phẩm", "SL", "Giá")
	fmt.Printf("%-10s %5d %8.2f\n", "Táo", 3, 1.5)
	fmt.Printf("%-10s %5d %8.2f\n", "Chuối", 12, 0.25)
}

// Output:
// |   42|
// |42   |
// |00042|
// |    3.14|
// |Trái      |      Phải|
// Sản phẩm      SL      Giá
// Táo            3     1.50
// Chuối         12     0.25
```

### Họ hàm của `fmt`

```go
fmt.Print("A", "B")         // In, không xuống dòng, không tự thêm dấu cách giữa 2 chuỗi: AB
fmt.Println("A", "B")       // In, thêm dấu cách, xuống dòng: A B
fmt.Printf("%s-%s\n", "A", "B") // In theo định dạng: A-B

s := fmt.Sprintf("Tuổi: %d", 20) // Sprintf: TRẢ VỀ chuỗi thay vì in ra
fmt.Println(s)                   // Tuổi: 20
```

> 💡 **Ghi nhớ**: `Print` → in, `Sprint` → **S**tring (trả về chuỗi), `Fprint` → **F**ile (ghi vào file/writer). Hậu tố `ln` → xuống dòng, `f` → có định dạng.

## 📖 9. Package `strings` - Xử lý chuỗi

```go
package main

import (
	"fmt"
	"strings"
)

func main() {
	s := "  Học Go Thật Vui  "

	// Xóa khoảng trắng đầu/cuối
	clean := strings.TrimSpace(s)
	fmt.Printf("%q\n", clean)

	// Viết hoa / viết thường
	fmt.Println(strings.ToUpper(clean))
	fmt.Println(strings.ToLower(clean))

	// Kiểm tra chứa, bắt đầu, kết thúc
	fmt.Println(strings.Contains(clean, "Go"))
	fmt.Println(strings.HasPrefix(clean, "Học"))
	fmt.Println(strings.HasSuffix(clean, "Vui"))

	// Tìm vị trí (theo byte), -1 nếu không thấy
	fmt.Println(strings.Index("golang", "lang"))
	fmt.Println(strings.Index("golang", "java"))

	// Thay thế (-1 = thay tất cả)
	fmt.Println(strings.ReplaceAll("a-b-c", "-", "+"))
	fmt.Println(strings.Replace("a-b-c", "-", "+", 1))

	// Tách và nối
	parts := strings.Split("táo,cam,xoài", ",")
	fmt.Println(parts, len(parts))
	fmt.Println(strings.Join(parts, " | "))

	// Tách theo khoảng trắng (bỏ qua khoảng trắng thừa)
	fmt.Println(strings.Fields("  một   hai  ba "))

	// Lặp lại, đếm
	fmt.Println(strings.Repeat("=", 10))
	fmt.Println(strings.Count("banana", "a"))

	// So sánh không phân biệt hoa thường
	fmt.Println(strings.EqualFold("GoLang", "golang"))
}

// Output:
// "Học Go Thật Vui"
// HỌC GO THẬT VUI
// học go thật vui
// true
// true
// true
// 2
// -1
// a+b+c
// a+b-c
// [táo cam xoài] 3
// táo | cam | xoài
// [một hai ba]
// ==========
// 3
// true
```

### Nối nhiều chuỗi hiệu quả với `strings.Builder`

Vì string là bất biến, mỗi lần `s += "x"` sẽ **tạo chuỗi mới và copy toàn bộ** → chậm khi nối hàng nghìn lần. Dùng `strings.Builder`:

```go
package main

import (
	"fmt"
	"strings"
)

func main() {
	var sb strings.Builder
	for i := 1; i <= 5; i++ {
		fmt.Fprintf(&sb, "%d,", i) // Ghi vào builder
	}
	sb.WriteString("hết")
	fmt.Println(sb.String())
}

// Output:
// 1,2,3,4,5,hết
```

## 📖 10. Package `strconv` - Chuyển đổi chuỗi ↔ số

Dữ liệu từ bàn phím, file, URL, form... **luôn là chuỗi**. `strconv` (string conversion) giúp chuyển sang số và ngược lại.

```go
package main

import (
	"fmt"
	"strconv"
)

func main() {
	// Chuỗi → int: Atoi (ASCII to integer)
	n, err := strconv.Atoi("123")
	fmt.Println(n+1, err)

	// Chuỗi không hợp lệ → có lỗi
	_, err = strconv.Atoi("12a")
	fmt.Println(err)

	// int → chuỗi: Itoa (integer to ASCII)
	s := strconv.Itoa(456)
	fmt.Println(s + "!")

	// Chuỗi → float64
	f, _ := strconv.ParseFloat("3.14", 64)
	fmt.Println(f * 2)

	// Chuỗi → bool (chấp nhận "true", "1", "t", "false", "0", "f"...)
	b, _ := strconv.ParseBool("true")
	fmt.Println(b)

	// Chuỗi → int64 với hệ cơ số tùy ý
	h, _ := strconv.ParseInt("ff", 16, 64)
	fmt.Println(h)

	// float → chuỗi
	fmt.Println(strconv.FormatFloat(2.5, 'f', 2, 64))

	// Thêm dấu ngoặc kép
	fmt.Println(strconv.Quote("Xin chào"))
}

// Output:
// 124 <nil>
// strconv.Atoi: parsing "12a": invalid syntax
// 456!
// 6.28
// true
// 255
// 2.50
// "Xin chào"
```

> 💡 **Hàm trả về 2 giá trị** `(kết quả, lỗi)` là "phong cách Go". Nếu `err == nil` nghĩa là thành công. Bạn sẽ gặp mẫu này **ở khắp nơi** - chi tiết ở [Bài 7](./07-error-handling.md).

## 📖 11. Ví dụ tổng hợp: Tính chỉ số BMI

```go
package main

import (
	"fmt"
	"strconv"
)

const appTitle = "MÁY TÍNH BMI"

func main() {
	// Giả sử dữ liệu nhập vào là chuỗi (như từ form hoặc bàn phím)
	name := "Lan"
	weightInput := "52.5" // kg
	heightInput := "160"  // cm

	weight, err := strconv.ParseFloat(weightInput, 64)
	if err != nil {
		fmt.Println("Cân nặng không hợp lệ:", err)
		return
	}
	heightCm, err := strconv.Atoi(heightInput)
	if err != nil {
		fmt.Println("Chiều cao không hợp lệ:", err)
		return
	}

	heightM := float64(heightCm) / 100 // Đổi cm → m, nhớ ép kiểu!
	bmi := weight / (heightM * heightM)

	fmt.Println("=====", appTitle, "=====")
	fmt.Printf("Tên:        %s\n", name)
	fmt.Printf("Cân nặng:   %.1f kg\n", weight)
	fmt.Printf("Chiều cao:  %d cm\n", heightCm)
	fmt.Printf("BMI:        %.2f\n", bmi)
	fmt.Printf("Kiểu BMI:   %T\n", bmi)
}

// Output:
// ===== MÁY TÍNH BMI =====
// Tên:        Lan
// Cân nặng:   52.5 kg
// Chiều cao:  160 cm
// BMI:        20.51
// Kiểu BMI:   float64
```

## ⚠️ Lỗi thường gặp

### Lỗi 1: Dùng `:=` ngoài hàm

```go
package main

count := 0 // ❌ syntax error: non-declaration statement outside function body
```

✅ Sửa: `var count = 0`

### Lỗi 2: Dùng `:=` khi biến đã tồn tại trong cùng scope

```go
x := 1
x := 2 // ❌ no new variables on left side of :=
```

✅ Sửa: `x = 2`

### Lỗi 3: Cộng khác kiểu

```go
age := 20
bonus := 1.5
// total := age + bonus // ❌ invalid operation: age + bonus (mismatched types int and float64)
total := float64(age) + bonus // ✅
```

### Lỗi 4: Chia nguyên ngoài ý muốn

```go
avg := 7 / 2 // avg = 3, không phải 3.5!
fmt.Println(avg)

avgCorrect := 7.0 / 2 // 3.5 ✅
fmt.Println(float64(7) / 2) // 3.5 ✅
```

### Lỗi 5: `string(int)` thay vì `strconv.Itoa`

```go
age := 65
fmt.Println("Tuổi: " + string(rune(age))) // "Tuổi: A" 😱
fmt.Println("Tuổi: " + strconv.Itoa(age))  // "Tuổi: 65" ✅
```

### Lỗi 6: `len()` với chuỗi tiếng Việt

```go
name := "Hùng"
fmt.Println(len(name))                    // 5 (byte) - có thể không phải điều bạn muốn
fmt.Println(utf8.RuneCountInString(name)) // 4 (ký tự) ✅
```

### Lỗi 7: Dấu nháy đơn cho chuỗi

```go
// s := 'Hello' // ❌ Lỗi: more than one character in rune literal
s := "Hello"    // ✅ Chuỗi dùng nháy kép
c := 'H'        // ✅ Nháy đơn chỉ cho MỘT ký tự (rune)
```

### Lỗi 8: Bỏ qua lỗi từ `strconv`

```go
n, _ := strconv.Atoi("abc") // n = 0, lỗi bị nuốt mất!
fmt.Println(n * 10)         // 0 - kết quả sai mà không ai biết
```

✅ Luôn kiểm tra `err` khi dữ liệu đến từ bên ngoài.

### Lỗi 9: So sánh số thực bằng `==`

```go
a := 0.1 + 0.2
fmt.Println(a == 0.3) // false!

// ✅ So sánh với sai số cho phép (epsilon)
const epsilon = 1e-9
fmt.Println(math.Abs(a-0.3) < epsilon) // true
```

## 🏋️ Bài tập

### Bài tập 1: Thông tin sinh viên

Khai báo các biến: họ tên (`string`), tuổi (`int`), điểm trung bình (`float64`), đã tốt nghiệp chưa (`bool`). In ra bằng `Printf` với định dạng:

```text
Họ tên: Trần Văn B | Tuổi: 21 | GPA: 3.45 | Tốt nghiệp: false
```

In thêm kiểu dữ liệu của từng biến bằng `%T`.

### Bài tập 2: Đổi nhiệt độ

Cho `celsius := 36.6`. Tính và in ra độ Fahrenheit (`F = C*9/5 + 32`) và Kelvin (`K = C + 273.15`), làm tròn 1 chữ số thập phân.

### Bài tập 3: Enum Size với iota

Dùng `iota` tạo kiểu `Size` với các giá trị `Small`, `Medium`, `Large`, `XLarge` bắt đầu từ 1. In ra giá trị của `Large`.

**Nâng cao**: Tạo hằng số đơn vị dung lượng `KB`, `MB`, `GB`, `TB` bằng `iota` và phép dịch bit.

### Bài tập 4: Phân tích chuỗi

Cho `sentence := "  Go là ngôn ngữ   lập trình  của Google  "`. Hãy:

1. Xóa khoảng trắng đầu/cuối
2. Đếm số từ (gợi ý: `strings.Fields`)
3. Đếm số byte và số ký tự (rune)
4. In ra câu viết hoa toàn bộ
5. Thay "Google" bằng "Gopher"

### Bài tập 5: Máy tính từ chuỗi

Cho `a := "15"`, `b := "4"`. Chuyển sang số nguyên và in ra kết quả của `+ - * / %`, và phép chia thực (`15 / 4 = 3.75`). Xử lý trường hợp chuỗi không hợp lệ (thử `b := "4x"`).

### Bài tập 6: Hóa đơn

In ra hóa đơn căn chỉnh đẹp bằng `Printf` với độ rộng cột:

```text
Tên SP          SL      Đơn giá    Thành tiền
Bút bi           3         5000         15000
Vở ô li         10        12000        120000
-------------------------------------------
Tổng cộng                             135000
```

## ✅ Checklist hoàn thành

- [ ] Khai báo biến bằng cả `var` và `:=`
- [ ] Hiểu `:=` chỉ dùng trong hàm, `=` để gán lại
- [ ] Biết zero value của các kiểu cơ bản
- [ ] Phân biệt `int`/`float64`/`string`/`bool`/`byte`/`rune`
- [ ] Hiểu `len()` của chuỗi đếm byte, không phải ký tự
- [ ] Dùng `const` và `iota` để tạo enum
- [ ] Chuyển kiểu tường minh `float64(x)`, `int(y)`
- [ ] Biết `string(65)` là "A" chứ không phải "65"
- [ ] Dùng thành thạo `%v`, `%d`, `%s`, `%.2f`, `%T`, `%q`
- [ ] Dùng được các hàm phổ biến trong `strings`
- [ ] Chuyển chuỗi ↔ số với `strconv` và kiểm tra lỗi
- [ ] Hoàn thành ít nhất 4 bài tập

## 🚀 Tiếp theo

Bạn đã biết cách lưu trữ và biến đổi dữ liệu! Tiếp theo, hãy học cách **ra quyết định** và **lặp lại** công việc:

- `if` với câu lệnh khởi tạo
- Vòng lặp `for` - vòng lặp duy nhất của Go
- `switch` mạnh mẽ hơn C/Java
- `defer` - "để dành việc cho sau"

**Bài tiếp theo**: [Cấu trúc điều khiển](./03-control-flow.md)

---

💡 **Tips ghi nhớ**:

- **`:=` tạo mới, `=` gán lại** - câu thần chú quan trọng nhất bài này
- **`int` và `float64`** là lựa chọn mặc định cho số
- **Go không tự chuyển kiểu** - luôn viết `float64(x)` rõ ràng
- **Chuỗi là byte UTF-8** - dùng `[]rune` khi cần làm việc với từng ký tự
- **`strconv` cho số ↔ chuỗi**, **`fmt.Sprintf` cho định dạng phức tạp**
